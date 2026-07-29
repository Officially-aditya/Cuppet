import type { PoolClient } from "pg";
import { pool } from "../db/index.js";
import { recordPreferenceEvent } from "../personalization/event-writer.js";
import { preferenceDimensions, type PreferenceDimension } from "../personalization/types.js";
import { isSupportedConnectorId, safePublicUrl } from "./action-safety.js";
import { suggestionExplanation } from "./explanation-service.js";
import type { SuggestionDecision, SuggestionCandidateRow, SuggestionRow } from "./types.js";
import { createSuggestionExclusion } from "./repository.js";
import { rebuildPreferenceProfile } from "../personalization/profile-builder.js";
import { recordPersonalizationProductEvent } from "../personalization/analytics.js";

export type SuggestionDecisionResult = {
  suggestion: SuggestionRow;
  explanation: ReturnType<typeof suggestionExplanation>;
  next_message?: { id: string; agent_id: string; role: "agent"; content: Record<string, unknown> };
  idempotent?: boolean;
};

export async function decideSuggestion(input: {
  userId: string;
  suggestionId: string;
  decision: Exclude<SuggestionDecision, "explain">;
}): Promise<SuggestionDecisionResult> {
  const client = await pool.connect();
  let candidate: SuggestionCandidateRow | null = null;
  let result: SuggestionDecisionResult | null = null;
  let createdExclusion = false;
  try {
    await client.query("BEGIN");
    const loaded = await client.query<SuggestionRow>(
      `SELECT * FROM suggestions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [input.suggestionId, input.userId]
    );
    const suggestion = loaded.rows[0];
    if (!suggestion) {
      await client.query("ROLLBACK");
      throw new SuggestionDecisionError("SUGGESTION_NOT_FOUND", "Suggestion not found.", 404);
    }
    const candidateResult = await client.query<SuggestionCandidateRow>(
      `SELECT * FROM suggestion_candidates WHERE id = $1 FOR UPDATE`,
      [suggestion.candidate_id]
    );
    candidate = candidateResult.rows[0] ?? null;
    if (!candidate) {
      await client.query("ROLLBACK");
      throw new SuggestionDecisionError("SUGGESTION_NOT_FOUND", "Suggestion not found.", 404);
    }

    const explanation = suggestionExplanation(candidate);
    if (suggestion.status !== "delivered") {
      await client.query("COMMIT");
      return { suggestion, explanation, idempotent: true };
    }
    const settingsResult = await client.query<{
      enabled: boolean;
      learning_paused: boolean;
    }>(
      `SELECT enabled, learning_paused
       FROM personalization_settings WHERE user_id = $1`,
      [input.userId]
    );
    const consentResult = await client.query<{ purpose: string }>(
      `SELECT purpose
       FROM (
         SELECT DISTINCT ON (purpose) purpose, status
         FROM personalization_consents
         WHERE user_id = $1 AND purpose = ANY($2::text[])
         ORDER BY purpose, created_at DESC
       ) latest
       WHERE status = 'granted'`,
      [input.userId, candidate.consent_purposes]
    );
    if (
      !settingsResult.rows[0]?.enabled ||
      settingsResult.rows[0].learning_paused ||
      consentResult.rows.length !== candidate.consent_purposes.length
    ) {
      const expired = await updateSuggestionStatus(client, suggestion.id, "expired");
      await client.query(
        "UPDATE suggestion_candidates SET status = 'expired' WHERE id = $1",
        [candidate.id]
      );
      await resolveSuggestionMessage(client, suggestion.message_id, "no_consent");
      await client.query("COMMIT");
      return { suggestion: expired, explanation, idempotent: true };
    }
    if (new Date(suggestion.expires_at) <= new Date()) {
      const expired = await updateSuggestionStatus(client, suggestion.id, "expired");
      await client.query(
        "UPDATE suggestion_candidates SET status = 'expired' WHERE id = $1",
        [candidate.id]
      );
      await client.query("COMMIT");
      return { suggestion: expired, explanation };
    }

    const status = input.decision === "accept" ? "accepted" : input.decision === "not_now" ? "not_now" : "dismissed";
    const updated = await updateSuggestionStatus(client, suggestion.id, status);
    await client.query(
      "UPDATE suggestion_candidates SET status = $2 WHERE id = $1",
      [candidate.id, status === "accepted" ? "accepted" : "dismissed"]
    );

    const target = suggestionPreferenceTarget(candidate);
    if (input.decision === "dismiss") {
      await createSuggestionExclusion({
        userId: input.userId,
        subjectType: target.subjectType,
        subjectKey: target.subjectKey,
        sourceSuggestionId: suggestion.id,
        client
      });
      createdExclusion = true;
    }
    if (input.decision === "dismiss" || input.decision === "less_like_this") {
      await suppressRelatedCandidates(client, input.userId, candidate, target);
    }

    if (
      input.decision === "accept" &&
      (candidate.action_type === "agent_creation" ||
        candidate.action_type === "agent_refinement")
    ) {
      const pending = await createSuggestionConfirmation(client, {
        userId: input.userId,
        suggestion,
        candidate
      });
      const refinement = candidate.action_type === "agent_refinement";
      const message = await insertConfirmationMessage(client, {
        userId: input.userId,
        assistantId: await assistantIdForSuggestion(client, suggestion),
        pendingId: pending.id,
        title: refinement ? "Review this agent change" : "Review the agent first",
        detail: refinement
          ? "I prepared a quieter, stricter revision. Nothing will change until you confirm it."
          : "I prepared this from your repeated request. Nothing will be created until you confirm it.",
        primaryLabel: refinement ? "Update agent" : "Create agent",
        actionDetail: refinement
          ? "Cuppet will apply the proposed revision through the normal agent safety checks."
          : "Cuppet will use your original request and keep the normal access and safety checks.",
        sourceSuggestionId: suggestion.id
      });
      await resolveSuggestionMessage(client, suggestion.message_id, "accepted");
      result = { suggestion: updated, explanation, next_message: message };
    } else if (input.decision === "accept" && candidate.action_type === "capability_connection") {
      const message = await insertCapabilityConnectionMessage(client, {
        userId: input.userId,
        assistantId: await assistantIdForSuggestion(client, suggestion),
        suggestionId: suggestion.id,
        connectorId: candidate.action_payload.connector_id,
        connectorName: candidate.action_payload.connector_name
      });
      await resolveSuggestionMessage(client, suggestion.message_id, "accepted");
      result = { suggestion: updated, explanation, next_message: message };
    } else if (input.decision === "accept" && candidate.action_type === "content_open") {
      const message = await insertContentMessage(client, {
        userId: input.userId,
        assistantId: await assistantIdForSuggestion(client, suggestion),
        suggestionId: suggestion.id,
        title: candidate.action_payload.title,
        url: candidate.action_payload.url
      });
      await resolveSuggestionMessage(client, suggestion.message_id, "accepted");
      result = { suggestion: updated, explanation, next_message: message };
    } else {
      await resolveSuggestionMessage(client, suggestion.message_id, input.decision);
      result = { suggestion: updated, explanation };
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (createdExclusion) {
    void rebuildPreferenceProfile(input.userId).catch((error) => {
      console.error("Suggestion exclusion profile rebuild failed:", error);
    });
  }

  if (candidate) {
    const actionSubjectType = candidate.action_payload.preference_subject_type;
    const actionSubjectKey = candidate.action_payload.preference_subject_key;
    const subjectType = preferenceDimensions.includes(
      actionSubjectType as PreferenceDimension
    )
      ? (actionSubjectType as PreferenceDimension)
      : preferenceDimensions.includes(candidate.subject_type as PreferenceDimension)
        ? (candidate.subject_type as PreferenceDimension)
        : "agent_type";
    const subjectKey =
      typeof actionSubjectKey === "string" && actionSubjectKey.trim()
        ? actionSubjectKey.trim()
        : candidate.subject_key;
    await recordPreferenceEvent({
      userId: input.userId,
      purpose: "explicit_feedback",
      eventType: `suggestion_${input.decision}`,
      subjectType,
      subjectKey,
      polarity: input.decision === "accept" ? 1 : -1,
      strength: input.decision === "not_now" ? 0.2 : 0.8,
      provenanceType: "suggestion_decision",
      provenanceId: input.suggestionId
    }).catch(() => undefined);
    void recordPersonalizationProductEvent({
      userId: input.userId,
      eventName: "suggestion_decided",
      suggestionId: input.suggestionId,
      metadata: {
        decision: input.decision,
        suggestion_type: candidate.suggestion_type
      }
    }).catch(() => undefined);
  }
  return result!;
}

export async function getSuggestionExplanationForUser(input: {
  userId: string;
  suggestionId: string;
}): Promise<ReturnType<typeof suggestionExplanation> | null> {
  const { rows } = await pool.query<SuggestionCandidateRow & { suggestion_id: string }>(
    `SELECT c.*, s.id AS suggestion_id
     FROM suggestions s
     JOIN suggestion_candidates c ON c.id = s.candidate_id
     WHERE s.id = $1 AND s.user_id = $2`,
    [input.suggestionId, input.userId]
  );
  const candidate = rows[0];
  return candidate ? suggestionExplanation(candidate) : null;
}

function suggestionPreferenceTarget(candidate: SuggestionCandidateRow): {
  subjectType: string;
  subjectKey: string;
} {
  const subjectType = candidate.action_payload.preference_subject_type;
  const subjectKey = candidate.action_payload.preference_subject_key;
  return {
    subjectType:
      typeof subjectType === "string" && subjectType.trim()
        ? subjectType.trim()
        : candidate.subject_type,
    subjectKey:
      typeof subjectKey === "string" && subjectKey.trim()
        ? subjectKey.trim()
        : candidate.subject_key
  };
}

async function suppressRelatedCandidates(
  client: PoolClient,
  userId: string,
  candidate: SuggestionCandidateRow,
  target: { subjectType: string; subjectKey: string }
): Promise<void> {
  await client.query(
    `UPDATE suggestion_candidates
     SET status = 'superseded'
     WHERE user_id = $1
       AND id <> $2
       AND status IN ('candidate', 'eligible')
       AND (
         (subject_type = $3 AND subject_key = $4)
         OR (
           action_payload->>'preference_subject_type' = $3
           AND action_payload->>'preference_subject_key' = $4
         )
       )`,
    [userId, candidate.id, target.subjectType, target.subjectKey]
  );
}

class SuggestionDecisionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = "SuggestionDecisionError";
  }
}

export { SuggestionDecisionError };

async function updateSuggestionStatus(
  client: PoolClient,
  suggestionId: string,
  status: SuggestionRow["status"]
): Promise<SuggestionRow> {
  const { rows } = await client.query<SuggestionRow>(
    `UPDATE suggestions SET status = $2, decided_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [suggestionId, status]
  );
  return rows[0]!;
}

async function assistantIdForSuggestion(
  client: PoolClient,
  suggestion: SuggestionRow
): Promise<string> {
  const { rows } = await client.query<{ agent_id: string }>(
    `SELECT agent_id FROM agent_messages WHERE id = $1 AND user_id = $2`,
    [suggestion.message_id, suggestion.user_id]
  );
  if (!rows[0]) throw new SuggestionDecisionError("MESSAGE_NOT_FOUND", "Suggestion message not found.", 404);
  return rows[0].agent_id;
}

async function createSuggestionConfirmation(
  client: PoolClient,
  input: { userId: string; suggestion: SuggestionRow; candidate: SuggestionCandidateRow }
): Promise<{ id: string }> {
  const sourceMessageId =
    typeof input.candidate.action_payload.source_message_id === "string"
      ? input.candidate.action_payload.source_message_id
      : input.suggestion.message_id;
  const confirmedRoute =
    input.candidate.action_payload.confirmed_route &&
    typeof input.candidate.action_payload.confirmed_route === "object"
      ? input.candidate.action_payload.confirmed_route
      : { kind: "create_agent" };
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO assistant_pending_actions
       (user_id, assistant_id, source_message_id, action_type, payload, expires_at)
     SELECT $1, m.agent_id, $2, 'confirm_intent', $3, NOW() + INTERVAL '10 minutes'
     FROM agent_messages m
     WHERE m.id = $2 AND m.user_id = $1
     RETURNING id`,
    [
      input.userId,
      sourceMessageId,
      JSON.stringify({ confirmed_route: confirmedRoute })
    ]
  );
  if (!rows[0]) throw new SuggestionDecisionError("PENDING_ACTION_FAILED", "Confirmation could not be created.", 500);
  return rows[0];
}

async function insertConfirmationMessage(
  client: PoolClient,
  input: {
    userId: string;
    assistantId: string;
    pendingId: string;
    title: string;
    detail: string;
    primaryLabel: string;
    actionDetail: string;
    sourceSuggestionId: string;
  }
): Promise<{ id: string; agent_id: string; role: "agent"; content: Record<string, unknown> }> {
  const content = {
    template: "action_confirmation",
    version: "1.0",
    data: {
      title: input.title,
      question: input.detail,
      action_label: input.primaryLabel,
      action_detail: input.actionDetail,
      context: "Nothing has been created yet. This confirmation expires in 10 minutes.",
      actions: [
        {
          id: "suggestion_confirm_agent",
          type: "assistant_pending_action",
          decision: "confirm",
          pending_action_id: input.pendingId,
          label: input.primaryLabel,
          style: "primary"
        },
        {
          id: "suggestion_cancel_agent",
          type: "assistant_pending_action",
          decision: "cancel",
          pending_action_id: input.pendingId,
          label: "Cancel",
          style: "secondary"
        }
      ],
      source_suggestion_id: input.sourceSuggestionId
    }
  };
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO agent_messages (agent_id, user_id, role, content, source_refs)
     VALUES ($1, $2, 'agent', $3, '[]'::jsonb)
     RETURNING id`,
    [input.assistantId, input.userId, JSON.stringify(content)]
  );
  return { id: rows[0]!.id, agent_id: input.assistantId, role: "agent", content };
}

async function insertCapabilityConnectionMessage(
  client: PoolClient,
  input: {
    userId: string;
    assistantId: string;
    suggestionId: string;
    connectorId: unknown;
    connectorName: unknown;
  }
): Promise<{ id: string; agent_id: string; role: "agent"; content: Record<string, unknown> }> {
  const connectorId = typeof input.connectorId === "string" ? input.connectorId.trim() : "";
  const connectorName =
    typeof input.connectorName === "string" && input.connectorName.trim()
      ? input.connectorName.trim().slice(0, 80)
      : connectorId;
  if (!isSupportedConnectorId(connectorId)) {
    throw new SuggestionDecisionError("INVALID_CAPABILITY_ACTION", "The connection action is no longer available.", 409);
  }
  const content = {
    template: "daily_task",
    version: "1.0",
    data: {
      title: `Connect ${connectorName}`,
      task: `Connect ${connectorName} so Cuppet can complete the request that prompted this suggestion.`,
      context: "This opens the existing connection flow. Cuppet will not connect anything silently.",
      actions: [{
        id: `suggestion_connect_${connectorId}`,
        type: "connector_connect",
        connector_id: connectorId,
        connector_name: connectorName,
        run_after_connect: true,
        resume_suggestion_id: input.suggestionId,
        label: `Connect ${connectorName}`,
        style: "primary"
      }],
      source_suggestion_id: input.suggestionId
    }
  };
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO agent_messages (agent_id, user_id, role, content, source_refs)
     VALUES ($1, $2, 'agent', $3, '[]'::jsonb)
     RETURNING id`,
    [input.assistantId, input.userId, JSON.stringify(content)]
  );
  return { id: rows[0]!.id, agent_id: input.assistantId, role: "agent", content };
}

async function insertContentMessage(
  client: PoolClient,
  input: {
    userId: string;
    assistantId: string;
    suggestionId: string;
    title: unknown;
    url: unknown;
  }
): Promise<{ id: string; agent_id: string; role: "agent"; content: Record<string, unknown> }> {
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim().slice(0, 160)
      : "Recommended source";
  const url = typeof input.url === "string" ? input.url.trim() : "";
  const safeUrl = safePublicUrl(url);
  if (!safeUrl) {
    throw new SuggestionDecisionError(
      "INVALID_CONTENT_ACTION",
      "The source link is no longer available.",
      409
    );
  }
  const content = {
    template: "plain_text",
    version: "1.0",
    data: {
      body:
        `${title}\n\n${url}\n\n` +
        "I only surfaced this public source for your review. I did not follow it, save it, or create an agent.",
      source_suggestion_id: input.suggestionId
    }
  };
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO agent_messages (agent_id, user_id, role, content, source_refs)
     VALUES ($1, $2, 'agent', $3, $4)
     RETURNING id`,
    [
      input.assistantId,
      input.userId,
      JSON.stringify(content),
      JSON.stringify([{ type: "web_source", title, url: safeUrl }])
    ]
  );
  return { id: rows[0]!.id, agent_id: input.assistantId, role: "agent", content };
}

async function resolveSuggestionMessage(
  client: PoolClient,
  messageId: string | null,
  resolution: string
): Promise<void> {
  if (!messageId) return;
  await client.query(
    `UPDATE agent_messages
     SET content = jsonb_set(
       content,
       '{data}',
       COALESCE(content->'data', '{}'::jsonb) || $2::jsonb,
       true
     )
     WHERE id = $1`,
    [messageId, JSON.stringify({ resolved: true, resolution })]
  );
}

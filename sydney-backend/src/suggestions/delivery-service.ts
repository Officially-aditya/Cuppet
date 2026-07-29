import type { PoolClient } from "pg";
import { pool } from "../db/index.js";
import { publishRealtimeEvent } from "../realtime/events.js";
import { getActiveConsent, getPersonalizationSettings } from "../personalization/consent-service.js";
import { recordPersonalizationProductEvent } from "../personalization/analytics.js";
import { preferenceVectorStore } from "../personalization/vector-store.js";
import { generateContextualCandidates } from "./candidate-service.js";
import { suggestionExplanation } from "./explanation-service.js";
import {
  evaluateSuggestionPolicy,
  suggestionCooldownDays,
  suggestionThresholds
} from "./policy.js";
import { rankCandidates, scoreSuggestion } from "./ranker.js";
import type { SuggestionCandidateRow } from "./types.js";

export async function evaluateAndDeliverContextualSuggestion(input: {
  userId: string;
  assistantId: string;
  sourceMessageId: string;
  currentText: string;
  responseContent?: Record<string, unknown>;
  sourceRefs?: unknown[];
}): Promise<{ delivered: boolean; suggestionId?: string }> {
  const settings = await getPersonalizationSettings(input.userId);
  if (!settings.enabled || settings.learning_paused || !settings.in_chat) {
    return { delivered: false };
  }
  const contextual = await generateContextualCandidates(input);
  const deferred = contextual.length === 0;
  const candidates = !deferred
    ? contextual
    : [await loadDeferredCandidate(input.userId)].filter(
        (candidate): candidate is SuggestionCandidateRow => candidate !== null
      );
  if (candidates.length === 0) return { delivered: false };

  const scoreById = new Map<string, ReturnType<typeof scoreSuggestion>>();
  for (const candidate of candidates) {
    const semanticInterestMatch = await preferenceVectorStore
      .similarity(
        input.userId,
        "suggestions",
        `${candidate.title} ${candidate.body} ${String(candidate.evidence_summary.profile_key ?? "")}`
      )
      .catch(() => 0);
    scoreById.set(
      candidate.id,
      scoreSuggestion({
        candidate,
        hasExplicitMatch: candidate.consent_purposes.includes("explicit_feedback"),
        semanticInterestMatch,
        conversationRelevance: candidate.reason_codes.includes("current_context") ? 1 : 0.72,
        novelty: candidate.reason_codes.includes("current_context") ? 1 : 0.85,
        privacyPenalty: candidate.consent_purposes.some((purpose) =>
          ["browser_activity", "connected_content", "cross_source"].includes(purpose)
        ) ? 0.05 : 0
      })
    );
  }

  const ranked = rankCandidates(candidates, (candidate) => scoreById.get(candidate.id)!);
  const poorTiming = await hasContextualPoorTiming(input);
  for (const rankedCandidate of ranked) {
    const candidate = rankedCandidate.candidate;
    const consents = await Promise.all(
      candidate.consent_purposes.map((purpose) => getActiveConsent(input.userId, purpose))
    );
    const counts = await policyCounts(input.userId, candidate);
    const decision = evaluateSuggestionPolicy({
      score: rankedCandidate.score.finalScore,
      confidence: Number(candidate.confidence_score),
      frequency: settings.frequency,
      hasConsent: consents.every(Boolean),
      poorTiming,
      minimumScore: deferred ? suggestionThresholds.deferred : suggestionThresholds.contextual,
      ...counts
    });
    if (!decision.eligible) {
      await pool.query(
        `UPDATE suggestion_candidates
         SET status = 'suppressed', score_breakdown = $2
         WHERE id = $1 AND status IN ('candidate', 'eligible')`,
        [candidate.id, JSON.stringify({ ...rankedCandidate.score, suppression_reason: decision.suppressionReason })]
      );
      continue;
    }
    await pool.query(
      `UPDATE suggestion_candidates
       SET status = 'eligible', score_breakdown = $2
       WHERE id = $1 AND status = 'candidate'`,
      [candidate.id, JSON.stringify(rankedCandidate.score)]
    );
    const delivered = await deliverCandidate({
      candidate,
      score: rankedCandidate.score,
      userId: input.userId,
      assistantId: input.assistantId,
      sourceMessageId: input.sourceMessageId,
      deliverySurface: "in_chat",
      frequency: settings.frequency
    });
    if (delivered.delivered) return delivered;
  }
  return { delivered: false };
}

async function loadDeferredCandidate(
  userId: string
): Promise<SuggestionCandidateRow | null> {
  const { rows } = await pool.query<SuggestionCandidateRow>(
    `SELECT * FROM suggestion_candidates
      WHERE user_id = $1
       AND status = 'candidate'
       AND eligible_after <= NOW()
       AND expires_at > NOW()
     ORDER BY confidence_score DESC, relevance_score DESC, created_at ASC
     LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

async function hasContextualPoorTiming(input: {
  userId: string;
  assistantId: string;
  currentText: string;
  responseContent?: Record<string, unknown>;
}): Promise<boolean> {
  if (
    /\b(?:password|passcode|token|secret|private key|one[- ]time code|ssn|credit card)\b/i.test(
      input.currentText
    )
  ) {
    return true;
  }
  const pending = await pool.query(
    `SELECT 1 FROM assistant_pending_actions
     WHERE user_id = $1 AND assistant_id = $2
       AND consumed_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [input.userId, input.assistantId]
  );
  if (pending.rows[0]) return true;
  const data = input.responseContent?.data;
  const body =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>).body
      : undefined;
  return typeof body === "string" &&
    /\b(?:urgent|error|failed|failure|couldn['’]t|authorization|access denied|reconnect)\b/i.test(body);
}

export async function deliverCandidate(input: {
  candidate: SuggestionCandidateRow;
  score: ReturnType<typeof scoreSuggestion>;
  userId: string;
  assistantId: string;
  sourceMessageId: string;
  deliverySurface: "in_chat" | "proactive" | "push";
  frequency: "low" | "balanced" | "high";
}): Promise<{ delivered: boolean; suggestionId?: string }> {
  const client = await pool.connect();
  let messageId: string | undefined;
  let suggestionId: string | undefined;
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext('suggestion_delivery'))",
      [input.userId]
    );
    const locked = await client.query<SuggestionCandidateRow>(
      `SELECT * FROM suggestion_candidates WHERE id = $1 FOR UPDATE`,
      [input.candidate.id]
    );
    const candidate = locked.rows[0];
     if (
       !candidate ||
       !["candidate", "eligible"].includes(candidate.status) ||
       new Date(candidate.expires_at) <= new Date()
     ) {
      await client.query("ROLLBACK");
      return { delivered: false };
    }
    const settingsResult = await client.query<{
      enabled: boolean;
      learning_paused: boolean;
      in_chat: boolean;
      proactive: boolean;
      frequency: "low" | "balanced" | "high";
    }>(
      `SELECT enabled, learning_paused, in_chat, proactive, frequency
       FROM personalization_settings WHERE user_id = $1`,
      [input.userId]
    );
    const settings = settingsResult.rows[0];
    const surfaceAllowed =
      input.deliverySurface === "in_chat"
        ? settings?.in_chat === true
        : input.deliverySurface === "proactive"
          ? settings?.proactive === true
          : true;
    const consentResult = candidate.consent_purposes.length
      ? await client.query<{ purpose: string }>(
          `SELECT purpose
           FROM (
             SELECT DISTINCT ON (purpose) purpose, status
             FROM personalization_consents
             WHERE user_id = $1 AND purpose = ANY($2::text[])
             ORDER BY purpose, created_at DESC
           ) latest
           WHERE status = 'granted'`,
          [input.userId, candidate.consent_purposes]
        )
      : { rows: candidate.consent_purposes };
    const hasConsent = consentResult.rows.length === candidate.consent_purposes.length;
    if (!settings?.enabled || settings.learning_paused || !surfaceAllowed || !hasConsent) {
      await client.query(
        `UPDATE suggestion_candidates
         SET status = 'suppressed', score_breakdown = $2
          WHERE id = $1 AND status IN ('candidate', 'eligible')`,
        [
          candidate.id,
          JSON.stringify({
            ...input.score,
            suppression_reason: !hasConsent ? "no_consent" : "delivery_disabled"
          })
        ]
      );
      await client.query("COMMIT");
      return { delivered: false };
    }
    const counts = await policyCounts(input.userId, candidate, client);
    const excluded = await client.query(
      `SELECT 1
       FROM suggestion_exclusions
       WHERE user_id = $1
         AND (
           (subject_type = $2 AND subject_key = $3)
           OR (
             $4::text IS NOT NULL
             AND subject_type = $4
             AND subject_key = $5
           )
         )
       LIMIT 1`,
      [
        input.userId,
        candidate.subject_type,
        candidate.subject_key,
        typeof candidate.action_payload.preference_subject_type === "string"
          ? candidate.action_payload.preference_subject_type
          : null,
        typeof candidate.action_payload.preference_subject_key === "string"
          ? candidate.action_payload.preference_subject_key
          : null
      ]
    );
    const cap = (settings?.frequency ?? input.frequency) === "low" ? 1 : 2;
    if (
      counts.deliveredThisWeek >= cap ||
      counts.deliveredForSubjectRecently ||
      counts.dismissedForSubjectRecently ||
      counts.hasUnresolvedSuggestion ||
      excluded.rows[0]
    ) {
      await client.query(
        `UPDATE suggestion_candidates
         SET status = 'suppressed'
         WHERE id = $1 AND status IN ('candidate', 'eligible')`,
        [candidate.id]
      );
      await client.query("COMMIT");
      return { delivered: false };
    }

    const explanation = suggestionExplanation(candidate);
    const content = {
      template: "assistant_suggestion",
      version: "1.0",
      data: {
        suggestion_id: candidate.id,
        suggestion_type: candidate.suggestion_type,
        title: candidate.title,
        body: candidate.body,
        primary_action: {
          label: "Review and continue",
          type: "suggestion_decision",
          decision: "accept",
          suggestion_id: candidate.id
        },
        secondary_actions: [
          {
            label: "Not now",
            type: "suggestion_decision",
            decision: "not_now",
            suggestion_id: candidate.id
          },
          {
            label: "Don’t suggest this",
            type: "suggestion_decision",
            decision: "dismiss",
            suggestion_id: candidate.id
          },
          {
            label: "Less like this",
            type: "suggestion_decision",
            decision: "less_like_this",
            suggestion_id: candidate.id
          }
        ],
        explanation
      }
    };
    const message = await insertSuggestionMessage(client, {
      assistantId: input.assistantId,
      userId: input.userId,
      content
    });
    messageId = message.id;
    const suggestion = await client.query<{ id: string }>(
      `INSERT INTO suggestions
         (candidate_id, user_id, message_id, suggestion_type, action_type,
           action_payload, status, delivered_at, expires_at, delivery_surface)
        VALUES ($1, $2, $3, $4, $5, $6, 'delivered', NOW(), $7, $8)
       RETURNING id`,
      [
        candidate.id,
        input.userId,
        message.id,
        candidate.suggestion_type,
       candidate.action_type,
       JSON.stringify(candidate.action_payload),
       candidate.expires_at,
       input.deliverySurface
      ]
    );
    suggestionId = suggestion.rows[0]!.id;
    await client.query(
      `UPDATE agent_messages
       SET content = jsonb_set(
         jsonb_set(
           jsonb_set(
             jsonb_set(
               jsonb_set(content, '{data,suggestion_id}', to_jsonb($2::text), true),
               '{data,primary_action,suggestion_id}', to_jsonb($2::text), true
             ),
             '{data,secondary_actions,0,suggestion_id}', to_jsonb($2::text), true
           ),
           '{data,secondary_actions,1,suggestion_id}', to_jsonb($2::text), true
         ),
         '{data,secondary_actions,2,suggestion_id}', to_jsonb($2::text), true
       )
       WHERE id = $1`,
      [message.id, suggestionId]
    );
    await client.query(
       `UPDATE suggestion_candidates
        SET status = 'delivered', score_breakdown = $2
        WHERE id = $1 AND status IN ('candidate', 'eligible')`,
      [candidate.id, JSON.stringify(input.score)]
    );
    await client.query(
      "UPDATE agents SET last_message_at = NOW() WHERE id = $1 AND user_id = $2",
      [input.assistantId, input.userId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  if (messageId) {
    await publishRealtimeEvent({
      type: "message.created",
      user_id: input.userId,
      agent_id: input.assistantId,
      message_id: messageId,
      data: { role: "agent", suggestion_id: suggestionId, delivery_surface: input.deliverySurface }
    }).catch(() => undefined);
  }
  if (suggestionId) {
    void recordPersonalizationProductEvent({
      userId: input.userId,
      eventName: "suggestion_delivered",
      suggestionId,
      metadata: {
        suggestion_type: input.candidate.suggestion_type,
        delivery_surface: input.deliverySurface
      }
    }).catch(() => undefined);
  }
  return suggestionId ? { delivered: true, suggestionId } : { delivered: false };
}

async function policyCounts(
  userId: string,
  candidate: SuggestionCandidateRow
  ,client?: PoolClient
): Promise<{
  deliveredThisWeek: number;
  deliveredForSubjectRecently: boolean;
  dismissedForSubjectRecently: boolean;
  hasUnresolvedSuggestion: boolean;
}> {
  const executor = client ?? pool;
  const { rows } = await executor.query<{
    delivered_this_week: string;
    delivered_for_subject: boolean;
    dismissed_for_subject: boolean;
    unresolved: boolean;
  }>(
    `SELECT
       (SELECT COUNT(*)::text FROM suggestions
        WHERE user_id = $1 AND delivered_at > NOW() - INTERVAL '7 days') AS delivered_this_week,
        EXISTS (
          SELECT 1 FROM suggestions s
         JOIN suggestion_candidates c ON c.id = s.candidate_id
         WHERE s.user_id = $1 AND c.subject_key = $2
           AND s.delivered_at > NOW() - INTERVAL '7 days'
       ) AS delivered_for_subject,
       EXISTS (
         SELECT 1 FROM suggestions s
         JOIN suggestion_candidates c ON c.id = s.candidate_id
         WHERE s.user_id = $1 AND c.subject_key = $2
            AND (
              (s.status = 'not_now' AND s.decided_at > NOW() - ($3::int * INTERVAL '1 day'))
              OR (s.status = 'dismissed' AND s.decided_at > NOW() - ($4::int * INTERVAL '1 day'))
            )
        ) AS dismissed_for_subject,
       EXISTS (
         SELECT 1 FROM suggestions
         WHERE user_id = $1 AND status = 'delivered' AND expires_at > NOW()
       ) AS unresolved`,
    [
      userId,
      candidate.subject_key,
      suggestionCooldownDays.not_now,
      suggestionCooldownDays.dismissed
    ]
  );
  const row = rows[0];
  return {
    deliveredThisWeek: Number(row?.delivered_this_week ?? 0),
    deliveredForSubjectRecently: Boolean(row?.delivered_for_subject),
    dismissedForSubjectRecently: Boolean(row?.dismissed_for_subject),
    hasUnresolvedSuggestion: Boolean(row?.unresolved)
  };
}

async function insertSuggestionMessage(
  client: PoolClient,
  input: { assistantId: string; userId: string; content: Record<string, unknown> }
): Promise<{ id: string }> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO agent_messages
       (agent_id, user_id, role, content, source_refs)
     VALUES ($1, $2, 'agent', $3, '[]'::jsonb)
     RETURNING id`,
    [input.assistantId, input.userId, JSON.stringify(input.content)]
  );
  return rows[0]!;
}

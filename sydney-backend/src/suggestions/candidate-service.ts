import { createHash } from "node:crypto";
import { pool } from "../db/index.js";
import { getActiveConsent } from "../personalization/consent-service.js";
import { isSupportedConnectorId, safePublicUrl } from "./action-safety.js";
import { insertSuggestionCandidate } from "./repository.js";
import type { SuggestionCandidateRow } from "./types.js";

export async function generateRepeatedRequestCandidate(input: {
  userId: string;
  assistantId: string;
  sourceMessageId: string;
  currentText: string;
}): Promise<SuggestionCandidateRow | null> {
  if (!(await getActiveConsent(input.userId, "cuppet_activity"))) return null;
  const normalizedCurrent = normalizeRequest(input.currentText);
  if (!normalizedCurrent || normalizedCurrent.length < 12 || isSensitive(normalizedCurrent)) {
    return null;
  }

  const { rows } = await pool.query<{ body: string | null }>(
    `SELECT content #>> '{data,body}' AS body
     FROM agent_messages
     WHERE user_id = $1 AND agent_id = $2 AND role = 'user'
       AND created_at > NOW() - INTERVAL '30 days'
     ORDER BY created_at DESC
     LIMIT 50`,
    [input.userId, input.assistantId]
  );
  const requestCount = rows.reduce(
    (count, row) => count + (normalizeRequest(row.body ?? "") === normalizedCurrent ? 1 : 0),
    0
  );
  if (requestCount < 3) return null;

  const subjectKey = requestFingerprint(normalizedCurrent);
  const existing = await pool.query<{ id: string }>(
    `SELECT id
     FROM suggestion_candidates
     WHERE user_id = $1 AND generator_key = 'repeated_request'
        AND subject_key = $2
        AND status IN ('candidate', 'eligible', 'delivered', 'accepted')
        AND expires_at > NOW()
        AND created_at > NOW() - INTERVAL '7 days'
     LIMIT 1`,
    [input.userId, subjectKey]
  );
  if (existing.rows[0]) return null;

  return insertSuggestionCandidate({
    userId: input.userId,
    suggestionType: "agent_creation",
    generatorKey: "repeated_request",
    origin: "user_pattern",
    subjectType: "agent_type",
    subjectKey,
    title: "Make this automatic?",
    body:
      `You have made a similar request ${requestCount} times recently. ` +
      "Cuppet can prepare an agent to handle it automatically. Accepting will show a confirmation before anything is created.",
    actionType: "agent_creation",
    actionPayload: {
      source_message_id: input.sourceMessageId
    },
    reasonCodes: ["repeated_request"],
    evidenceSummary: {
      request_count: requestCount,
      window_days: 30,
      matched_subject: "repeated Assistant request"
    },
    relevanceScore: 0.86,
    confidenceScore: 0.84,
    interruptionCost: 0.1,
    consentPurposes: ["cuppet_activity"],
    expiresAt: new Date(Date.now() + 7 * 86_400_000)
  });
}

export async function generateAgentRefinementCandidate(input: {
  userId: string;
  sourceMessageId: string;
}): Promise<SuggestionCandidateRow | null> {
  if (!(await getActiveConsent(input.userId, "explicit_feedback"))) return null;
  const { rows } = await pool.query<{
    agent_id: string;
    agent_name: string;
    feedback_count: string;
  }>(
    `SELECT m.agent_id, a.name AS agent_name, COUNT(*)::text AS feedback_count
     FROM message_feedback f
     JOIN agent_messages m ON m.id = f.message_id AND m.user_id = f.user_id
     JOIN agents a ON a.id = m.agent_id AND a.user_id = m.user_id
     WHERE f.user_id = $1
       AND a.is_assistant = FALSE
       AND f.feedback_type IN ('not_useful', 'too_noisy', 'wrong_priority', 'not_relevant')
       AND f.created_at > NOW() - INTERVAL '30 days'
     GROUP BY m.agent_id, a.name
     HAVING COUNT(*) >= 3
     ORDER BY COUNT(*) DESC, MAX(f.created_at) DESC
     LIMIT 1`,
    [input.userId]
  );
  const row = rows[0];
  if (!row) return null;

  const subjectKey = `agent_refinement:${row.agent_id}`;
  const attentionReduction = Number(row.feedback_count) >= 5;
  const generatorKey = attentionReduction
    ? "attention_reduction"
    : "agent_feedback_refinement";
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM suggestion_candidates
      WHERE user_id = $1 AND generator_key = $3
         AND subject_key = $2
         AND status IN ('candidate', 'eligible', 'delivered', 'accepted')
         AND expires_at > NOW()
         AND created_at > NOW() - INTERVAL '30 days'
      LIMIT 1`,
    [input.userId, subjectKey, generatorKey]
  );
  if (existing.rows[0]) return null;

  const confirmedRoute = {
    kind: "agent_update",
    target: row.agent_name,
    description:
      "Make this agent less frequent and only include results that closely match its stated focus."
  };
  return insertSuggestionCandidate({
    userId: input.userId,
    suggestionType: attentionReduction ? "attention_reduction" : "agent_refinement",
    generatorKey,
    origin: "agent_improvement",
    subjectType: "agent_type",
    subjectKey,
    title: attentionReduction ? `Quiet ${row.agent_name}?` : `Tune ${row.agent_name}?`,
    body:
      `${row.agent_name} has produced several results you marked as unhelpful. ` +
      (attentionReduction
        ? "Cuppet can reduce the noise and make it stricter, with a confirmation before changing anything."
        : "Cuppet can make it quieter and stricter, with a confirmation before changing anything."),
    actionType: "agent_refinement",
    actionPayload: {
      source_message_id: input.sourceMessageId,
      confirmed_route: confirmedRoute
    },
    reasonCodes: attentionReduction
      ? ["repeated_agent_feedback", "attention_reduction"]
      : ["repeated_agent_feedback"],
    evidenceSummary: {
      agent_name: row.agent_name,
      feedback_count: Number(row.feedback_count),
      window_days: 30
    },
    relevanceScore: 0.84,
    confidenceScore: 0.82,
    interruptionCost: 0.08,
    consentPurposes: ["explicit_feedback"],
    expiresAt: new Date(Date.now() + 30 * 86_400_000)
  });
}

export async function generateAttentionReductionCandidate(input: {
  userId: string;
  sourceMessageId: string;
}): Promise<SuggestionCandidateRow | null> {
  const candidate = await generateAgentRefinementCandidate(input);
  return candidate?.suggestion_type === "attention_reduction" ? candidate : null;
}

export async function generateContextualCandidate(input: {
  userId: string;
  assistantId: string;
  sourceMessageId: string;
  currentText: string;
  responseContent?: Record<string, unknown>;
  sourceRefs?: unknown[];
}): Promise<SuggestionCandidateRow | null> {
  const candidates = await generateContextualCandidates(input);
  return candidates[0] ?? null;
}

export async function generateContextualCandidates(input: {
  userId: string;
  assistantId: string;
  sourceMessageId: string;
  currentText: string;
  responseContent?: Record<string, unknown>;
  sourceRefs?: unknown[];
}): Promise<SuggestionCandidateRow[]> {
  const candidates: SuggestionCandidateRow[] = [];
  const capabilityGap = await generateCapabilityGapCandidate(input);
  if (capabilityGap) candidates.push(capabilityGap);
  const refinement = await generateAgentRefinementCandidate(input);
  if (refinement) candidates.push(refinement);
  const repeated = await generateRepeatedRequestCandidate(input);
  if (repeated) candidates.push(repeated);
  const content = await generateContentSourceCandidate({
    userId: input.userId,
    sourceMessageId: input.sourceMessageId,
    sourceRefs: input.sourceRefs ?? []
  });
  if (content) candidates.push(content);
  return candidates;
}

export async function generateCapabilityGapCandidate(input: {
  userId: string;
  sourceMessageId: string;
  currentText?: string;
  responseContent?: Record<string, unknown>;
}): Promise<SuggestionCandidateRow | null> {
  if (!(await getActiveConsent(input.userId, "cuppet_activity"))) return null;
  const data = input.responseContent?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const actions = (data as Record<string, unknown>).actions;
  if (!Array.isArray(actions)) return null;
  const action = actions.find(
    (value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === "object" && !Array.isArray(value) &&
      (value as Record<string, unknown>).type === "connector_connect"
  );
  if (!action) return null;
  const connectorId = typeof action.connector_id === "string" ? action.connector_id.trim() : "";
  if (!isSupportedConnectorId(connectorId)) return null;
  const connectorName =
    typeof action.connector_name === "string" && action.connector_name.trim()
      ? action.connector_name.trim().slice(0, 80)
      : connectorId;
  const subjectKey = `connector:${connectorId.toLowerCase()}`;
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM suggestion_candidates
     WHERE user_id = $1 AND generator_key = 'capability_gap'
        AND subject_key = $2
        AND status IN ('candidate', 'eligible', 'delivered', 'accepted')
        AND expires_at > NOW()
        AND created_at > NOW() - INTERVAL '14 days'
     LIMIT 1`,
    [input.userId, subjectKey]
  );
  if (existing.rows[0]) return null;
  return insertSuggestionCandidate({
    userId: input.userId,
    suggestionType: "capability_connection",
    generatorKey: "capability_gap",
    origin: "capability_gap",
    subjectType: "capability",
    subjectKey,
    title: `Connect ${connectorName}?`,
    body:
      `This request needed ${connectorName}, but it is not connected. ` +
      "Cuppet can take you to the existing connection flow; it will not connect anything in the background.",
    actionType: "capability_connection",
    actionPayload: {
      source_message_id: input.sourceMessageId,
      connector_id: connectorId,
      connector_name: connectorName
    },
    reasonCodes: ["capability_gap", "current_request"],
    evidenceSummary: {
      connector_id: connectorId,
      connector_name: connectorName,
      data_categories: ["Current Assistant request"]
    },
    relevanceScore: 0.9,
    confidenceScore: 0.92,
    interruptionCost: 0.06,
    consentPurposes: ["cuppet_activity"],
    expiresAt: new Date(Date.now() + 14 * 86_400_000)
  });
}

export async function generateContentSourceCandidate(input: {
  userId: string;
  sourceMessageId: string;
  sourceRefs: unknown[];
}): Promise<SuggestionCandidateRow | null> {
  const source = input.sourceRefs
    .map(readPublicSource)
    .find((value): value is PublicSource => value !== null);
  if (!source) return null;

  const { rows } = await pool.query<{
    dimension: "topic" | "source";
    key: string;
    weight: number | string;
    confidence: number | string;
    derived_from: string[];
  }>(
    `SELECT dimension, key, weight, confidence, derived_from
     FROM preference_profile_items
     WHERE user_id = $1
        AND dimension IN ('topic', 'source')
        AND weight >= 0.65
        AND confidence >= 0.6
        AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY weight DESC, confidence DESC, updated_at DESC
     LIMIT 20`,
    [input.userId]
  );
  const item = rows.find((candidate) => sourceMatchesProfile(source, candidate.key));
  if (!item) return null;

  const consentPurposes = profileConsentPurposes(item.derived_from);
  const consents = await Promise.all(
    consentPurposes.map((purpose) => getActiveConsent(input.userId, purpose))
  );
  if (!consents.every(Boolean)) return null;

  const subjectKey = `content:${requestFingerprint(`${source.url}:${item.dimension}:${item.key}`)}`;
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM suggestion_candidates
      WHERE user_id = $1 AND generator_key = 'content_source'
        AND subject_key = $2
        AND status IN ('candidate', 'eligible', 'delivered', 'accepted')
        AND expires_at > NOW()
        AND created_at > NOW() - INTERVAL '30 days'
     LIMIT 1`,
    [input.userId, subjectKey]
  );
  if (existing.rows[0]) return null;

  const label = source.title || source.host;
  return insertSuggestionCandidate({
    userId: input.userId,
    suggestionType: "content",
    generatorKey: "content_source",
    origin: "user_interest",
    subjectType: item.dimension,
    subjectKey,
    title: `Worth a closer look: ${label}`,
    body: `This public source matches your interest in ${item.key.replace(/_/g, " ")}. ` +
      "I can place the link in this Assistant thread for you to review; I will not follow or save the source automatically.",
    actionType: "content_open",
    actionPayload: {
      source_message_id: input.sourceMessageId,
      url: source.url,
      title: label,
      host: source.host,
      preference_subject_type: item.dimension,
      preference_subject_key: item.key
    },
    reasonCodes: ["public_source_match", "current_context"],
    evidenceSummary: {
      dimension: item.dimension,
      profile_key: item.key,
      profile_weight: Number(item.weight),
      profile_confidence: Number(item.confidence),
      source_title: source.title,
      source_host: source.host,
      data_categories: consentPurposes.map(dataCategoryForPurpose)
    },
    relevanceScore: Math.min(0.92, Number(item.weight) * 0.9),
    confidenceScore: Math.min(0.9, Number(item.confidence)),
    interruptionCost: 0.08,
    consentPurposes,
    expiresAt: new Date(Date.now() + 7 * 86_400_000)
  });
}

export async function generateProfileInterestCandidate(input: {
  userId: string;
  sourceMessageId: string;
}): Promise<SuggestionCandidateRow | null> {
  const { rows } = await pool.query<{
    dimension: "topic" | "source";
    key: string;
    weight: number | string;
    confidence: number | string;
    derived_from: string[];
  }>(
    `SELECT dimension, key, weight, confidence, derived_from
     FROM preference_profile_items
     WHERE user_id = $1
        AND dimension IN ('topic', 'source')
        AND weight >= 0.65
        AND confidence >= 0.6
        AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY weight DESC, confidence DESC, updated_at DESC
     LIMIT 1`,
    [input.userId]
  );
  const item = rows[0];
  if (!item) return null;
   const consentPurposes = profileConsentPurposes(item.derived_from);
   const consents = await Promise.all(
     consentPurposes.map((purpose) => getActiveConsent(input.userId, purpose))
   );
   if (!consents.every(Boolean)) return null;
  const subjectKey = `interest:${item.dimension}:${item.key}`;
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM suggestion_candidates
     WHERE user_id = $1 AND generator_key = 'profile_interest'
        AND subject_key = $2
        AND status IN ('candidate', 'eligible', 'delivered', 'accepted')
        AND expires_at > NOW()
        AND created_at > NOW() - INTERVAL '30 days'
     LIMIT 1`,
    [input.userId, subjectKey]
  );
  if (existing.rows[0]) return null;
  const label = item.key.replace(/_/g, " ");
  const requestText =
    item.dimension === "source"
      ? `Create a focused daily brief from ${label} updates.`
      : `Create a focused daily brief about ${label}.`;
  return insertSuggestionCandidate({
    userId: input.userId,
    suggestionType: "content",
    generatorKey: "profile_interest",
    origin: "user_interest",
    subjectType: item.dimension,
    subjectKey,
    title: `Keep ${label} useful?`,
    body:
      `Your profile shows a sustained interest in ${label}. ` +
      "Cuppet can prepare a focused agent, but it will show the normal review before creation.",
    actionType: "agent_creation",
    actionPayload: {
      request_text: requestText.slice(0, 800),
      source_message_id: input.sourceMessageId,
      preference_subject_type: item.dimension,
      preference_subject_key: item.key
    },
    reasonCodes: ["stable_interest", "focused_content"],
    evidenceSummary: {
      dimension: item.dimension,
      profile_weight: Number(item.weight),
      profile_confidence: Number(item.confidence),
      data_categories: consentPurposes.map(dataCategoryForPurpose)
    },
    relevanceScore: Math.min(0.9, Number(item.weight)),
    confidenceScore: Math.min(0.9, Number(item.confidence)),
    interruptionCost: 0.12,
    consentPurposes,
    expiresAt: new Date(Date.now() + 30 * 86_400_000)
  });
}

export function normalizeRequest(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(?:please|could you|can you|would you|again)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function requestFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 48);
}

type PublicSource = {
  url: string;
  title: string;
  host: string;
};

function readPublicSource(value: unknown): PublicSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url.trim() : "";
   const safeUrl = safePublicUrl(url);
   if (!safeUrl) return null;
   let parsed: URL;
   try {
     parsed = new URL(safeUrl);
  } catch {
    return null;
  }
  if (!parsed.hostname || parsed.username || parsed.password) return null;
  const title = firstText(record.title, record.name, record.label) ?? "Public source";
  return {
     url: safeUrl,
    title: title.slice(0, 160),
    host: parsed.hostname.toLowerCase()
  };
}

function sourceMatchesProfile(source: PublicSource, profileKey: string): boolean {
  const profile = profileKey.toLowerCase().replace(/_/g, " ");
  const sourceText = `${source.title} ${source.host}`.toLowerCase();
  if (source.host.includes(profile.replace(/\s+/g, ""))) return true;
  const terms = profile
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 4);
  return terms.length > 0 && terms.some((term) => sourceText.includes(term));
}

function profileConsentPurposes(derivedFrom: string[]): Array<"explicit_feedback" | "cuppet_activity" | "connected_content" | "browser_activity" | "cross_source"> {
  const purposes = new Set<"explicit_feedback" | "cuppet_activity" | "connected_content" | "browser_activity" | "cross_source">();
  for (const provenance of derivedFrom) {
    if (provenance === "connected_content") purposes.add("connected_content");
    else if (provenance === "browser_activity") purposes.add("browser_activity");
    else if (provenance === "cross_source") purposes.add("cross_source");
    else if (provenance === "assistant_feedback" || provenance === "confirmed_memory" || provenance === "suggestion_decision" || provenance === "explicit_exclusion" || provenance === "user_edit") {
      purposes.add("explicit_feedback");
    } else {
      purposes.add("cuppet_activity");
    }
  }
  return purposes.size > 0 ? [...purposes] : ["explicit_feedback"];
}

function dataCategoryForPurpose(purpose: string): string {
  switch (purpose) {
    case "explicit_feedback":
      return "Direct feedback you gave Cuppet";
    case "connected_content":
      return "Connected account patterns";
    case "browser_activity":
      return "Browser activity";
    case "cross_source":
      return "Combined authorized sources";
    default:
      return "Activity inside Cuppet";
  }
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.trim();
    if (text) return text;
  }
  return null;
}


function isSensitive(value: string): boolean {
  return /\b(password|passcode|token|secret|private key|one[- ]time code|ssn|social security|credit card|bank account|account number|passport|medical record|diagnosis|prescription|health condition|date of birth|home address|phone number)\b/i.test(
    value
  );
}

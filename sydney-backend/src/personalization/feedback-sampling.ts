import { pool } from "../db/index.js";
import { getActiveConsent, getPersonalizationSettings } from "./consent-service.js";

export type AgentResultType =
  | "substantive"
  | "all_clear"
  | "partial"
  | "error"
  | "system";

export type FeedbackRequestReason =
  | "first_result"
  | "agent_changed"
  | "low_confidence"
  | "new_output_pattern"
  | "periodic_sample";

export interface FeedbackSamplingInput {
  userId: string;
  agentId: string;
  messageId: string;

  resultType: AgentResultType;

  isFirstSuccessfulResult: boolean;
  agentRecentlyChanged: boolean;
  relevanceConfidence?: number;
  outputFingerprint?: string;
  isNewOutputPattern?: boolean;
}

export interface FeedbackSamplingDecision {
  requestFeedback: boolean;
  reason?: FeedbackRequestReason;
}

export async function hasExplicitFeedbackConsent(userId: string): Promise<boolean> {
  const settings = await getPersonalizationSettings(userId);
  if (!settings.enabled || settings.learning_paused) {
    return false;
  }
  const consent = await getActiveConsent(userId, "explicit_feedback");
  return consent?.status === "granted";
}

export async function reachedUserWeeklyLimit(userId: string, maxPerWeek = 2): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM feedback_requests
     WHERE user_id = $1 AND requested_at >= NOW() - INTERVAL '7 days'`,
    [userId]
  );
  return parseInt(rows[0]?.count ?? "0", 10) >= maxPerWeek;
}

export async function promptedAgentWithinDays(agentId: string, days = 7): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM feedback_requests
     WHERE agent_id = $1 AND requested_at >= NOW() - INTERVAL '${days} days'`,
    [agentId]
  );
  return parseInt(rows[0]?.count ?? "0", 10) > 0;
}

export async function hasUnansweredPromptWithinDays(userId: string, days = 14): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM feedback_requests
     WHERE user_id = $1 AND responded_at IS NULL AND requested_at >= NOW() - INTERVAL '${days} days'`,
    [userId]
  );
  return parseInt(rows[0]?.count ?? "0", 10) > 0;
}

export async function hasActiveNegativeFeedbackCooldown(
  agentId: string,
  isAgentChanged: boolean,
  isNewOutputPattern: boolean
): Promise<boolean> {
  if (isAgentChanged || isNewOutputPattern) {
    return false;
  }
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM feedback_requests
     WHERE agent_id = $1 AND feedback_type = 'not_useful'`,
    [agentId]
  );
  return parseInt(rows[0]?.count ?? "0", 10) > 0;
}

export function isDeterministicPeriodicSample(
  agentId: string,
  messageId: string,
  sampleRate = 6
): boolean {
  const combined = `${agentId}:${messageId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % sampleRate === 0;
}

export async function shouldRequestFeedback(
  input: FeedbackSamplingInput
): Promise<FeedbackSamplingDecision> {
  if (input.resultType !== "substantive") {
    return { requestFeedback: false };
  }

  if (!(await hasExplicitFeedbackConsent(input.userId))) {
    return { requestFeedback: false };
  }

  if (await reachedUserWeeklyLimit(input.userId, 2)) {
    return { requestFeedback: false };
  }

  if (await promptedAgentWithinDays(input.agentId, 7)) {
    return { requestFeedback: false };
  }

  if (await hasUnansweredPromptWithinDays(input.userId, 14)) {
    return { requestFeedback: false };
  }

  if (
    await hasActiveNegativeFeedbackCooldown(
      input.agentId,
      input.agentRecentlyChanged,
      input.isNewOutputPattern ?? false
    )
  ) {
    return { requestFeedback: false };
  }

  if (input.isFirstSuccessfulResult) {
    return {
      requestFeedback: true,
      reason: "first_result"
    };
  }

  if (input.agentRecentlyChanged) {
    return {
      requestFeedback: true,
      reason: "agent_changed"
    };
  }

  if (
    input.relevanceConfidence !== undefined &&
    input.relevanceConfidence < 0.55
  ) {
    return {
      requestFeedback: true,
      reason: "low_confidence"
    };
  }

  if (input.isNewOutputPattern) {
    return {
      requestFeedback: true,
      reason: "new_output_pattern"
    };
  }

  if (
    isDeterministicPeriodicSample(
      input.agentId,
      input.messageId,
      6
    )
  ) {
    return {
      requestFeedback: true,
      reason: "periodic_sample"
    };
  }

  return {
    requestFeedback: false
  };
}

export async function recordFeedbackRequest(input: {
  messageId: string;
  userId: string;
  agentId: string;
  reason: FeedbackRequestReason;
}): Promise<void> {
  await pool.query(
    `INSERT INTO feedback_requests (message_id, user_id, agent_id, reason, requested_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (message_id) DO NOTHING`,
    [input.messageId, input.userId, input.agentId, input.reason]
  );
}

export async function updateFeedbackRequestResponse(input: {
  messageId: string;
  feedbackType: string;
}): Promise<void> {
  await pool.query(
    `UPDATE feedback_requests
     SET responded_at = NOW(), feedback_type = $2
     WHERE message_id = $1`,
    [input.messageId, input.feedbackType]
  );
}

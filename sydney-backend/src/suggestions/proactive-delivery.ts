import { pool } from "../db/index.js";
import { sendPushNotification } from "../notifications/push.js";
import { getActiveConsent, getPersonalizationSettings } from "../personalization/consent-service.js";
import { preferenceVectorStore } from "../personalization/vector-store.js";
import { recordPersonalizationProductEvent } from "../personalization/analytics.js";
import { generateProfileInterestCandidate } from "./candidate-service.js";
import { deliverCandidate } from "./delivery-service.js";
import {
  evaluateSuggestionPolicy,
  suggestionCooldownDays,
  suggestionThresholds
} from "./policy.js";
import { scoreSuggestion } from "./ranker.js";
import type { SuggestionCandidateRow } from "./types.js";

export async function evaluateAndDeliverProactiveSuggestion(
  userId: string
): Promise<{ delivered: boolean; suggestionId?: string }> {
  const settings = await getPersonalizationSettings(userId);
  if (!settings.enabled || settings.learning_paused || !settings.proactive) {
    return { delivered: false };
  }
  if (await isQuietHours(userId, settings.quiet_hours_start, settings.quiet_hours_end)) {
    return { delivered: false };
  }
  const assistant = await pool.query<{ id: string }>(
    `SELECT id FROM agents
     WHERE user_id = $1 AND is_assistant = TRUE AND status = 'active'
     ORDER BY created_at ASC LIMIT 1`,
    [userId]
  );
  const assistantId = assistant.rows[0]?.id;
  if (!assistantId) return { delivered: false };
  if (await hasPoorTiming(userId, assistantId)) return { delivered: false };
  const source = await pool.query<{ id: string }>(
    `SELECT id FROM agent_messages
     WHERE user_id = $1 AND agent_id = $2 AND role = 'user'
     ORDER BY created_at DESC LIMIT 1`,
    [userId, assistantId]
  );
  const sourceMessageId = source.rows[0]?.id;
  if (!sourceMessageId) return { delivered: false };

  const candidate = await generateProfileInterestCandidate({ userId, sourceMessageId });
  if (!candidate) return { delivered: false };
  const consents = await Promise.all(
    candidate.consent_purposes.map((purpose) => getActiveConsent(userId, purpose))
  );
  const semanticInterestMatch = await preferenceVectorStore
    .similarity(
      userId,
      "suggestions",
      `${candidate.title} ${candidate.body} ${String(candidate.evidence_summary.profile_key ?? "")}`
    )
    .catch(() => 0);
  const score = scoreSuggestion({ candidate, semanticInterestMatch });
  const counts = await proactivePolicyCounts(userId, candidate);
  const decision = evaluateSuggestionPolicy({
    score: score.finalScore,
    confidence: Number(candidate.confidence_score),
    frequency: settings.frequency,
    hasConsent: consents.every(Boolean),
     minimumScore: suggestionThresholds.proactive,
    ...counts
  });
  if (!decision.eligible) {
    await pool.query(
      `UPDATE suggestion_candidates
       SET status = 'suppressed', score_breakdown = $2
       WHERE id = $1 AND status IN ('candidate', 'eligible')`,
      [candidate.id, JSON.stringify({ ...score, suppression_reason: decision.suppressionReason })]
    );
    return { delivered: false };
  }
  await pool.query(
    `UPDATE suggestion_candidates
     SET status = 'eligible', score_breakdown = $2
     WHERE id = $1 AND status = 'candidate'`,
    [candidate.id, JSON.stringify(score)]
  );

  const result = await deliverCandidate({
    candidate,
    score,
    userId,
    assistantId,
    sourceMessageId,
    deliverySurface: "proactive",
    frequency: settings.frequency
  });
   if (result.delivered && result.suggestionId && settings.push && score.finalScore >= suggestionThresholds.push) {
    const pushCounts = await pool.query<{ sent: string }>(
      `SELECT COUNT(*)::text AS sent
       FROM suggestions
       WHERE user_id = $1 AND push_sent_at > NOW() - INTERVAL '7 days'`,
      [userId]
    );
    if (Number(pushCounts.rows[0]?.sent ?? 0) < 1) {
      const push = await sendPushNotification(pool, userId, {
        title: candidate.title,
        body: candidate.body,
        data: {
          type: "assistant_suggestion",
          suggestion_id: result.suggestionId,
          agent_id: assistantId
        }
      }).catch(() => null);
      if (push?.sentCount && push.sentCount > 0) {
        await pool.query(
          `UPDATE suggestions
            SET push_sent_at = NOW()
            WHERE id = $1 AND user_id = $2`,
          [result.suggestionId, userId]
        );
        void recordPersonalizationProductEvent({
          userId,
          eventName: "suggestion_push_sent",
          suggestionId: result.suggestionId,
          metadata: { delivery_surface: "push" }
        }).catch(() => undefined);
      }
    }
  }
  return result;
}

export async function stageDeferredSuggestion(userId: string): Promise<boolean> {
  const settings = await getPersonalizationSettings(userId);
  if (!settings.enabled || settings.learning_paused || settings.proactive || !settings.in_chat) {
    return false;
  }
  const assistant = await pool.query<{ id: string }>(
    `SELECT id FROM agents
     WHERE user_id = $1 AND is_assistant = TRUE AND status = 'active'
     ORDER BY created_at ASC LIMIT 1`,
    [userId]
  );
  const assistantId = assistant.rows[0]?.id;
  if (!assistantId) return false;
  const source = await pool.query<{ id: string }>(
    `SELECT id FROM agent_messages
     WHERE user_id = $1 AND agent_id = $2 AND role = 'user'
     ORDER BY created_at DESC LIMIT 1`,
    [userId, assistantId]
  );
  const sourceMessageId = source.rows[0]?.id;
  if (!sourceMessageId) return false;
  const candidate = await generateProfileInterestCandidate({ userId, sourceMessageId });
  return Boolean(candidate);
}

export async function evaluateScheduledProactiveSuggestions(
  limit = 100
): Promise<{ evaluated: number; delivered: number }> {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT user_id
     FROM personalization_settings
     WHERE enabled = TRUE
       AND learning_paused = FALSE
       AND proactive = TRUE
     ORDER BY updated_at ASC
     LIMIT $1`,
    [limit]
  );
  let delivered = 0;
  for (const row of rows) {
    const result = await evaluateAndDeliverProactiveSuggestion(row.user_id);
    if (result.delivered) delivered += 1;
  }
  return { evaluated: rows.length, delivered };
}

async function proactivePolicyCounts(
  userId: string,
  candidate: SuggestionCandidateRow
): Promise<{
  deliveredThisWeek: number;
  deliveredForSubjectRecently: boolean;
  dismissedForSubjectRecently: boolean;
  hasUnresolvedSuggestion: boolean;
}> {
  const { rows } = await pool.query<{
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

async function isQuietHours(
  userId: string,
  start: string,
  end: string
): Promise<boolean> {
  try {
    const { rows } = await pool.query<{ local_time: string }>(
      `SELECT (NOW() AT TIME ZONE COALESCE(NULLIF(time_zone, ''), 'UTC'))::time::text AS local_time
       FROM users WHERE id = $1`,
      [userId]
    );
    const current = timeToMinutes(rows[0]?.local_time ?? "00:00:00");
    const quietStart = timeToMinutes(start);
    const quietEnd = timeToMinutes(end);
    if (quietStart === quietEnd) return false;
    return quietStart < quietEnd
      ? current >= quietStart && current < quietEnd
      : current >= quietStart || current < quietEnd;
  } catch {
    return true;
  }
}

async function hasPoorTiming(userId: string, assistantId: string): Promise<boolean> {
  const [pending, latest] = await Promise.all([
    pool.query(
      `SELECT 1 FROM assistant_pending_actions
       WHERE user_id = $1 AND assistant_id = $2
         AND consumed_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [userId, assistantId]
    ),
    pool.query<{ role: string; body: string | null }>(
      `SELECT role, content #>> '{data,body}' AS body
       FROM agent_messages
       WHERE user_id = $1 AND agent_id = $2
       ORDER BY created_at DESC
       LIMIT 2`,
      [userId, assistantId]
    )
  ]);
  if (pending.rows[0]) return true;
  return latest.rows.some((row) =>
    /\b(password|passcode|token|secret|private key|one[- ]time code|ssn|credit card)\b/i.test(row.body ?? "") ||
    /\b(?:urgent|error|failed|failure|couldn['’]t|authorization|access denied|reconnect)\b/i.test(row.body ?? "")
  );
}

function timeToMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

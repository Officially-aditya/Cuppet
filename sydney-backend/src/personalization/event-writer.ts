import { pool } from "../db/index.js";
import { enqueuePersonalizationOutbox } from "../queue/index.js";
import { getActiveConsent, getPersonalizationSettings } from "./consent-service.js";
import { isSafeSubjectKey, normalizeSubjectKey } from "./subject-safety.js";
import type {
  PreferenceEventInput,
  PreferenceEventWriteResult,
  PreferenceDimension
} from "./types.js";

const sensitivePropertyKeys = new Set([
  "body",
  "content",
  "email_body",
  "document",
  "html",
  "raw",
  "text",
  "browser_page",
  "conversation"
]);

export async function recordPreferenceEvent(
  input: PreferenceEventInput
): Promise<PreferenceEventWriteResult> {
  const settings = await getPersonalizationSettings(input.userId);
  if (!settings.enabled || settings.learning_paused) {
    return { stored: false, reason: "paused" };
  }

  const consent = await getActiveConsent(input.userId, input.purpose);
  if (!consent) return { stored: false, reason: "no_consent" };

  const subjectKey = normalizeSubjectKey(input.subjectKey);
  const strength = clamp(input.strength, 0, 1);
  if (!subjectKey || !isSafeSubjectKey(input.subjectKey) || !Number.isFinite(strength)) {
    throw new Error("Invalid preference event subject or strength.");
  }

  const client = await pool.connect();
  let eventId = "";
  let outboxId = "";
  try {
    await client.query("BEGIN");
    const event = await client.query<{ id: string }>(
      `INSERT INTO preference_events
         (user_id, consent_id, event_type, subject_type, subject_key,
          polarity, strength, provenance_type, provenance_id, service_key,
          agent_id, message_id, properties, occurred_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        input.userId,
        consent.id,
        input.eventType.slice(0, 80),
        input.subjectType,
        subjectKey,
        input.polarity,
        strength,
        input.provenanceType.slice(0, 80),
        input.provenanceId?.slice(0, 180) ?? null,
        input.serviceKey?.slice(0, 120) ?? null,
        input.agentId ?? null,
        input.messageId ?? null,
        JSON.stringify(minimizeProperties(input.properties)),
        input.occurredAt ?? new Date(),
        input.expiresAt ?? null
      ]
    );
    eventId = event.rows[0]?.id ?? "";
    if (!eventId) {
      const existing = await client.query<{ id: string }>(
        `SELECT id
         FROM preference_events
         WHERE user_id = $1
           AND provenance_type = $2
           AND provenance_id = $3
           AND subject_type = $4
           AND subject_key = $5
         LIMIT 1`,
        [input.userId, input.provenanceType, input.provenanceId ?? null, input.subjectType, subjectKey]
      );
      eventId = existing.rows[0]?.id ?? "";
    }
    if (!eventId) throw new Error("Preference event could not be persisted.");
    const eventWasCreated = event.rows.length > 0;
    if (!eventWasCreated) {
      await client.query("COMMIT");
      return { stored: true, eventId, outboxId: "" };
    }
    const outbox = await client.query<{ id: string }>(
      `INSERT INTO personalization_outbox (user_id, event_name, payload)
       VALUES ($1, 'preference_event.created', $2)
       RETURNING id`,
      [input.userId, JSON.stringify({ event_id: eventId })]
    );
    outboxId = outbox.rows[0]!.id;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  await enqueuePersonalizationOutbox(outboxId).catch(() => undefined);
  return { stored: true, eventId, outboxId };
}

export async function removePreferenceEventsByProvenance(
  userId: string,
  provenanceType: string,
  provenanceId: string
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM preference_events
     WHERE user_id = $1 AND provenance_type = $2 AND provenance_id = $3`,
    [userId, provenanceType, provenanceId]
  );
  if ((result.rowCount ?? 0) > 0) {
    const outbox = await pool.query<{ id: string }>(
      `INSERT INTO personalization_outbox (user_id, event_name, payload)
       VALUES ($1, 'preference_profile.rebuild', '{}'::jsonb)
       RETURNING id`,
      [userId]
    );
    const outboxId = outbox.rows[0]?.id;
    if (outboxId) await enqueuePersonalizationOutbox(outboxId).catch(() => undefined);
  }
  return result.rowCount ?? 0;
}

export async function removePreferenceEventsByProvenanceType(
  userId: string,
  provenanceType: string
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM preference_events
     WHERE user_id = $1 AND provenance_type = $2`,
    [userId, provenanceType]
  );
  if ((result.rowCount ?? 0) > 0) {
    const outbox = await pool.query<{ id: string }>(
      `INSERT INTO personalization_outbox (user_id, event_name, payload)
       VALUES ($1, 'preference_profile.rebuild', '{}'::jsonb)
       RETURNING id`,
      [userId]
    );
    const outboxId = outbox.rows[0]?.id;
    if (outboxId) await enqueuePersonalizationOutbox(outboxId).catch(() => undefined);
  }
  return result.rowCount ?? 0;
}

export async function removePreferenceEventsByPurpose(
  userId: string,
  purpose: string
): Promise<number> {
  const result = await pool.query(
    `DELETE FROM preference_events e
     USING personalization_consents c
     WHERE e.user_id = $1
       AND e.consent_id = c.id
       AND c.user_id = $1
       AND c.purpose = $2`,
    [userId, purpose]
  );
  if ((result.rowCount ?? 0) > 0) {
    const outbox = await pool.query<{ id: string }>(
      `INSERT INTO personalization_outbox (user_id, event_name, payload)
       VALUES ($1, 'preference_profile.rebuild', '{}'::jsonb)
       RETURNING id`,
      [userId]
    );
    const outboxId = outbox.rows[0]?.id;
    if (outboxId) await enqueuePersonalizationOutbox(outboxId).catch(() => undefined);
  }
  return result.rowCount ?? 0;
}

function minimizeProperties(
  properties: Record<string, unknown> | undefined
): Record<string, string | number | boolean> {
  if (!properties) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (sensitivePropertyKeys.has(key.toLowerCase())) continue;
    if (typeof value === "string") {
      result[key.slice(0, 60)] = value.slice(0, 160);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      result[key.slice(0, 60)] = value;
    } else if (typeof value === "boolean") {
      result[key.slice(0, 60)] = value;
    }
  }
  return result;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export type PreferenceDimensionName = PreferenceDimension;

import { pool } from "../db/index.js";
import { enqueuePersonalizationOutbox } from "../queue/index.js";
import {
  personalizationPurposes,
  preferenceDimensions,
  type PreferenceDimension,
  type PreferenceProfileItem
} from "./types.js";
import { isSafeSubjectKey } from "./subject-safety.js";
import { preferenceVectorStore } from "./vector-store.js";

type EventRow = {
  subject_type: PreferenceDimension;
  subject_key: string;
  polarity: number;
  strength: number | string;
  event_type: string;
  provenance_type: string;
  occurred_at: Date | string;
  expires_at: Date | string | null;
};

type Aggregate = {
  dimension: PreferenceDimension;
  key: string;
  weight: number;
  confidence: number;
  evidenceCount: number;
  strongestEvidenceType: string;
  strongestEvidenceScore: number;
  derivedFrom: Set<string>;
  firstObservedAt: Date | string;
  lastObservedAt: Date | string;
  expiresAt: Date | string | null;
  explicitPositive: boolean;
  explicitNegative: boolean;
  metadata: Record<string, unknown>;
};

const explicitEvidence = new Set([
  "assistant_feedback",
  "user_instruction",
  "confirmed_memory",
  "suggestion_decision",
  "explicit_exclusion"
]);

export async function rebuildPreferenceProfile(userId: string): Promise<number> {
  const { rows } = await pool.query<EventRow>(
    `WITH active_consents AS (
       SELECT DISTINCT ON (purpose) id, purpose, status
       FROM personalization_consents
       WHERE user_id = $1
       ORDER BY purpose, created_at DESC
     )
     SELECT e.subject_type, e.subject_key, e.polarity, e.strength,
            e.event_type, e.provenance_type, e.occurred_at, e.expires_at
     FROM preference_events e
     JOIN active_consents c ON c.id = e.consent_id
     WHERE e.user_id = $1
       AND c.status = 'granted'
       AND (e.expires_at IS NULL OR e.expires_at > NOW())
     ORDER BY e.occurred_at ASC`,
    [userId]
  );

  const aggregates = new Map<string, Aggregate>();
  for (const event of rows) {
    if (!preferenceDimensions.includes(event.subject_type)) continue;
    const key = `${event.subject_type}:${event.subject_key}`;
    const strength = Number(event.strength);
    const explicit = explicitEvidence.has(event.provenance_type);
    const ageDays = Math.max(
      0,
      (Date.now() - new Date(event.occurred_at).getTime()) / 86_400_000
    );
    const decay = explicit ? Math.pow(0.995, ageDays) : Math.pow(0.5, ageDays / 30);
    const contribution = Number(event.polarity) * strength * decay;
    const evidenceScore = strength * decay;
    const existing = aggregates.get(key);
    if (!existing) {
      aggregates.set(key, {
        dimension: event.subject_type,
        key: event.subject_key,
        weight: contribution,
        confidence: explicit ? 1 : 0.35,
        evidenceCount: 1,
        strongestEvidenceType: event.event_type,
        strongestEvidenceScore: evidenceScore,
        derivedFrom: new Set([event.provenance_type]),
        firstObservedAt: event.occurred_at,
        lastObservedAt: event.occurred_at,
        expiresAt: event.expires_at,
        explicitPositive: explicit && event.polarity > 0,
        explicitNegative: explicit && event.polarity < 0,
        metadata: {}
      });
      continue;
    }

    existing.weight += contribution;
    existing.evidenceCount += 1;
    existing.confidence = Math.min(
      1,
      existing.confidence + (explicit ? 0.12 : 0.07)
    );
    existing.derivedFrom.add(event.provenance_type);
    existing.lastObservedAt = event.occurred_at;
    existing.expiresAt = laterExpiry(existing.expiresAt, event.expires_at);
    existing.explicitPositive ||= explicit && event.polarity > 0;
    existing.explicitNegative ||= explicit && event.polarity < 0;
    if (evidenceScore > existing.strongestEvidenceScore) {
      existing.strongestEvidenceScore = evidenceScore;
      existing.strongestEvidenceType = event.event_type;
    }
  }

  const exclusions = await pool.query<{
    id: string;
    subject_type: PreferenceDimension;
    subject_key: string;
    created_at: Date | string;
  }>(
    `SELECT id, subject_type, subject_key, created_at
     FROM suggestion_exclusions
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  for (const exclusion of exclusions.rows) {
    aggregates.set(`exclusion:${exclusion.subject_type}:${exclusion.subject_key}`, {
      dimension: "exclusion",
      key: `${exclusion.subject_type}:${exclusion.subject_key}`,
      weight: -1,
      confidence: 1,
      evidenceCount: 1,
      strongestEvidenceType: "explicit_exclusion",
      strongestEvidenceScore: 1,
      derivedFrom: new Set(["explicit_exclusion"]),
      firstObservedAt: exclusion.created_at,
      lastObservedAt: exclusion.created_at,
      expiresAt: null,
      explicitPositive: false,
      explicitNegative: true,
      metadata: {
        durable_exclusion: true,
        exclusion_id: exclusion.id,
        subject_type: exclusion.subject_type,
        subject_key: exclusion.subject_key
      }
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext('preference_profile'))",
      [userId]
    );
    await client.query(
      `DELETE FROM preference_profile_items
       WHERE user_id = $1
         AND COALESCE(metadata->>'user_edited', 'false') <> 'true'`,
      [userId]
    );
    for (const aggregate of aggregates.values()) {
      const weight = clamp(
        aggregate.explicitNegative ? Math.min(aggregate.weight, -0.65) : aggregate.weight,
        -1,
        1
      );
      if (Math.abs(weight) < 0.03) continue;
      await client.query(
        `INSERT INTO preference_profile_items
           (user_id, dimension, key, weight, confidence, evidence_count,
            strongest_evidence_type, derived_from, first_observed_at,
            last_observed_at, expires_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (user_id, dimension, key) DO UPDATE SET
           weight = EXCLUDED.weight,
           confidence = EXCLUDED.confidence,
           evidence_count = EXCLUDED.evidence_count,
           strongest_evidence_type = EXCLUDED.strongest_evidence_type,
           derived_from = EXCLUDED.derived_from,
           first_observed_at = EXCLUDED.first_observed_at,
           last_observed_at = EXCLUDED.last_observed_at,
           expires_at = EXCLUDED.expires_at,
           metadata = EXCLUDED.metadata,
           updated_at = NOW()
         WHERE COALESCE(preference_profile_items.metadata->>'user_edited', 'false') <> 'true'`,
        [
          userId,
          aggregate.dimension,
          aggregate.key,
          weight,
          Math.min(1, aggregate.confidence),
          aggregate.evidenceCount,
          aggregate.strongestEvidenceType,
          [...aggregate.derivedFrom],
          aggregate.firstObservedAt,
          aggregate.lastObservedAt,
          aggregate.expiresAt,
          JSON.stringify({
            explicit_positive: aggregate.explicitPositive,
            explicit_negative: aggregate.explicitNegative,
            ...aggregate.metadata
          })
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  try {
    await preferenceVectorStore.upsertUserInterestVector(
      userId,
      "suggestions",
      await listPreferenceProfile(userId)
    );
  } catch (error) {
    // Ranking can safely fall back to structured profile matching if vectors lag.
    console.error("Preference vector refresh failed:", error);
  }
  return aggregates.size;
}

export async function listPreferenceProfile(
  userId: string
): Promise<PreferenceProfileItem[]> {
  const { rows } = await pool.query<PreferenceProfileItem>(
    `SELECT id, dimension, key, weight, confidence, evidence_count,
            strongest_evidence_type, derived_from, first_observed_at,
            last_observed_at, expires_at, metadata, updated_at
      FROM preference_profile_items
      WHERE user_id = $1
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY dimension, weight DESC, updated_at DESC`,
    [userId]
  );
  return rows;
}

export async function updatePreferenceProfileItem(
  userId: string,
  itemId: string,
  input: { weight?: number; key?: string }
): Promise<PreferenceProfileItem | null> {
  const weight = input.weight === undefined ? null : clamp(input.weight, -1, 1);
  const rawKey = input.key?.trim() ?? null;
  if (rawKey && !isSafeSubjectKey(rawKey)) return null;
  const key = rawKey?.toLowerCase().replace(/\s+/g, "_").slice(0, 120) ?? null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{
      dimension: string;
      key: string;
      metadata: Record<string, unknown>;
    }>(
      `SELECT dimension, key, metadata FROM preference_profile_items
       WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [itemId, userId]
    );
    const previous = existing.rows[0];
    if (!previous) {
      await client.query("ROLLBACK");
      return null;
    }
    if (previous.dimension === "exclusion") {
      await client.query("ROLLBACK");
      return null;
    }
    if (key && key !== previous.key) {
      await client.query(
        `DELETE FROM preference_events
         WHERE user_id = $1 AND subject_type = $2 AND subject_key = $3`,
        [userId, previous.dimension, previous.key]
      );
    }
    const { rows } = await client.query<PreferenceProfileItem>(
      `UPDATE preference_profile_items
        SET weight = COALESCE($3, weight),
            key = COALESCE($4, key),
            confidence = 1,
            derived_from = ARRAY['user_edit']::text[],
            metadata = metadata || '{"user_edited": true}'::jsonb,
            updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING id, dimension, key, weight, confidence, evidence_count,
                  strongest_evidence_type, derived_from, first_observed_at,
                  last_observed_at, expires_at, metadata, updated_at`,
      [itemId, userId, weight, key]
    );
    await client.query("COMMIT");
    if (rows[0]) {
      await preferenceVectorStore.upsertUserInterestVector(
        userId,
        "suggestions",
        await listPreferenceProfile(userId)
      );
    }
    return rows[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePreferenceProfileItem(
  userId: string,
  itemId: string
): Promise<boolean> {
  const client = await pool.connect();
  let outboxId: string | null = null;
  try {
    await client.query("BEGIN");
    const item = await client.query<{
      dimension: string;
      key: string;
      metadata: Record<string, unknown>;
    }>(
      `SELECT dimension, key, metadata FROM preference_profile_items
       WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [itemId, userId]
    );
    const row = item.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      "DELETE FROM preference_profile_items WHERE id = $1 AND user_id = $2",
      [itemId, userId]
    );
    const exclusionId =
      row.dimension === "exclusion" && typeof row.metadata?.exclusion_id === "string"
        ? row.metadata.exclusion_id
        : null;
    if (exclusionId) {
      await client.query(
        "DELETE FROM suggestion_exclusions WHERE id = $1 AND user_id = $2",
        [exclusionId, userId]
      );
    }
    await client.query(
      `DELETE FROM preference_events
       WHERE user_id = $1 AND subject_type = $2 AND subject_key = $3`,
      [userId, row.dimension, row.key]
    );
    const outbox = await client.query<{ id: string }>(
      `INSERT INTO personalization_outbox (user_id, event_name, payload)
       VALUES ($1, 'preference_profile.rebuild', '{}'::jsonb)
       RETURNING id`,
      [userId]
    );
    outboxId = outbox.rows[0]?.id ?? null;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  if (outboxId) await enqueuePersonalizationOutbox(outboxId).catch(() => undefined);
  return true;
}

export async function deletePersonalizationData(userId: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM agent_messages
       WHERE user_id = $1
         AND content->>'template' = 'assistant_suggestion'`,
      [userId]
    );
    await client.query("DELETE FROM suggestions WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM suggestion_candidates WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM suggestion_exclusions WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM message_feedback WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM personalization_outbox WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM personalization_product_events WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM personalization_browser_connections WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM preference_events WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM preference_profile_items WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM preference_vectors WHERE user_id = $1", [userId]);
    await client.query(
      `INSERT INTO personalization_consents
         (user_id, purpose, status, policy_version, revoked_at, source)
       SELECT $1, purpose, 'revoked', 'reset', NOW(), 'profile_reset'
       FROM unnest($2::text[]) AS purposes(purpose)
       WHERE NOT EXISTS (
         SELECT 1 FROM personalization_consents c
         WHERE c.user_id = $1 AND c.purpose = purposes.purpose
           AND c.status = 'revoked'
           AND c.created_at = (
             SELECT MAX(latest.created_at)
             FROM personalization_consents latest
             WHERE latest.user_id = $1 AND latest.purpose = purposes.purpose
           )
       )`,
      [userId, personalizationPurposes]
    );
    await client.query("DELETE FROM personalization_settings WHERE user_id = $1", [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function laterExpiry(
  left: Date | string | null,
  right: Date | string | null
): Date | string | null {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

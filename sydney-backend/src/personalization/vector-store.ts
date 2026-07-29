import { pool } from "../db/index.js";
import { createHash } from "node:crypto";
import type { PreferenceProfileItem } from "./types.js";

export interface PreferenceVectorStore {
  upsertUserInterestVector(
    userId: string,
    namespace: string,
    sourceItems: PreferenceProfileItem[]
  ): Promise<void>;

  similarity(userId: string, namespace: string, candidateText: string): Promise<number>;
}

/**
 * A deterministic, local vector index. It keeps the structured profile as the
 * source of truth while giving ranking a durable semantic-like representation
 * without sending private data to an embedding vendor.
 */
export class StructuredPreferenceVectorStore implements PreferenceVectorStore {
  async upsertUserInterestVector(
    userId: string,
    namespace: string,
    sourceItems: PreferenceProfileItem[]
  ): Promise<void> {
    const vector = new Array(VECTOR_DIMENSIONS).fill(0);
    let sourceItemCount = 0;
    for (const item of sourceItems) {
      if (item.dimension === "exclusion" || Number(item.weight) <= 0) continue;
      addWeightedFeatures(
        vector,
        `${item.dimension}:${item.key}`,
        clamp(Number(item.weight)) * clamp(Number(item.confidence))
      );
      sourceItemCount += 1;
    }
    normalize(vector);
    await pool.query(
      `INSERT INTO preference_vectors
         (user_id, namespace, vector, source_item_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, namespace) DO UPDATE SET
         vector = EXCLUDED.vector,
         source_item_count = EXCLUDED.source_item_count,
         updated_at = NOW()`,
      [userId, namespace, JSON.stringify(vector), sourceItemCount]
    );
  }

  async similarity(
    userId: string,
    namespace: string,
    candidateText: string
  ): Promise<number> {
    const activePurposes = await activeConsentPurposes(userId);
    const stored = await pool.query<{ vector: number[]; source_item_count: number }>(
      `SELECT vector, source_item_count
       FROM preference_vectors
       WHERE user_id = $1 AND namespace = $2`,
      [userId, namespace]
    );
    const { rows } = await pool.query<PreferenceProfileItem>(
      `SELECT id, dimension, key, weight, confidence, evidence_count,
              strongest_evidence_type, derived_from, first_observed_at,
              last_observed_at, expires_at, metadata, updated_at
       FROM preference_profile_items
       WHERE user_id = $1
         AND dimension IN ('topic', 'source', 'format')
         AND weight > 0
         AND confidence > 0
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    );
    const allowed = rows.filter((row) => derivedFromIsAllowed(row.derived_from, activePurposes));
    let profileVector = stored.rows[0]?.vector;
    if (
      !Array.isArray(profileVector) ||
      stored.rows[0]?.source_item_count !== allowed.length
    ) {
      await this.upsertUserInterestVector(userId, namespace, allowed);
      profileVector = buildProfileVector(allowed);
    }
    const candidateVector = new Array(VECTOR_DIMENSIONS).fill(0);
    addWeightedFeatures(candidateVector, candidateText, 1);
    normalize(candidateVector);
    return cosine(profileVector, candidateVector);
  }
}

export const preferenceVectorStore: PreferenceVectorStore =
  new StructuredPreferenceVectorStore();

const VECTOR_DIMENSIONS = 128;

function buildProfileVector(sourceItems: PreferenceProfileItem[]): number[] {
  const vector = new Array(VECTOR_DIMENSIONS).fill(0);
  for (const item of sourceItems) {
    if (item.dimension === "exclusion" || Number(item.weight) <= 0) continue;
    addWeightedFeatures(
      vector,
      `${item.dimension}:${item.key}`,
      clamp(Number(item.weight)) * clamp(Number(item.confidence))
    );
  }
  normalize(vector);
  return vector;
}

function addWeightedFeatures(vector: number[], value: string, weight: number): void {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 3);
  for (const token of tokens) addHashedFeature(vector, `token:${token}`, weight);
  for (const token of tokens) {
    const padded = `^${token}$`;
    for (let index = 0; index + 3 <= padded.length; index += 1) {
      addHashedFeature(vector, `gram:${padded.slice(index, index + 3)}`, weight * 0.35);
    }
  }
}

function addHashedFeature(vector: number[], feature: string, weight: number): void {
  const digest = createHash("sha256").update(feature).digest();
  const index = digest.readUInt32BE(0) % VECTOR_DIMENSIONS;
  const sign = (digest[4]! & 1) === 0 ? 1 : -1;
  vector[index] = (vector[index] ?? 0) + weight * sign;
}

function normalize(vector: number[]): void {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) return;
  for (let index = 0; index < vector.length; index += 1) {
    vector[index] = (vector[index] ?? 0) / magnitude;
  }
}

function cosine(left: number[] | undefined, right: number[]): number {
  if (!Array.isArray(left) || left.length !== right.length) return 0;
  return clamp(left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0));
}

async function activeConsentPurposes(userId: string): Promise<Set<string>> {
  const { rows } = await pool.query<{ purpose: string }>(
    `SELECT purpose
     FROM (
       SELECT DISTINCT ON (purpose) purpose, status
       FROM personalization_consents
       WHERE user_id = $1
       ORDER BY purpose, created_at DESC
     ) latest
     WHERE status = 'granted'`,
    [userId]
  );
  return new Set(rows.map((row) => row.purpose));
}

function derivedFromIsAllowed(
  derivedFrom: string[],
  activePurposes: Set<string>
): boolean {
  if (derivedFrom.length === 0) return true;
  return derivedFrom.every((value) => {
    if (value === "browser_activity") return activePurposes.has("browser_activity");
    if (value === "connected_content") return activePurposes.has("connected_content");
    if (value === "cross_source") return activePurposes.has("cross_source");
    if (
      value === "assistant_feedback" ||
      value === "confirmed_memory" ||
      value === "suggestion_decision" ||
      value === "explicit_exclusion"
    ) {
      return activePurposes.has("explicit_feedback");
    }
    return activePurposes.has("cuppet_activity");
  });
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

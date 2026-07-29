import type { PoolClient } from "pg";
import { pool } from "../db/index.js";
import type {
  SuggestionCandidateRow,
  SuggestionExclusionRow,
  SuggestionRow
} from "./types.js";
import { suggestionOrigins } from "./types.js";

export async function insertSuggestionCandidate(input: {
  userId: string;
  suggestionType: string;
  generatorKey: string;
  origin: string;
  subjectType: string;
  subjectKey: string;
  title: string;
  body: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  reasonCodes: string[];
  evidenceSummary: Record<string, unknown>;
  relevanceScore: number;
  confidenceScore: number;
  interruptionCost?: number;
  consentPurposes: string[];
  expiresAt: Date;
  client?: PoolClient;
}): Promise<SuggestionCandidateRow | null> {
  if (!(suggestionOrigins as readonly string[]).includes(input.origin)) {
    throw new Error("Unsupported suggestion origin.");
  }
  if (containsCommercialField(input.actionPayload) || containsCommercialField(input.evidenceSummary)) {
    throw new Error("Commercial suggestion metadata is not permitted.");
  }
  const executor = input.client ?? pool;
  const preferenceSubjectType =
    typeof input.actionPayload.preference_subject_type === "string"
      ? input.actionPayload.preference_subject_type
      : null;
  const preferenceSubjectKey =
    typeof input.actionPayload.preference_subject_key === "string"
      ? input.actionPayload.preference_subject_key
      : null;
  const excluded = await executor.query(
    `SELECT 1
     FROM suggestion_exclusions
     WHERE user_id = $1
       AND (
         (subject_type = $2 AND subject_key = $3)
         OR ($4::text IS NOT NULL AND subject_type = $4 AND subject_key = $5)
       )
     LIMIT 1`,
    [
      input.userId,
      input.subjectType,
      input.subjectKey,
      preferenceSubjectType,
      preferenceSubjectKey
    ]
  );
  if (excluded.rows[0]) return null;
  const { rows } = await executor.query<SuggestionCandidateRow>(
    `INSERT INTO suggestion_candidates
       (user_id, suggestion_type, generator_key, origin, subject_type, subject_key,
        title, body, action_type, action_payload, reason_codes, evidence_summary,
        relevance_score, confidence_score, interruption_cost, consent_purposes, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      input.userId,
      input.suggestionType,
      input.generatorKey,
      input.origin,
      input.subjectType,
      input.subjectKey,
      input.title,
      input.body,
      input.actionType,
      JSON.stringify(input.actionPayload),
      input.reasonCodes,
      JSON.stringify(input.evidenceSummary),
      input.relevanceScore,
      input.confidenceScore,
      input.interruptionCost ?? 0,
      input.consentPurposes,
      input.expiresAt
    ]
  );
  return rows[0]!;
}

function containsCommercialField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsCommercialField);
  return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
    /(?:sponsor|advertis|campaign|bid|promotion|targeting|broker|license)/i.test(key) ||
    containsCommercialField(child)
  );
}

export async function listSuggestionExclusions(
  userId: string,
  client: PoolClient | typeof pool = pool
): Promise<SuggestionExclusionRow[]> {
  const { rows } = await client.query<SuggestionExclusionRow>(
    `SELECT id, user_id, subject_type, subject_key, source_suggestion_id, created_at
     FROM suggestion_exclusions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function deleteSuggestionExclusion(
  userId: string,
  exclusionId: string,
  client: PoolClient | typeof pool = pool
): Promise<boolean> {
  const result = await client.query(
    `DELETE FROM suggestion_exclusions WHERE id = $1 AND user_id = $2`,
    [exclusionId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function createSuggestionExclusion(input: {
  userId: string;
  subjectType: string;
  subjectKey: string;
  sourceSuggestionId?: string;
  client?: PoolClient;
}): Promise<SuggestionExclusionRow> {
  const executor = input.client ?? pool;
  const { rows } = await executor.query<SuggestionExclusionRow>(
    `INSERT INTO suggestion_exclusions
       (user_id, subject_type, subject_key, source_suggestion_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, subject_type, subject_key) DO UPDATE
       SET source_suggestion_id = COALESCE(EXCLUDED.source_suggestion_id,
                                           suggestion_exclusions.source_suggestion_id)
     RETURNING id, user_id, subject_type, subject_key, source_suggestion_id, created_at`,
    [
      input.userId,
      input.subjectType,
      input.subjectKey,
      input.sourceSuggestionId ?? null
    ]
  );
  return rows[0]!;
}

export async function loadCandidateForUser(
  userId: string,
  candidateId: string,
  client: PoolClient | typeof pool = pool
): Promise<SuggestionCandidateRow | null> {
  const { rows } = await client.query<SuggestionCandidateRow>(
    "SELECT * FROM suggestion_candidates WHERE id = $1 AND user_id = $2",
    [candidateId, userId]
  );
  return rows[0] ?? null;
}

export async function loadSuggestionForUser(
  userId: string,
  suggestionId: string,
  client: PoolClient | typeof pool = pool
): Promise<SuggestionRow | null> {
  const { rows } = await client.query<SuggestionRow>(
    "SELECT * FROM suggestions WHERE id = $1 AND user_id = $2",
    [suggestionId, userId]
  );
  return rows[0] ?? null;
}

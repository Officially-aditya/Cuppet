import type { PoolClient } from "pg";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import { createLlmMessage, extractLlmText, llmConfigured } from "../agents/llm.js";

export type AssistantMemoryType =
  | "preference"
  | "constraint"
  | "project"
  | "profile_fact";

export type AssistantMemoryStatus = "candidate" | "confirmed" | "dismissed";

export type AssistantMemory = {
  id: string;
  canonical_key: string;
  memory_type: AssistantMemoryType;
  value: { text: string };
  confidence: string | number;
  reinforcement_count: number;
  status: AssistantMemoryStatus;
  created_at: Date | string;
  updated_at: Date | string;
  last_accessed_at?: Date | string | null;
};

export type MemoryObservation = {
  canonicalKey: string;
  type: AssistantMemoryType;
  text: string;
  explicit: boolean;
  confidence: number;
};

export type MemoryRecordResult = {
  memory: AssistantMemory | null;
  rejected: boolean;
  confirmationRequired: boolean;
};

const compactedMemoryItemSchema = z.object({
  canonical_key: z.string().min(1).max(300),
  memory_type: z.enum(["preference", "constraint", "project", "profile_fact"]),
  previous_status: z.enum(["candidate", "confirmed", "dismissed"]),
  summary: z.string().min(1).max(500),
  reinforcement_count: z.number().int().min(1),
  confirmation_state: z.enum(["pending", "confirmed", "dismissed"])
}).strict();

export const compactedMemoryItemsSchema = z.array(compactedMemoryItemSchema);

export type CompactedMemoryItem = z.infer<typeof compactedMemoryItemSchema>;

export type CompactedMemoryDigest = {
  summary: string;
  item_count: number;
  updated_at: Date | string;
};

export function decideMemoryTransition(
  observation: MemoryObservation,
  sourceMessageId: string,
  existing?: {
    status: AssistantMemoryStatus;
    reinforcementCount: number;
    sourceMessageIds: string[];
    confirmationShown: boolean;
  }
): {
  status: AssistantMemoryStatus;
  reinforcementCount: number;
  confirmationRequired: boolean;
} {
  const distinct = !existing?.sourceMessageIds.includes(sourceMessageId);
  const reinforcementCount = existing
    ? existing.reinforcementCount + (distinct ? 1 : 0)
    : 1;
  const status: AssistantMemoryStatus = observation.explicit
    ? "confirmed"
    : existing?.status === "confirmed"
      ? "confirmed"
      : existing?.status === "dismissed"
        ? "dismissed"
        : "candidate";
  return {
    status,
    reinforcementCount,
    confirmationRequired:
      !observation.explicit &&
      status === "candidate" &&
      reinforcementCount >= 2 &&
      !existing?.confirmationShown
  };
}

export function boundedSourceMessageIds(
  existing: string[],
  sourceMessageId: string,
  limit = config.ASSISTANT_MEMORY_SOURCE_MESSAGE_LIMIT
): string[] {
  const withoutCurrent = existing.filter((id) => id !== sourceMessageId);
  return [...withoutCurrent, sourceMessageId].slice(-limit);
}

async function compactMemoriesIfNeeded(
  client: PoolClient,
  userId: string
): Promise<void> {
  await compactMemoryGroup(client, userId, ["confirmed"], config.ASSISTANT_MAX_CONFIRMED_MEMORIES);
  await compactMemoryGroup(
    client,
    userId,
    ["candidate", "dismissed"],
    config.ASSISTANT_MAX_UNCONFIRMED_MEMORIES
  );
}

export async function compactOverCapacityMemories(): Promise<number> {
  const users = await pool.query<{ user_id: string }>(
    `SELECT user_id
     FROM assistant_memories
     GROUP BY user_id
     HAVING COUNT(*) FILTER (WHERE status = 'confirmed') > $1
        OR COUNT(*) FILTER (WHERE status IN ('candidate', 'dismissed')) > $2
     LIMIT 100`,
    [config.ASSISTANT_MAX_CONFIRMED_MEMORIES, config.ASSISTANT_MAX_UNCONFIRMED_MEMORIES]
  );
  let compactedUsers = 0;
  for (const row of users.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext('assistant_memories'))",
        [row.user_id]
      );
      await compactMemoriesIfNeeded(client, row.user_id);
      await client.query("COMMIT");
      compactedUsers += 1;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  return compactedUsers;
}

async function compactMemoryGroup(
  client: PoolClient,
  userId: string,
  statuses: AssistantMemoryStatus[],
  cap: number
): Promise<void> {
  const count = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM assistant_memories
     WHERE user_id = $1 AND status = ANY($2::text[])`,
    [userId, statuses]
  );
  if (Number(count.rows[0]?.count ?? 0) <= cap) return;

  const selected = await client.query<AssistantMemory>(
    `SELECT id, canonical_key, memory_type, value, confidence,
            reinforcement_count, status, created_at, updated_at, last_accessed_at
     FROM assistant_memories
     WHERE user_id = $1 AND status = ANY($2::text[])
     ORDER BY updated_at ASC, id ASC
     LIMIT 25
     FOR UPDATE`,
    [userId, statuses]
  );
  if (selected.rows.length === 0) return;

  const digest = await client.query<{ items: unknown }>(
    `SELECT items FROM assistant_memory_digests WHERE user_id = $1 FOR UPDATE`,
    [userId]
  );
  const existing = compactedMemoryItemsSchema.safeParse(digest.rows[0]?.items ?? []);
  const incoming = await generateCompactedMemoryItems(selected.rows);
  const merged = mergeCompactedMemoryItems(
    existing.success ? existing.data : [],
    incoming
  );
  const summary = renderCompactedMemorySummary(merged);

  await client.query(
    `INSERT INTO assistant_memory_digests (user_id, items, summary, item_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
     SET items = EXCLUDED.items,
         summary = EXCLUDED.summary,
         item_count = EXCLUDED.item_count`,
    [userId, JSON.stringify(merged), summary, merged.length]
  );

  // Full values are removed only after the validated, bounded digest write has
  // succeeded in this transaction.
  await client.query(
    `DELETE FROM assistant_memories WHERE id = ANY($1::uuid[]) AND user_id = $2`,
    [selected.rows.map((row) => row.id), userId]
  );
}

function deterministicCompactedItem(memory: AssistantMemory): CompactedMemoryItem {
  const words = String(memory.value?.text ?? "Remembered detail")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 18)
    .join(" ");
  return compactedMemoryItemSchema.parse({
    canonical_key: memory.canonical_key,
    memory_type: memory.memory_type,
    previous_status: memory.status,
    summary: words || memory.canonical_key.replace(/[_:]/g, " "),
    reinforcement_count: memory.reinforcement_count,
    confirmation_state:
      memory.status === "confirmed"
        ? "confirmed"
        : memory.status === "dismissed"
          ? "dismissed"
          : "pending"
  });
}

async function generateCompactedMemoryItems(
  memories: AssistantMemory[]
): Promise<CompactedMemoryItem[]> {
  const fallback = memories.map(deterministicCompactedItem);
  if (!llmConfigured()) return fallback;
  try {
    const response = await createLlmMessage({
      maxTokens: 1800,
      system: [
        "Compress memory rows into terse structured summaries.",
        "Return only a JSON array with canonical_key, memory_type, previous_status, summary, reinforcement_count, and confirmation_state.",
        "Never add facts. Keep each summary under 18 words and preserve every input canonical key and status exactly."
      ].join(" "),
      messages: [{
        role: "user",
        content: JSON.stringify(memories.map((memory) => ({
          canonical_key: memory.canonical_key,
          memory_type: memory.memory_type,
          previous_status: memory.status,
          value: memory.value.text,
          reinforcement_count: memory.reinforcement_count,
          confirmation_state:
            memory.status === "confirmed"
              ? "confirmed"
              : memory.status === "dismissed"
                ? "dismissed"
                : "pending"
        })))
      }]
    });
    const raw = extractLlmText(response.content)
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const parsed = compactedMemoryItemsSchema.parse(JSON.parse(raw));
    if (parsed.length !== memories.length) return fallback;
    const inputs = new Map(memories.map((memory) => [memory.canonical_key, memory]));
    for (const item of parsed) {
      const source = inputs.get(item.canonical_key);
      if (!source ||
          item.previous_status !== source.status ||
          item.memory_type !== source.memory_type ||
          item.reinforcement_count !== source.reinforcement_count) {
        return fallback;
      }
    }
    return parsed.map((item) => ({
      ...item,
      summary: item.summary.split(/\s+/).slice(0, 18).join(" ")
    }));
  } catch {
    return fallback;
  }
}

export function mergeCompactedMemoryItems(
  existing: CompactedMemoryItem[],
  incoming: CompactedMemoryItem[]
): CompactedMemoryItem[] {
  const mapped = new Map<string, CompactedMemoryItem>();
  for (const item of [...existing, ...incoming]) {
    const parsed = compactedMemoryItemSchema.parse(item);
    mapped.set(parsed.canonical_key, parsed);
  }

  // Prefer newly compacted information. The digest is intentionally lossy and
  // capped at 300 words including structured metadata.
  const newestFirst = [...mapped.values()].reverse();
  const kept: CompactedMemoryItem[] = [];
  for (const item of newestFirst) {
    const candidate = [item, ...kept];
    if (wordCount(renderCompactedMemorySummary(candidate)) <= 300) {
      kept.unshift(item);
    }
  }
  return compactedMemoryItemsSchema.parse(kept);
}

export function renderCompactedMemorySummary(items: CompactedMemoryItem[]): string {
  return items
    .map((item) =>
      `- ${item.canonical_key} [${item.previous_status}, ${item.memory_type}, reinforced ${item.reinforcement_count}]: ${item.summary}`
    )
    .join("\n")
    .split(/\s+/)
    .slice(0, 300)
    .join(" ")
    .replace(/\s+-\s+/g, "\n- ")
    .trim();
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

const secretPattern =
  /\b(?:password|passcode|pin|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|secret|private[ _-]?key|recovery[ _-]?(?:code|phrase)|seed phrase|one[- ]time code|otp|security answer|system prompt|developer prompt)\b/i;
const unsafeInstructionPattern =
  /(?:\b(?:ignore|bypass|override)\b.{0,60}\b(?:safety|security|policy|permission)\b)|(?:\b(?:delete|destroy|exfiltrate|steal|hack)\b.{0,60}\b(?:data|files|credentials|accounts?)\b)/i;

export function extractMemoryObservation(text: string): MemoryObservation | null {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (
    !normalized ||
    secretPattern.test(normalized) ||
    unsafeInstructionPattern.test(normalized)
  ) return null;

  const remember = normalized.match(
    /^(?:please\s+)?remember(?:\s+that)?\s+(.+?)[.!]?$/i
  );
  if (remember) {
    const fact = remember[1]!.trim();
    const rememberedPreference = fact.match(/^i\s+prefer\s+(.+)$/i);
    if (rememberedPreference) {
      return observation(
        `I prefer ${rememberedPreference[1]!.trim()}`,
        "preference",
        true,
        1
      );
    }
    const rememberedConstraint = fact.match(/^always\s+(.+)$/i);
    if (rememberedConstraint) {
      return observation(
        `Always ${rememberedConstraint[1]!.trim()}`,
        "constraint",
        true,
        1
      );
    }
    return observation(fact, "profile_fact", true, 1);
  }

  const prefer = normalized.match(
    /^(?:(?:actually|from now on|please),?\s+)?(?:i\s+)?prefer\s+(.+?)[.!]?$/i
  );
  if (prefer) {
    return observation(`I prefer ${prefer[1]!.trim()}`, "preference", true, 1);
  }

  const always = normalized.match(/^(?:please\s+)?always\s+(.+?)[.!]?$/i);
  if (always) {
    return observation(`Always ${always[1]!.trim()}`, "constraint", true, 1);
  }

  const stablePatterns: Array<{
    pattern: RegExp;
    type: AssistantMemoryType;
    format: (value: string) => string;
  }> = [
    {
      pattern: /^(?:i\s+)?like\s+(.+?)[.!]?$/i,
      type: "preference",
      format: (value) => `I like ${value}`
    },
    {
      pattern: /^my\s+(?:current\s+)?project\s+is\s+(.+?)[.!]?$/i,
      type: "project",
      format: (value) => `My project is ${value}`
    },
    {
      pattern: /^i(?:'m| am)\s+working\s+on\s+(.+?)[.!]?$/i,
      type: "project",
      format: (value) => `I am working on ${value}`
    },
    {
      pattern: /^my\s+([a-z][a-z ]{1,30})\s+is\s+(.+?)[.!]?$/i,
      type: "profile_fact",
      format: (value) => value
    }
  ];
  for (const candidate of stablePatterns) {
    const match = normalized.match(candidate.pattern);
    if (match) {
      return observation(
        candidate.format(
          candidate.type === "profile_fact" && match.length > 2
            ? `My ${match[1]} is ${match[2]}`
            : match[1]!
        ),
        candidate.type,
        false,
        0.75
      );
    }
  }

  return null;
}

export function canonicalMemoryKey(
  text: string,
  type: AssistantMemoryType
): string {
  const lower = text.toLowerCase();
  const knownKey = [
    [/\b(?:concise|brief|short|detailed|long|response|answer|reply)\b/, "response_style"],
    [/\b(?:time ?zone|timezone)\b/, "time_zone"],
    [/\b(?:language|english|hindi|spanish|french|german)\b/, "language"],
    [/\b(?:diet|vegetarian|vegan|allerg)/, "dietary_requirement"],
    [/\b(?:project|working on)\b/, "current_project"],
    [/\b(?:name|call me)\b/, "preferred_name"]
  ].find(([pattern]) => (pattern as RegExp).test(lower));
  if (knownKey) return `${type}:${knownKey[1]}`;

  const tokens = lower
    .replace(/\b(?:please|remember|that|i|my|me|am|is|are|the|a|an|to|always|prefer|like|from|now|on)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return `${type}:${tokens.join("_") || "fact"}`;
}

function observation(
  text: string,
  type: AssistantMemoryType,
  explicit: boolean,
  confidence: number
): MemoryObservation | null {
  const clean = text.trim().replace(/[.!]+$/, "").slice(0, 1000);
  if (
    !clean ||
    secretPattern.test(clean) ||
    unsafeInstructionPattern.test(clean)
  ) return null;
  return {
    canonicalKey: canonicalMemoryKey(clean, type),
    type,
    text: clean,
    explicit,
    confidence
  };
}

export function isUnsafeMemoryText(text: string): boolean {
  return secretPattern.test(text) || unsafeInstructionPattern.test(text);
}

export async function recordMemoryObservation(
  client: PoolClient,
  input: { userId: string; sourceMessageId: string; observation: MemoryObservation }
): Promise<MemoryRecordResult> {
  const { userId, sourceMessageId, observation } = input;
  if (isUnsafeMemoryText(observation.text)) {
    return { memory: null, rejected: true, confirmationRequired: false };
  }

  // Serialize memory writes per user so concurrent turns cannot exceed the cap
  // or lose reinforcement/source updates.
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext($1), hashtext('assistant_memories'))",
    [userId]
  );

  await rehydrateCompactedMemory(client, userId, observation.canonicalKey);

  const existing = await client.query<AssistantMemory & {
    source_message_ids: string[];
    confirmation_shown_at: Date | string | null;
  }>(
    `SELECT * FROM assistant_memories
     WHERE user_id = $1 AND canonical_key = $2
     FOR UPDATE`,
    [userId, observation.canonicalKey]
  );
  const row = existing.rows[0];
  const transition = decideMemoryTransition(observation, sourceMessageId, row
    ? {
        status: row.status,
        reinforcementCount: row.reinforcement_count,
        sourceMessageIds: row.source_message_ids,
        confirmationShown: Boolean(row.confirmation_shown_at)
      }
    : undefined);
  const sourceMessageIds = boundedSourceMessageIds(
    row?.source_message_ids ?? [],
    sourceMessageId
  );

  const result = await client.query<AssistantMemory & {
    confirmation_shown_at: Date | string | null;
  }>(
    `
      INSERT INTO assistant_memories
        (user_id, canonical_key, memory_type, value, confidence,
         reinforcement_count, status, source_message_ids)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::uuid[])
      ON CONFLICT (user_id, canonical_key) DO UPDATE
      SET memory_type = EXCLUDED.memory_type,
          value = EXCLUDED.value,
          confidence = GREATEST(assistant_memories.confidence, EXCLUDED.confidence),
          reinforcement_count = EXCLUDED.reinforcement_count,
          status = EXCLUDED.status,
          source_message_ids = EXCLUDED.source_message_ids
      RETURNING *
    `,
    [
      userId,
      observation.canonicalKey,
      observation.type,
      JSON.stringify({ text: observation.text }),
      observation.confidence,
      transition.reinforcementCount,
      transition.status,
      sourceMessageIds
    ]
  );
  const memory = result.rows[0]!;
  const confirmationRequired = transition.confirmationRequired;

  if (confirmationRequired) {
    await client.query(
      `UPDATE assistant_memories SET confirmation_shown_at = NOW() WHERE id = $1`,
      [memory.id]
    );
  }
  await compactMemoriesIfNeeded(client, userId);

  return { memory, rejected: false, confirmationRequired };
}

export async function listConfirmedMemories(
  userId: string
): Promise<AssistantMemory[]> {
  const { rows } = await pool.query<AssistantMemory>(
    `SELECT id, canonical_key, memory_type, value, confidence,
            reinforcement_count, status, last_accessed_at, created_at, updated_at
     FROM assistant_memories
     WHERE user_id = $1 AND status = 'confirmed'
     ORDER BY updated_at DESC`,
    [userId]
  );
  return rows;
}

export async function forgetMemoryById(
  userId: string,
  memoryId: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM assistant_memories WHERE id = $1 AND user_id = $2`,
    [memoryId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function forgetMemoriesMatching(
  userId: string,
  query: string
): Promise<number> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext('assistant_memories'))",
      [userId]
    );
    const result = await client.query(
      `DELETE FROM assistant_memories
       WHERE user_id = $1
         AND (replace(canonical_key, '_', ' ') ILIKE $2 OR value->>'text' ILIKE $2)`,
      [userId, `%${normalized}%`]
    );
    const digest = await client.query<{ items: unknown }>(
      `SELECT items FROM assistant_memory_digests WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );
    const parsed = compactedMemoryItemsSchema.safeParse(digest.rows[0]?.items ?? []);
    const items = parsed.success ? parsed.data : [];
    const remaining = items.filter((item) =>
      !`${item.canonical_key.replace(/_/g, " ")} ${item.summary}`
        .toLowerCase()
        .includes(normalized)
    );
    const removedFromDigest = items.length - remaining.length;
    if (removedFromDigest > 0) {
      await writeCompactedDigest(client, userId, remaining);
    }
    await client.query("COMMIT");
    return (result.rowCount ?? 0) + removedFromDigest;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteAllMemories(userId: string): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext('assistant_memories'))",
      [userId]
    );
    const result = await client.query(
      `DELETE FROM assistant_memories WHERE user_id = $1`,
      [userId]
    );
    const digest = await client.query<{ item_count: number }>(
      `DELETE FROM assistant_memory_digests WHERE user_id = $1 RETURNING item_count`,
      [userId]
    );
    await client.query("COMMIT");
    return (result.rowCount ?? 0) + (digest.rows[0]?.item_count ?? 0);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setMemoryStatus(
  client: PoolClient,
  userId: string,
  memoryId: string,
  status: "confirmed" | "dismissed"
): Promise<AssistantMemory | null> {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext($1), hashtext('assistant_memories'))",
    [userId]
  );
  const { rows } = await client.query<AssistantMemory>(
    `UPDATE assistant_memories SET status = $3
     WHERE id = $1 AND user_id = $2 AND status = 'candidate'
     RETURNING *`,
    [memoryId, userId, status]
  );
  if (rows[0]) await compactMemoriesIfNeeded(client, userId);
  return rows[0] ?? null;
}

export async function clearUnconfirmedAssistantState(
  userId: string,
  assistantId: string
): Promise<void> {
  // Clear Chat intentionally preserves confirmed, candidate, dismissed, and
  // compacted memory. It only expires conversational confirmation UI state.
  await pool.query(
    `UPDATE assistant_pending_actions SET consumed_at = NOW()
     WHERE user_id = $1 AND assistant_id = $2 AND consumed_at IS NULL`,
    [userId, assistantId]
  );
}

export async function getCompactedMemoryDigest(
  userId: string
): Promise<CompactedMemoryDigest | null> {
  const { rows } = await pool.query<CompactedMemoryDigest>(
    `SELECT summary, item_count, updated_at
     FROM assistant_memory_digests
     WHERE user_id = $1 AND item_count > 0`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function deleteCompactedMemoryDigest(userId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM assistant_memory_digests WHERE user_id = $1`,
    [userId]
  );
  return (result.rowCount ?? 0) > 0;
}

async function rehydrateCompactedMemory(
  client: PoolClient,
  userId: string,
  canonicalKey: string
): Promise<void> {
  const digest = await client.query<{ items: unknown }>(
    `SELECT items FROM assistant_memory_digests WHERE user_id = $1 FOR UPDATE`,
    [userId]
  );
  const parsed = compactedMemoryItemsSchema.safeParse(digest.rows[0]?.items ?? []);
  if (!parsed.success) return;
  const index = parsed.data.findIndex((item) => item.canonical_key === canonicalKey);
  if (index < 0) return;
  const item = parsed.data[index]!;
  await client.query(
    `INSERT INTO assistant_memories
       (user_id, canonical_key, memory_type, value, confidence,
        reinforcement_count, status, source_message_ids, confirmation_shown_at)
     VALUES ($1, $2, $3, $4, 0.5, $5, $6, '{}'::uuid[],
             CASE WHEN $6 = 'candidate' THEN NULL ELSE NOW() END)
     ON CONFLICT (user_id, canonical_key) DO NOTHING`,
    [
      userId,
      item.canonical_key,
      item.memory_type,
      JSON.stringify({ text: item.summary }),
      item.reinforcement_count,
      item.previous_status
    ]
  );
  const remaining = [...parsed.data];
  remaining.splice(index, 1);
  await writeCompactedDigest(client, userId, remaining);
}

async function writeCompactedDigest(
  client: PoolClient,
  userId: string,
  items: CompactedMemoryItem[]
): Promise<void> {
  const validated = compactedMemoryItemsSchema.parse(items);
  if (validated.length === 0) {
    await client.query(`DELETE FROM assistant_memory_digests WHERE user_id = $1`, [userId]);
    return;
  }
  await client.query(
    `INSERT INTO assistant_memory_digests (user_id, items, summary, item_count)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
     SET items = EXCLUDED.items, summary = EXCLUDED.summary,
         item_count = EXCLUDED.item_count`,
    [userId, JSON.stringify(validated), renderCompactedMemorySummary(validated), validated.length]
  );
}

export type AssistantKernelContext = {
  stm: Array<{ role: string; text: string; attachmentContext?: string }>;
  ltm: AssistantMemory[];
  pendingAction: Record<string, unknown> | null;
  evidenceTree: {
    assistantId: string;
    messageIds: string[];
    attachmentIds: string[];
    sourceReferences: unknown[];
  };
};

export async function assembleAssistantKernel(
  userId: string,
  assistantId: string,
  options: { maxMessages?: number; characterBudget?: number } = {}
): Promise<AssistantKernelContext> {
  const maxMessages = Math.min(options.maxMessages ?? 16, 16);
  const characterBudget = options.characterBudget ?? 12_000;
  const [messageResult, ltm, pendingResult] = await Promise.all([
    pool.query<{
      id: string;
      role: string;
      text: string | null;
      attachment_context: string | null;
      attachment_ids: string[];
      source_refs: unknown[];
    }>(
      `SELECT m.id, m.role,
              COALESCE(m.content #>> '{data,body}', m.content #>> '{data,text}') AS text,
              NULLIF(string_agg(ma.extracted_context, E'\n' ORDER BY ma.created_at), '') AS attachment_context,
              COALESCE(array_agg(ma.uploaded_file_id::text)
                FILTER (WHERE ma.uploaded_file_id IS NOT NULL), '{}') AS attachment_ids,
              COALESCE(m.source_refs, '[]'::jsonb) AS source_refs
       FROM agent_messages m
       LEFT JOIN message_attachments ma
         ON ma.message_id = m.id
        AND ma.context_expires_at > NOW()
       WHERE m.user_id = $1 AND m.agent_id = $2
         AND ($5::boolean = FALSE OR
              m.created_at > NOW() - ($4::int * INTERVAL '1 day'))
       GROUP BY m.id, m.source_refs
       ORDER BY m.created_at DESC
       LIMIT $3`,
      [
        userId,
        assistantId,
        maxMessages,
        config.MESSAGE_RETENTION_DAYS,
        config.MESSAGE_RETENTION_ENABLED
      ]
    ),
    listConfirmedMemories(userId),
    pool.query<Record<string, unknown>>(
      `SELECT id, action_type, target_agent_id, payload, expires_at
       FROM assistant_pending_actions
       WHERE user_id = $1 AND assistant_id = $2
         AND consumed_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, assistantId]
    )
  ]);

  let remaining = characterBudget;
  const newestFirst: AssistantKernelContext["stm"] = [];
  for (const row of messageResult.rows) {
    if (remaining <= 0) break;
    const text = (row.text ?? "").slice(0, remaining);
    remaining -= text.length;
    const attachmentContext = (row.attachment_context ?? "").slice(0, remaining);
    remaining -= attachmentContext.length;
    if (!text && !attachmentContext) continue;
    newestFirst.push({
      role: row.role,
      text,
      ...(attachmentContext ? { attachmentContext } : {})
    });
  }
  const stm = newestFirst.reverse();

  if (ltm.length > 0) {
    await pool.query(
      `UPDATE assistant_memories SET last_accessed_at = NOW()
       WHERE user_id = $1 AND status = 'confirmed'`,
      [userId]
    );
  }
  return {
    stm,
    ltm: ltm.slice(0, 30),
    pendingAction: pendingResult.rows[0] ?? null,
    evidenceTree: {
      assistantId,
      messageIds: messageResult.rows.map((row) => row.id),
      attachmentIds: messageResult.rows.flatMap((row) => row.attachment_ids),
      sourceReferences: messageResult.rows.flatMap((row) =>
        Array.isArray(row.source_refs) ? row.source_refs : []
      )
    }
  };
}

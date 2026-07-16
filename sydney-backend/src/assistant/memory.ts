import type { PoolClient } from "pg";
import { config } from "../config.js";
import { pool } from "../db/index.js";

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

async function enforceConfirmedMemoryLimit(
  client: PoolClient,
  userId: string
): Promise<void> {
  await client.query(
    `WITH ranked AS (
       SELECT id,
              row_number() OVER (ORDER BY updated_at DESC, id DESC) AS position
       FROM assistant_memories
       WHERE user_id = $1 AND status = 'confirmed'
     )
     DELETE FROM assistant_memories AS memory
     USING ranked
     WHERE memory.id = ranked.id AND ranked.position > $2`,
    [userId, config.ASSISTANT_MAX_CONFIRMED_MEMORIES]
  );
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
  if (transition.status === "confirmed") {
    await enforceConfirmedMemoryLimit(client, userId);
  }

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
  const result = await pool.query(
    `DELETE FROM assistant_memories
     WHERE user_id = $1 AND status = 'confirmed'
       AND (replace(canonical_key, '_', ' ') ILIKE $2 OR value->>'text' ILIKE $2)`,
    [userId, `%${normalized}%`]
  );
  return result.rowCount ?? 0;
}

export async function deleteAllMemories(userId: string): Promise<number> {
  const result = await pool.query(
    `DELETE FROM assistant_memories WHERE user_id = $1`,
    [userId]
  );
  return result.rowCount ?? 0;
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
  if (rows[0] && status === "confirmed") {
    await enforceConfirmedMemoryLimit(client, userId);
  }
  return rows[0] ?? null;
}

export async function clearUnconfirmedAssistantState(
  userId: string,
  assistantId: string
): Promise<void> {
  await pool.query(
    `DELETE FROM assistant_memories WHERE user_id = $1 AND status != 'confirmed'`,
    [userId]
  );
  await pool.query(
    `UPDATE assistant_pending_actions SET consumed_at = NOW()
     WHERE user_id = $1 AND assistant_id = $2 AND consumed_at IS NULL`,
    [userId, assistantId]
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
         AND m.created_at >= NOW() - ($4::int * INTERVAL '1 day')
       GROUP BY m.id, m.source_refs
       ORDER BY m.created_at DESC
       LIMIT $3`,
      [userId, assistantId, maxMessages, config.ASSISTANT_CHAT_RETENTION_DAYS]
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

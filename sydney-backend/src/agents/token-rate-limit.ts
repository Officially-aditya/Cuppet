import { AsyncLocalStorage } from "node:async_hooks";
import { pool } from "../db/index.js";
import type { LlmMessageInput, LlmMessageResponse } from "./llm-types.js";

export const LLM_INPUT_TOKEN_LIMIT = 20_000;
export const LLM_OUTPUT_TOKEN_LIMIT = 5_000;
export const LLM_TOKEN_WINDOW_MS = 5 * 60 * 60 * 1000;

type LlmUserContext = {
  userId: string;
  limitError?: LlmTokenLimitError;
  parent?: LlmUserContext;
};

type UsageWindowRow = {
  window_key: string;
  window_started_at: Date | string;
  window_ends_at: Date | string;
  input_tokens: number | string;
  output_tokens: number | string;
};

type TokenReservation = {
  id: string;
  userId: string;
  windowKey: string;
  inputTokens: number;
  outputTokens: number;
};

const llmUserStorage = new AsyncLocalStorage<LlmUserContext>();

export class LlmTokenLimitError extends Error {
  readonly statusCode = 429;
  readonly code = "LLM_TOKEN_LIMIT_EXCEEDED";
  readonly retryable = false;
  readonly retryAfterSeconds: number;
  readonly resetAt: Date;

  constructor(resetAt: Date, now = new Date()) {
    super(tokenLimitMessage(resetAt));
    this.name = "LlmTokenLimitError";
    this.resetAt = resetAt;
    this.retryAfterSeconds = Math.max(
      1,
      Math.ceil((resetAt.getTime() - now.getTime()) / 1000)
    );
    Object.setPrototypeOf(this, LlmTokenLimitError.prototype);
  }
}

export function tokenLimitMessage(resetAt: Date): string {
  return `Limit Exhausted. Your Limit will reset at ${resetAt.toISOString()}.`;
}

export function isLlmTokenLimitError(
  error: unknown
): error is LlmTokenLimitError {
  if (error instanceof LlmTokenLimitError) return true;
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === "LLM_TOKEN_LIMIT_EXCEEDED";
}

export function currentLlmUserId(): string | undefined {
  return llmUserStorage.getStore()?.userId;
}

/** Keeps the authenticated user attached to every nested model call. */
export async function withLlmUser<T>(
  userId: string,
  callback: () => Promise<T> | T
): Promise<T> {
  const context: LlmUserContext = {
    userId,
    parent: llmUserStorage.getStore()
  };
  return llmUserStorage.run(context, async () => {
    try {
      const result = await callback();
      if (context.limitError) throw context.limitError;
      return result;
    } catch (error) {
      if (context.limitError) throw context.limitError;
      throw error;
    }
  });
}

export function markLlmTokenLimitError(error: unknown): void {
  if (!isLlmTokenLimitError(error)) return;
  let context = llmUserStorage.getStore();
  while (context) {
    if (!context.limitError) context.limitError = error;
    context = context.parent;
  }
}

export function estimateLlmInputTokens(input: LlmMessageInput): number {
  const systemTokens = estimateTextTokens(input.system);
  const messageTokens = input.messages.reduce(
    (total, message) =>
      total + 1 + estimateContentTokens(message.content),
    0
  );
  return Math.max(1, systemTokens + messageTokens);
}

export function measuredLlmUsage(
  usage: LlmMessageResponse["usage"] | undefined
): { inputTokens: number | undefined; outputTokens: number | undefined } {
  if (!usage) {
    return { inputTokens: undefined, outputTokens: undefined };
  }

  const hasInputUsage = [
    usage.input_tokens,
    usage.cache_creation_input_tokens,
    usage.cache_read_input_tokens
  ].some((value) => value !== undefined);

  return {
    inputTokens: hasInputUsage
      ? [
          usage.input_tokens,
          usage.cache_creation_input_tokens,
          usage.cache_read_input_tokens
        ].reduce<number>((total, value) => total + nonNegativeInteger(value), 0)
      : undefined,
    outputTokens:
      usage.output_tokens === undefined
        ? undefined
        : nonNegativeInteger(usage.output_tokens)
  };
}

export async function reserveLlmTokens(
  userId: string,
  input: LlmMessageInput
): Promise<TokenReservation> {
  const requestedInputTokens = estimateLlmInputTokens(input);
  const requestedOutputTokens = Math.max(
    0,
    Math.floor(input.maxTokens ?? 800)
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext('llm_token_rate_limit'))",
      [userId]
    );

    let window = await currentWindow(client, userId);
    const now = new Date();
    if (!window) {
      const created = await client.query<UsageWindowRow>(
        `INSERT INTO llm_token_usage_windows
           (user_id, window_key, window_started_at, window_ends_at)
         VALUES ($1, gen_random_uuid(), NOW(), NOW() + INTERVAL '5 hours')
         RETURNING window_key, window_started_at, window_ends_at,
                   input_tokens, output_tokens`,
        [userId]
      );
      window = created.rows[0]!;
    } else if (new Date(window.window_ends_at).getTime() <= now.getTime()) {
      const reset = await client.query<UsageWindowRow>(
        `UPDATE llm_token_usage_windows
         SET window_key = gen_random_uuid(),
             window_started_at = NOW(),
             window_ends_at = NOW() + INTERVAL '5 hours',
             input_tokens = 0,
             output_tokens = 0,
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING window_key, window_started_at, window_ends_at,
                   input_tokens, output_tokens`,
        [userId]
      );
      window = reset.rows[0]!;
    }

    await client.query(
      `DELETE FROM llm_token_reservations
       WHERE user_id = $1 AND expires_at <= NOW()`,
      [userId]
    );
    const active = await client.query<{
      input_tokens: number | string;
      output_tokens: number | string;
    }>(
      `SELECT
         COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
         COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
       FROM llm_token_reservations
       WHERE user_id = $1 AND window_key = $2`,
      [userId, window.window_key]
    );

    const usedInputTokens = nonNegativeInteger(window.input_tokens);
    const usedOutputTokens = nonNegativeInteger(window.output_tokens);
    const reservedInputTokens = nonNegativeInteger(active.rows[0]?.input_tokens);
    const reservedOutputTokens = nonNegativeInteger(active.rows[0]?.output_tokens);
    const availableInputTokens =
      LLM_INPUT_TOKEN_LIMIT - usedInputTokens - reservedInputTokens;
    const availableOutputTokens =
      LLM_OUTPUT_TOKEN_LIMIT - usedOutputTokens - reservedOutputTokens;
    if (
      requestedInputTokens > availableInputTokens ||
      availableOutputTokens <= 0
    ) {
      throw new LlmTokenLimitError(new Date(window.window_ends_at), now);
    }
    const outputReservationTokens = Math.min(
      requestedOutputTokens,
      availableOutputTokens
    );

    const reservation = await client.query<{
      id: string;
    }>(
      `INSERT INTO llm_token_reservations
         (user_id, window_key, input_tokens, output_tokens, expires_at)
       VALUES ($1, $2, $3, $4, LEAST($5::timestamptz, NOW() + INTERVAL '10 minutes'))
       RETURNING id`,
      [
        userId,
        window.window_key,
        requestedInputTokens,
        outputReservationTokens,
        window.window_ends_at
      ]
    );

    await client.query("COMMIT");
    return {
      id: reservation.rows[0]!.id,
      userId,
      windowKey: window.window_key,
      inputTokens: requestedInputTokens,
      outputTokens: outputReservationTokens
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function settleLlmTokens(
  reservation: TokenReservation,
  usage: LlmMessageResponse["usage"] | undefined
): Promise<void> {
  const measured = measuredLlmUsage(usage);
  const inputTokens = measured.inputTokens ?? reservation.inputTokens;
  const outputTokens = measured.outputTokens ?? reservation.outputTokens;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext('llm_token_rate_limit'))",
      [reservation.userId]
    );
    const found = await client.query(
      `SELECT id FROM llm_token_reservations
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [reservation.id, reservation.userId]
    );
    if (found.rows.length > 0) {
      await client.query(
        "DELETE FROM llm_token_reservations WHERE id = $1",
        [reservation.id]
      );
      await client.query(
        `UPDATE llm_token_usage_windows
         SET input_tokens = input_tokens + $1,
             output_tokens = output_tokens + $2,
             updated_at = NOW()
         WHERE user_id = $3 AND window_key = $4
           AND window_ends_at > NOW()`,
        [inputTokens, outputTokens, reservation.userId, reservation.windowKey]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseLlmTokens(
  reservation: TokenReservation
): Promise<void> {
  try {
    await pool.query(
      "DELETE FROM llm_token_reservations WHERE id = $1 AND user_id = $2",
      [reservation.id, reservation.userId]
    );
  } catch {
    // The provider failure is more useful to the caller than cleanup failure.
  }
}

async function currentWindow(
  client: { query: typeof pool.query },
  userId: string
): Promise<UsageWindowRow | null> {
  const result = await client.query<UsageWindowRow>(
    `SELECT window_key, window_started_at, window_ends_at,
            input_tokens, output_tokens
     FROM llm_token_usage_windows
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );
  return result.rows[0] ?? null;
}

function estimateContentTokens(content: LlmMessageInput["messages"][number]["content"]): number {
  if (typeof content === "string") return estimateTextTokens(content);
  return content.reduce((total, block) => {
    if (block.type === "image") return total + 1000;
    if (block.type === "text") return total + estimateTextTokens(block.text);
    return total + estimateTextTokens(JSON.stringify(block));
  }, 0);
}

function estimateTextTokens(value: string): number {
  if (!value) return 0;
  return Math.max(1, Math.ceil(Buffer.byteLength(value, "utf8") / 4));
}

function nonNegativeInteger(value: number | string | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

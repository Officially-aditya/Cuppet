import { pool } from "../db/index.js";
import { handleAssistantMessage } from "../assistant/handler.js";
import { withLlmUser } from "../agents/token-rate-limit.js";

type AcceptedSuggestion = {
  id: string;
  user_id: string;
  status: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  continuation_started_at: Date | string | null;
  continuation_message_id: string | null;
};

export async function resumeAcceptedCapabilitySuggestion(input: {
  userId: string;
  suggestionId: string;
}): Promise<{ message_id: string; idempotent?: boolean }> {
  const client = await pool.connect();
  let sourceMessageId = "";
  let assistantId = "";
  let text = "";
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<AcceptedSuggestion>(
      `SELECT s.id, s.user_id, s.status, s.action_type,
              s.action_payload, s.continuation_started_at,
              s.continuation_message_id
       FROM suggestions s
       WHERE s.id = $1 AND s.user_id = $2
       FOR UPDATE`,
      [input.suggestionId, input.userId]
    );
    const suggestion = rows[0];
    if (!suggestion || suggestion.status !== "accepted" || suggestion.action_type !== "capability_connection") {
      await client.query("ROLLBACK");
      throw new ContinuationError("CONTINUATION_NOT_AVAILABLE", "This connection request cannot be resumed.", 409);
    }
    if (suggestion.continuation_message_id) {
      await client.query("COMMIT");
      return { message_id: suggestion.continuation_message_id, idempotent: true };
    }
    if (
      suggestion.continuation_started_at &&
      Date.now() - new Date(suggestion.continuation_started_at).getTime() < 10 * 60_000
    ) {
      await client.query("ROLLBACK");
      throw new ContinuationError("CONTINUATION_IN_PROGRESS", "The original request is already being resumed.", 409);
    }

    sourceMessageId = stringValue(suggestion.action_payload.source_message_id);
    if (!sourceMessageId) {
      await client.query("ROLLBACK");
      throw new ContinuationError("CONTINUATION_SOURCE_MISSING", "The original request is no longer available.", 409);
    }
    const source = await client.query<{
      agent_id: string;
      body: string | null;
      text: string | null;
    }>(
      `SELECT m.agent_id,
              m.content #>> '{data,body}' AS body,
              m.content #>> '{data,text}' AS text
       FROM agent_messages m
       JOIN agents a ON a.id = m.agent_id AND a.user_id = m.user_id
       WHERE m.id = $1 AND m.user_id = $2 AND m.role = 'user'
         AND a.is_assistant = TRUE
       LIMIT 1`,
      [sourceMessageId, input.userId]
    );
    const sourceRow = source.rows[0];
    text = (sourceRow?.body ?? sourceRow?.text ?? "").trim();
    assistantId = sourceRow?.agent_id ?? "";
    if (!assistantId || !text) {
      await client.query("ROLLBACK");
      throw new ContinuationError("CONTINUATION_SOURCE_MISSING", "The original request is no longer available.", 409);
    }
    await client.query(
      `UPDATE suggestions
       SET continuation_started_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [input.suggestionId, input.userId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  try {
    const result = await withLlmUser(input.userId, () =>
      handleAssistantMessage({
        userId: input.userId,
        assistantId,
        text,
        reuseSourceMessageId: sourceMessageId
      })
    );
    await pool.query(
      `UPDATE suggestions
       SET continuation_message_id = $2
       WHERE id = $1 AND user_id = $3 AND continuation_message_id IS NULL`,
      [input.suggestionId, result.assistant_message.id, input.userId]
    );
    return { message_id: result.assistant_message.id };
  } catch (error) {
    await pool.query(
      `UPDATE suggestions
       SET continuation_started_at = NULL
       WHERE id = $1 AND user_id = $2 AND continuation_message_id IS NULL`,
      [input.suggestionId, input.userId]
    ).catch(() => undefined);
    throw error;
  }
}

class ContinuationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = "ContinuationError";
  }
}

export { ContinuationError };

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

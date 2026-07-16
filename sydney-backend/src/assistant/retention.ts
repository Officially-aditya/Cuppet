import { config } from "../config.js";
import { pool } from "../db/index.js";

export type AssistantRetentionCounts = {
  confirmedMemories: number;
  memorySourceLists: number;
  attachmentContexts: number;
  pendingActions: number;
  actionAudits: number;
  chatMessages: number;
};

export async function cleanAssistantRetention(): Promise<AssistantRetentionCounts> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const confirmedMemories = await client.query(
      `WITH ranked AS (
         SELECT id,
                row_number() OVER (
                  PARTITION BY user_id
                  ORDER BY updated_at DESC, id DESC
                ) AS position
         FROM assistant_memories
         WHERE status = 'confirmed'
       )
       DELETE FROM assistant_memories AS memory
       USING ranked
       WHERE memory.id = ranked.id AND ranked.position > $1`,
      [config.ASSISTANT_MAX_CONFIRMED_MEMORIES]
    );
    const memorySourceLists = await client.query(
      `UPDATE assistant_memories AS memory
       SET source_message_ids = (
         SELECT COALESCE(array_agg(source.id ORDER BY source.position), '{}'::uuid[])
         FROM unnest(memory.source_message_ids) WITH ORDINALITY AS source(id, position)
         WHERE source.position > GREATEST(
           cardinality(memory.source_message_ids) - $1::int,
           0
         )
       )
       WHERE cardinality(memory.source_message_ids) > $1`,
      [config.ASSISTANT_MEMORY_SOURCE_MESSAGE_LIMIT]
    );
    const attachmentContexts = await client.query(
      `UPDATE message_attachments
       SET extracted_context = NULL, context_purged_at = NOW()
       WHERE extracted_context IS NOT NULL AND context_expires_at <= NOW()`
    );
    const pendingActions = await client.query(
      `DELETE FROM assistant_pending_actions
       WHERE (consumed_at IS NOT NULL AND consumed_at <
                NOW() - ($1::int * INTERVAL '1 day'))
          OR (consumed_at IS NULL AND expires_at <
                NOW() - ($1::int * INTERVAL '1 day'))`,
      [config.ASSISTANT_PENDING_ACTION_RETENTION_DAYS]
    );
    const actionAudits = await client.query(
      `DELETE FROM assistant_agent_action_audits
       WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`,
      [config.ASSISTANT_AGENT_AUDIT_RETENTION_DAYS]
    );
    const chatMessages = await client.query(
      `DELETE FROM agent_messages AS message
       USING agents AS agent
       WHERE message.agent_id = agent.id
         AND message.user_id = agent.user_id
         AND agent.is_assistant = TRUE
         AND message.created_at < NOW() - ($1::int * INTERVAL '1 day')`,
      [config.ASSISTANT_CHAT_RETENTION_DAYS]
    );
    await client.query("COMMIT");
    return {
      confirmedMemories: confirmedMemories.rowCount ?? 0,
      memorySourceLists: memorySourceLists.rowCount ?? 0,
      attachmentContexts: attachmentContexts.rowCount ?? 0,
      pendingActions: pendingActions.rowCount ?? 0,
      actionAudits: actionAudits.rowCount ?? 0,
      chatMessages: chatMessages.rowCount ?? 0
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

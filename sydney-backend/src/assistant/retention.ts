import { config } from "../config.js";
import { pool } from "../db/index.js";
import { sendPushNotification } from "../notifications/push.js";

export type AssistantRetentionCounts = {
  memorySourceLists: number;
  attachmentContexts: number;
  pendingActions: number;
  actionAudits: number;
  chatMessages: number;
  archiveFailureReceipts: number;
  archiveWarnings: number;
};

type ExpiredMessage = {
  id: string;
  user_id: string;
  agent_id: string;
  created_at: Date | string;
  archived: boolean;
  archive_enabled: boolean;
};

const cleanupLockName = "cuppet_message_retention_cleanup_v2";
const deleteBatchSize = 500;

export function isMessageWithinRetention(
  createdAt: Date | string,
  now: Date | string,
  days = config.MESSAGE_RETENTION_DAYS
): boolean {
  return new Date(createdAt).getTime() >
    new Date(now).getTime() - days * 24 * 60 * 60 * 1000;
}

/**
 * Applies content retention under a cluster-wide advisory lock. Each call
 * deletes at most one bounded message batch so replicas and API processes can
 * safely run the hourly coordinator at the same time.
 */
export async function cleanAssistantRetention(): Promise<AssistantRetentionCounts> {
  const client = await pool.connect();
  let lockHeld = false;
  const warningUsers = new Set<string>();
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [cleanupLockName]
    );
    lockHeld = Boolean(lock.rows[0]?.locked);
    if (!lockHeld) return emptyCounts();

    await client.query("BEGIN");
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

    // One warning per opt-in user when an unarchived message reaches day 27.
    if (config.MESSAGE_ARCHIVE_ENABLED) {
      const warnings = await client.query<{ user_id: string }>(
        `UPDATE message_archive_settings AS setting
         SET status = 'action_required',
             error_code = COALESCE(setting.error_code, 'archive_incomplete_day_27'),
             warning_sent_at = NOW()
         WHERE setting.enabled = TRUE
           AND setting.warning_sent_at IS NULL
           AND EXISTS (
             SELECT 1
             FROM agent_messages AS message
             LEFT JOIN message_archive_entries AS entry ON entry.message_id = message.id
             WHERE message.user_id = setting.user_id
               AND entry.message_id IS NULL
               AND message.created_at <= NOW() - INTERVAL '27 days'
               AND message.created_at > NOW() - ($1::int * INTERVAL '1 day')
           )
         RETURNING setting.user_id`,
        [config.MESSAGE_RETENTION_DAYS]
      );
      warnings.rows.forEach((row) => warningUsers.add(row.user_id));
    }

    let chatMessages = 0;
    let archiveFailureReceipts = 0;
    if (config.MESSAGE_RETENTION_DELETION_ENABLED) {
      const expired = await client.query<ExpiredMessage>(
        `SELECT message.id, message.user_id, message.agent_id, message.created_at,
                (entry.message_id IS NOT NULL) AS archived,
                COALESCE(setting.enabled, FALSE) AS archive_enabled
         FROM agent_messages AS message
         LEFT JOIN message_archive_entries AS entry ON entry.message_id = message.id
         LEFT JOIN message_archive_settings AS setting ON setting.user_id = message.user_id
         WHERE message.created_at <= NOW() - ($1::int * INTERVAL '1 day')
         ORDER BY message.created_at ASC, message.id ASC
         LIMIT $2
         FOR UPDATE OF message SKIP LOCKED`,
        [config.MESSAGE_RETENTION_DAYS, deleteBatchSize]
      );

      if (expired.rows.length > 0) {
        const messageIds = expired.rows.map((row) => row.id);
        const pairs = [...new Map(
          expired.rows.map((row) => [`${row.user_id}:${row.agent_id}`, row])
        ).values()];
        for (const pair of pairs) {
          await client.query(
            "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
            [pair.user_id, pair.agent_id]
          );
        }

        // The archive worker may have completed while this cleanup transaction
        // waited for the per-thread lock. Re-check receipts after the lock so a
        // successful last-moment upload is never recorded as a failure.
        const archivedNow = await client.query<{ message_id: string }>(
          `SELECT message_id FROM message_archive_entries
           WHERE message_id = ANY($1::uuid[])`,
          [messageIds]
        );
        const archivedIds = new Set(archivedNow.rows.map((row) => row.message_id));
        const failureRows = expired.rows.filter(
          (row) => config.MESSAGE_ARCHIVE_ENABLED &&
            row.archive_enabled &&
            !archivedIds.has(row.id)
        );
        if (failureRows.length > 0) {
          const receipts = await client.query(
            `INSERT INTO message_archive_failure_receipts
               (user_id, agent_id, message_date, message_count, error_code)
             SELECT message.user_id, message.agent_id,
                    (message.created_at AT TIME ZONE 'UTC')::date,
                    COUNT(*)::int, 'not_archived_before_retention_deadline'
             FROM agent_messages AS message
             WHERE message.id = ANY($1::uuid[])
             GROUP BY message.user_id, message.agent_id,
                      (message.created_at AT TIME ZONE 'UTC')::date
             ON CONFLICT (user_id, agent_id, message_date, error_code)
             DO UPDATE SET message_count =
               message_archive_failure_receipts.message_count + EXCLUDED.message_count
             RETURNING id`,
            [failureRows.map((row) => row.id)]
          );
          archiveFailureReceipts = receipts.rowCount ?? 0;
        }

        // Message IDs are evidence only. Remove references before deleting the
        // messages while retaining every memory value and state field.
        await client.query(
          `UPDATE assistant_memories AS memory
           SET source_message_ids = (
             SELECT COALESCE(array_agg(source_id), '{}'::uuid[])
             FROM unnest(memory.source_message_ids) AS source_id
             WHERE source_id <> ALL($1::uuid[])
           )
           WHERE memory.source_message_ids && $1::uuid[]`,
          [messageIds]
        );

        const deleted = await client.query(
          `DELETE FROM agent_messages WHERE id = ANY($1::uuid[])`,
          [messageIds]
        );
        chatMessages = deleted.rowCount ?? 0;

        await client.query(
          `UPDATE agents AS agent
           SET last_message_at = latest.created_at
           FROM (VALUES ${pairs.map((_, index) => `($${index + 1}::uuid)`).join(",")}) AS affected(agent_id)
           LEFT JOIN LATERAL (
             SELECT MAX(message.created_at) AS created_at
             FROM agent_messages AS message
             WHERE message.agent_id = affected.agent_id
               AND message.created_at > NOW() - ($${pairs.length + 1}::int * INTERVAL '1 day')
           ) AS latest ON TRUE
           WHERE agent.id = affected.agent_id`,
          [...pairs.map((pair) => pair.agent_id), config.MESSAGE_RETENTION_DAYS]
        );
      }
    }

    await client.query("COMMIT");

    await Promise.all(
      [...warningUsers].map((userId) =>
        sendPushNotification(pool, userId, {
          title: "Google Drive archive needs attention",
          body: "Some conversations have not archived and will still be deleted at 30 days.",
          data: { type: "message_archive.action_required" }
        }).catch(() => undefined)
      )
    );

    return {
      memorySourceLists: memorySourceLists.rowCount ?? 0,
      attachmentContexts: attachmentContexts.rowCount ?? 0,
      pendingActions: pendingActions.rowCount ?? 0,
      actionAudits: actionAudits.rowCount ?? 0,
      chatMessages,
      archiveFailureReceipts,
      archiveWarnings: warningUsers.size
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    if (lockHeld) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [cleanupLockName])
        .catch(() => undefined);
    }
    client.release();
  }
}

function emptyCounts(): AssistantRetentionCounts {
  return {
    memorySourceLists: 0,
    attachmentContexts: 0,
    pendingActions: 0,
    actionAudits: 0,
    chatMessages: 0,
    archiveFailureReceipts: 0,
    archiveWarnings: 0
  };
}

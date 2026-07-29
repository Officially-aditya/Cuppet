import { Worker, type Job } from "bullmq";
import { pool } from "../db/index.js";
import { rebuildPreferenceProfile } from "../personalization/profile-builder.js";
import {
  evaluateAndDeliverProactiveSuggestion,
  evaluateScheduledProactiveSuggestions,
  stageDeferredSuggestion
} from "../suggestions/proactive-delivery.js";
import {
  enqueuePersonalizationOutbox,
  personalizationJobName,
  personalizationQueueName,
  redisConnection,
  type PersonalizationJobData
} from "../queue/index.js";

const processingLeaseMs = 15 * 60_000;

export function createPersonalizationWorker() {
  return new Worker<PersonalizationJobData>(
    personalizationQueueName,
    async (job: Job<PersonalizationJobData>) => {
      if (job.name !== personalizationJobName) return { skipped: "unknown_job" };
      return processPersonalizationOutbox(job.data.outboxId);
    },
    { connection: redisConnection, concurrency: 2 }
  );
}

export async function enqueuePendingPersonalizationOutbox(): Promise<number> {
  await pool.query(
    `UPDATE personalization_outbox
     SET status = 'pending', processing_started_at = NULL, available_at = NOW()
     WHERE status = 'processing'
       AND (
         processing_started_at IS NULL
         OR processing_started_at < NOW() - INTERVAL '15 minutes'
       )`
  );
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id
     FROM personalization_outbox
     WHERE status IN ('pending', 'failed')
       AND available_at <= NOW()
     ORDER BY created_at ASC
     LIMIT 500`
  );
  await Promise.all(
    rows.map((row) => enqueuePersonalizationOutbox(row.id, { retry: true }))
  );
  return rows.length;
}

export async function runScheduledProactiveSuggestions(): Promise<{
  evaluated: number;
  delivered: number;
}> {
  return evaluateScheduledProactiveSuggestions();
}

export async function processPersonalizationOutbox(outboxId: string): Promise<{
  processed: boolean;
}> {
  const client = await pool.connect();
  let userId: string | null = null;
  let released = false;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{
      user_id: string;
      status: string;
      processing_started_at: Date | string | null;
    }>(
      `SELECT user_id, status, processing_started_at
       FROM personalization_outbox
       WHERE id = $1
       FOR UPDATE`,
      [outboxId]
    );
    const row = rows[0];
    if (!row || row.status === "completed") {
      await client.query("COMMIT");
      return { processed: false };
    }
    if (
      row.status === "processing" &&
      row.processing_started_at &&
      Date.now() - new Date(row.processing_started_at).getTime() < processingLeaseMs
    ) {
      await client.query("COMMIT");
      return { processed: false };
    }
    if (!["pending", "failed", "processing"].includes(row.status)) {
      await client.query("COMMIT");
      return { processed: false };
    }
    userId = row.user_id;
    await client.query(
      `UPDATE personalization_outbox
        SET status = 'processing', attempts = attempts + 1,
            processing_started_at = NOW()
        WHERE id = $1`,
      [outboxId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    released = true;
    throw error;
  } finally {
    if (!released) client.release();
  }

  try {
    await rebuildPreferenceProfile(userId!);
    await evaluateAndDeliverProactiveSuggestion(userId!);
    await stageDeferredSuggestion(userId!);
    await pool.query(
      `UPDATE personalization_outbox
       SET status = 'completed', processing_started_at = NULL, processed_at = NOW()
       WHERE id = $1`,
      [outboxId]
    );
    return { processed: true };
  } catch (error) {
    await pool.query(
      `UPDATE personalization_outbox
       SET status = 'failed', processing_started_at = NULL,
           available_at = NOW() + INTERVAL '5 minutes'
       WHERE id = $1`,
      [outboxId]
    ).catch(() => undefined);
    throw error;
  }
}

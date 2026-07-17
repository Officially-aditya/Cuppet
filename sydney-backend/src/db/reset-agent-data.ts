import { pool, closeDatabase } from "./index.js";
import {
  agentExecutorQueue,
  closeQueue,
  listAgentSchedules,
  removeAgentSchedule
} from "../queue/index.js";

const confirmation = "--confirm-agent-reset";

if (!process.argv.includes(confirmation)) {
  console.error(
    `Refusing destructive reset. Re-run with ${confirmation} after taking a database snapshot and stopping API event ingestion and workers.`
  );
  process.exitCode = 2;
} else {
  await resetAgentData();
}

async function resetAgentData(): Promise<void> {
  await agentExecutorQueue.pause();
  try {
    const activeJobs = await agentExecutorQueue.getJobs(["active"], 0, -1, true);
    if (activeJobs.length > 0) {
      throw new Error(
        "Agent workers are still active. Stop every worker before resetting agent data."
      );
    }
    const schedules = await listAgentSchedules();
    for (const schedule of schedules) {
      if (!schedule.key.startsWith("agent:")) continue;
      await removeAgentSchedule(schedule.key.slice("agent:".length));
    }
    const jobs = await agentExecutorQueue.getJobs(
      ["wait", "delayed", "paused", "prioritized", "completed", "failed"],
      0,
      -1,
      true
    );
    for (const job of jobs) {
      await job.remove();
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("LOCK TABLE agents IN ACCESS EXCLUSIVE MODE");
      const availableTables = new Set(
        (
          await client.query<{ table_name: string }>(
            `SELECT table_name
             FROM information_schema.tables
             WHERE table_schema = current_schema()`
          )
        ).rows.map((row) => row.table_name)
      );
      if (availableTables.has("assistant_memories")) {
        await client.query(
          `DELETE FROM assistant_memories AS memory
           WHERE EXISTS (
             SELECT 1
             FROM agent_messages AS message
             WHERE message.id = ANY(memory.source_message_ids)
           )`
        );
      }
      if (availableTables.has("assistant_memory_digests")) {
        await client.query(
          `DELETE FROM assistant_memory_digests AS digest
           WHERE EXISTS (
             SELECT 1 FROM agents WHERE agents.user_id = digest.user_id
           )`
        );
      }
      if (availableTables.has("assistant_pending_actions")) {
        await client.query("DELETE FROM assistant_pending_actions");
      }
      if (availableTables.has("assistant_agent_action_audits")) {
        await client.query("DELETE FROM assistant_agent_action_audits");
      }
      if (availableTables.has("message_archive_failure_receipts")) {
        await client.query(
          "DELETE FROM message_archive_failure_receipts WHERE agent_id IS NOT NULL"
        );
      }
      if (availableTables.has("event_deliveries")) {
        await client.query("DELETE FROM event_deliveries");
      }
      if (availableTables.has("inbound_events")) {
        await client.query("DELETE FROM inbound_events");
      }
      await client.query("DELETE FROM agents");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await agentExecutorQueue.resume();
    console.log(
      "Agent data reset complete. User accounts, auth, time zones, connector credentials/installations/statuses, and provider subscriptions were preserved."
    );
  } finally {
    await Promise.allSettled([closeQueue(), closeDatabase()]);
  }
}

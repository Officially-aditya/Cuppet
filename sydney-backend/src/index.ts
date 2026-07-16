import { syncActiveAgentSchedules } from "./agents/scheduler.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase, pool } from "./db/index.js";
import { initializeFirebase } from "./notifications/firebase.js";
import { closeQueue } from "./queue/index.js";
import { createAgentExecutorWorker } from "./workers/agent-executor.js";
import { setAgentWorkerRuntimeStatus } from "./workers/runtime-status.js";
import {
  renewGmailPushWatches,
  renewGooglePushWatches
} from "./connectors/google-workspace.js";
import { cleanAssistantRetention } from "./assistant/retention.js";
import { compactOverCapacityMemories } from "./assistant/memory.js";
import { coordinateMessageArchives } from "./archive/message-archive.js";
import { createMessageArchiveWorker } from "./workers/message-archive-worker.js";

// Initialize Firebase on startup
initializeFirebase();

const app = await buildApp();
const embeddedWorker = createAgentExecutorWorker();
const embeddedArchiveWorker = createMessageArchiveWorker();

setAgentWorkerRuntimeStatus("starting");
embeddedWorker.on("ready", () => {
  setAgentWorkerRuntimeStatus("ready");
  app.log.info("Embedded agent worker is ready");
});
embeddedWorker.on("completed", (job, result) => {
  app.log.info({ jobId: job.id, result }, "Agent job completed");
});
embeddedWorker.on("failed", (job, error) => {
  app.log.error({ jobId: job?.id, error }, "Agent job failed");
});
embeddedWorker.on("error", (error) => {
  setAgentWorkerRuntimeStatus("error");
  app.log.error({ error }, "Embedded agent worker error");
});

async function cleanExpiredUploads(): Promise<void> {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM uploaded_files WHERE expires_at < NOW()"
    );
    if (rowCount && rowCount > 0) {
      app.log.info({ count: rowCount }, "Cleaned up expired uploaded files");
    }
  } catch (error) {
    app.log.error(error, "Failed to clean up expired uploaded files");
  }
}

async function runAssistantRetentionCleanup(): Promise<void> {
  try {
    const [counts, compactedUsers] = await Promise.all([
      cleanAssistantRetention(),
      compactOverCapacityMemories()
    ]);
    if (Object.values(counts).some((count) => count > 0) || compactedUsers > 0) {
      app.log.info({ counts, compacted_users: compactedUsers }, "Applied storage retention and memory compaction");
    }
  } catch (error) {
    app.log.error(error, "Failed to apply Assistant storage retention");
  }
}

try {
  await waitForWorkerReady(embeddedWorker.waitUntilReady(), 15_000);
  setAgentWorkerRuntimeStatus("ready");
  await waitForWorkerReady(embeddedArchiveWorker.waitUntilReady(), 15_000);
  app.log.info("Embedded message archive worker is ready");
  await syncActiveAgentSchedules(app.log);
  
  // Prune temporary binaries and Assistant records immediately and hourly.
  await Promise.all([cleanExpiredUploads(), runAssistantRetentionCleanup()]);
  const cleanupTimer = setInterval(() => {
    Promise.all([cleanExpiredUploads(), runAssistantRetentionCleanup()]).catch(
      (error) => app.log.error(error, "Cleanup error")
    );
  }, 60 * 60 * 1000);
  // Keep track of the timer so we can clear it on shutdown if needed, or let it run
  cleanupTimer.unref();

  await coordinateMessageArchives();
  const archiveTimer = setInterval(() => {
    coordinateMessageArchives().catch((error) =>
      app.log.error({ error }, "Failed to coordinate message archives")
    );
  }, 60 * 60 * 1000);
  archiveTimer.unref();

  const renewGmailWatches = async () => {
    const [gmail, google] = await Promise.all([
      renewGmailPushWatches(),
      renewGooglePushWatches()
    ]);
    if (
      gmail.renewed > 0 ||
      gmail.failed > 0 ||
      google.renewed > 0 ||
      google.failed > 0
    ) {
      app.log.info({ gmail, google }, "Renewed Google push watches");
    }
  };
  renewGmailWatches().catch((error) =>
    app.log.error({ error }, "Failed to renew Gmail push watches")
  );
  const gmailWatchTimer = setInterval(
    () =>
      renewGmailWatches().catch((error) =>
        app.log.error({ error }, "Failed to renew Gmail push watches")
      ),
    24 * 60 * 60 * 1000
  );
  gmailWatchTimer.unref();

  await app.listen({
    host: config.HOST,
    port: config.PORT
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "Shutting down API server");
  await app.close();
  await embeddedWorker.close();
  setAgentWorkerRuntimeStatus("closed");
  await embeddedArchiveWorker.close();
  await closeQueue();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function waitForWorkerReady(
  ready: Promise<unknown>,
  timeoutMs: number
): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      ready,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Agent worker did not become ready in time.")),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

import { syncActiveAgentSchedules } from "./agents/scheduler.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase, pool } from "./db/index.js";
import { initializeFirebase } from "./notifications/firebase.js";
import { closeQueue } from "./queue/index.js";
import { createAgentExecutorWorker } from "./workers/agent-executor.js";
import { setAgentWorkerRuntimeStatus } from "./workers/runtime-status.js";

// Initialize Firebase on startup
initializeFirebase();

const app = await buildApp();
const embeddedWorker = config.RUN_AGENT_WORKER_IN_API
  ? createAgentExecutorWorker()
  : null;

if (embeddedWorker) {
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
} else {
  setAgentWorkerRuntimeStatus("disabled");
  app.log.info("Embedded agent worker disabled; expecting a dedicated worker service");
}

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

try {
  if (embeddedWorker) {
    await waitForWorkerReady(embeddedWorker.waitUntilReady(), 15_000);
    setAgentWorkerRuntimeStatus("ready");
  }
  await syncActiveAgentSchedules(app.log);
  
  // Prune expired uploads immediately and run hourly
  await cleanExpiredUploads();
  const cleanupTimer = setInterval(() => {
    cleanExpiredUploads().catch((err) => app.log.error(err, "Cleanup error"));
  }, 60 * 60 * 1000);
  // Keep track of the timer so we can clear it on shutdown if needed, or let it run
  cleanupTimer.unref();

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
  if (embeddedWorker) {
    await embeddedWorker.close();
    setAgentWorkerRuntimeStatus("closed");
  }
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

import { closeDatabase } from "./src/db/index.js";
import { initializeFirebase } from "./src/notifications/firebase.js";
import { closeQueue } from "./src/queue/index.js";
import { createAgentExecutorWorker } from "./src/workers/agent-executor.js";
import { config } from "./src/config.js";
import { createMessageArchiveWorker } from "./src/workers/message-archive-worker.js";

// Initialize Firebase on worker startup
initializeFirebase();

const worker = createAgentExecutorWorker();
const archiveWorker = config.MESSAGE_ARCHIVE_ENABLED
  ? createMessageArchiveWorker()
  : null;

worker.on("completed", (job, result) => {
  console.log(`Agent job completed: ${job.id}`, result);
});

worker.on("failed", (job, error) => {
  console.error(`Agent job failed: ${job?.id ?? "unknown"}`, error);
});

worker.on("error", (error) => {
  console.error("Agent executor worker error", error);
});

await worker.waitUntilReady();
if (archiveWorker) await archiveWorker.waitUntilReady();
console.log("Cuppet worker is connected to Redis and listening for agent jobs.");

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`Sydney worker shutting down: ${signal}`);
  await worker.close();
  if (archiveWorker) await archiveWorker.close();
  await closeQueue();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

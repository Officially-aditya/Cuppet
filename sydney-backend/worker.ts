import { closeDatabase } from "./src/db/index.js";
import { initializeFirebase } from "./src/notifications/firebase.js";
import { closeQueue } from "./src/queue/index.js";
import { createAgentExecutorWorker } from "./src/workers/agent-executor.js";
import { createMessageArchiveWorker } from "./src/workers/message-archive-worker.js";
import {
  createPersonalizationWorker,
  enqueuePendingPersonalizationOutbox,
  runScheduledProactiveSuggestions
} from "./src/workers/personalization-worker.js";

// Initialize Firebase on worker startup
initializeFirebase();

const worker = createAgentExecutorWorker();
const archiveWorker = createMessageArchiveWorker();
const personalizationWorker = createPersonalizationWorker();

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
await archiveWorker.waitUntilReady();
await personalizationWorker.waitUntilReady();
await enqueuePendingPersonalizationOutbox();
const personalizationRecoveryTimer = setInterval(() => {
  void enqueuePendingPersonalizationOutbox().catch((error) => {
    console.error("Personalization outbox recovery failed", error);
  });
}, 60_000);
personalizationRecoveryTimer.unref();
const proactiveSuggestionTimer = setInterval(() => {
  void runScheduledProactiveSuggestions().catch((error) => {
    console.error("Scheduled suggestion evaluation failed", error);
  });
}, 15 * 60_000);
proactiveSuggestionTimer.unref();
console.log("Cuppet worker is connected to Redis and listening for agent jobs.");

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`Sydney worker shutting down: ${signal}`);
  await worker.close();
  await archiveWorker.close();
  await personalizationWorker.close();
  clearInterval(personalizationRecoveryTimer);
  clearInterval(proactiveSuggestionTimer);
  await closeQueue();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

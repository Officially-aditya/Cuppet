import { closeDatabase } from "./src/db/index.js";
import { closeQueue } from "./src/queue/index.js";
import { createAgentExecutorWorker } from "./src/workers/agent-executor.js";

const worker = createAgentExecutorWorker();

console.log("Sydney worker booted. Agent executor is listening.");

worker.on("completed", (job, result) => {
  console.log(`Agent job completed: ${job.id}`, result);
});

worker.on("failed", (job, error) => {
  console.error(`Agent job failed: ${job?.id ?? "unknown"}`, error);
});

worker.on("error", (error) => {
  console.error("Agent executor worker error", error);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`Sydney worker shutting down: ${signal}`);
  await worker.close();
  await closeQueue();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

import { syncActiveAgentSchedules } from "./agents/scheduler.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase } from "./db/index.js";
import { initializeFirebase } from "./notifications/firebase.js";
import { closeQueue } from "./queue/index.js";

// Initialize Firebase on startup
initializeFirebase();

const app = await buildApp();

try {
  await syncActiveAgentSchedules(app.log);
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
  await closeQueue();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

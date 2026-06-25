import { syncActiveAgentSchedules } from "./agents/scheduler.js";
import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase, pool } from "./db/index.js";
import { initializeFirebase } from "./notifications/firebase.js";
import { closeQueue } from "./queue/index.js";

// Initialize Firebase on startup
initializeFirebase();

const app = await buildApp();

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
  await closeQueue();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

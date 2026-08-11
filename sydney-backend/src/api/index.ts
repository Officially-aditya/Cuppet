import type { FastifyInstance } from "fastify";
import { agentRoutes } from "../agents/routes.js";
import { authRoutes } from "../auth/routes.js";
import { connectorRoutes } from "../connectors/routes.js";
import { messageRoutes } from "../messages/routes.js";
import { notificationRoutes } from "../notifications/routes.js";
import { realtimeRoutes } from "../realtime/routes.js";
import { uploadRoutes } from "../uploads/routes.js";
import { agentWorkerRuntimeStatus } from "../workers/runtime-status.js";
import { config } from "../config.js";
import { eventRoutes } from "../events/routes.js";
import { userRoutes } from "../users/routes.js";
import { assistantMemoryRoutes } from "../assistant/memory-routes.js";
import { messageArchiveRoutes } from "../archive/routes.js";
import { accessRoutes } from "../access/routes.js";
import { personalizationRoutes } from "../personalization/routes.js";
import { suggestionRoutes } from "../suggestions/routes.js";
import { waitlistRoutes } from "../waitlist/routes.js";
import { feedbackRoutes } from "../feedback/routes.js";

export async function registerApi(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(assistantMemoryRoutes);
  await app.register(messageArchiveRoutes);
  await app.register(accessRoutes);
  await app.register(personalizationRoutes);
  await app.register(suggestionRoutes);
  await app.register(waitlistRoutes);
  await app.register(feedbackRoutes);
  await app.register(agentRoutes);
  await app.register(connectorRoutes);
  await app.register(messageRoutes);
  await app.register(notificationRoutes);
  await app.register(realtimeRoutes);
  await app.register(uploadRoutes);
  await app.register(eventRoutes);

  app.get("/health", async (_request, reply) => {
    const workerStatus = agentWorkerRuntimeStatus();
    const healthy = workerStatus === "ready";
    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? "ok" : "unavailable",
      service: "sydney-backend",
      agent_worker: workerStatus
    });
  });

  app.get("/debug-db", async () => {
    const { pool } = await import("../db/index.js");
    const agents = await pool.query("SELECT id, name, prompt, parsed_intent, status FROM agents ORDER BY created_at DESC");
    const messages = [];
    for (const agent of agents.rows) {
      const msgs = await pool.query(
        `SELECT id, role, content, created_at FROM agent_messages
         WHERE agent_id = $1
           AND created_at > NOW() - ($2::int * INTERVAL '1 day')
         ORDER BY created_at DESC LIMIT 3`,
        [agent.id, config.MESSAGE_RETENTION_DAYS]
      );
      messages.push({ agentName: agent.name, agentId: agent.id, messages: msgs.rows });
    }
    return { agents: agents.rows, messages };
  });

}

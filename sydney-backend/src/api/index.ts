import type { FastifyInstance } from "fastify";
import { agentRoutes } from "../agents/routes.js";
import { requireAuth } from "../auth/middleware.js";
import { authRoutes } from "../auth/routes.js";
import { connectorRoutes } from "../connectors/routes.js";
import { messageRoutes } from "../messages/routes.js";
import { notificationRoutes } from "../notifications/routes.js";
import { realtimeRoutes } from "../realtime/routes.js";
import { uploadRoutes } from "../uploads/routes.js";
import { agentWorkerRuntimeStatus } from "../workers/runtime-status.js";
import { config } from "../config.js";
import { eventRoutes } from "../events/routes.js";

export async function registerApi(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes);
  await app.register(agentRoutes);
  await app.register(connectorRoutes);
  await app.register(messageRoutes);
  await app.register(notificationRoutes);
  await app.register(realtimeRoutes);
  await app.register(uploadRoutes);
  await app.register(eventRoutes);

  app.get("/health", async (_request, reply) => {
    const workerStatus = agentWorkerRuntimeStatus();
    const healthy =
      !config.RUN_AGENT_WORKER_IN_API || workerStatus === "ready";
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
        "SELECT id, role, content, created_at FROM agent_messages WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 3",
        [agent.id]
      );
      messages.push({ agentName: agent.name, agentId: agent.id, messages: msgs.rows });
    }
    return { agents: agents.rows, messages };
  });

  app.get("/users/me", { preHandler: requireAuth }, async (request) => ({
    user: request.auth!.user,
    session: request.auth!.session
  }));
}

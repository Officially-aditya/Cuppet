import type { FastifyInstance } from "fastify";
import { agentRoutes } from "../agents/routes.js";
import { requireAuth } from "../auth/middleware.js";
import { authRoutes } from "../auth/routes.js";
import { connectorRoutes } from "../connectors/routes.js";
import { messageRoutes } from "../messages/routes.js";
import { realtimeRoutes } from "../realtime/routes.js";

export async function registerApi(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes);
  await app.register(agentRoutes);
  await app.register(connectorRoutes);
  await app.register(messageRoutes);
  await app.register(realtimeRoutes);

  app.get("/health", async () => ({
    status: "ok",
    service: "sydney-backend"
  }));

  app.get("/users/me", { preHandler: requireAuth }, async (request) => ({
    user: request.auth!.user,
    session: request.auth!.session
  }));
}

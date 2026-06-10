import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { subscribeToUserEvents, type RealtimeEvent } from "./events.js";

export async function realtimeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/events", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.auth!.userId;

    reply.hijack();
    request.raw.socket.setTimeout(0);
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    reply.raw.write(": connected\n\n");

    const send = (event: RealtimeEvent) => {
      reply.raw.write(`id: ${event.id}\n`);
      reply.raw.write(`event: ${event.type}\n`);
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const unsubscribe = await subscribeToUserEvents(userId, send, request.log);
    const heartbeat = setInterval(() => {
      reply.raw.write(": ping\n\n");
    }, 25000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}

import type { FastifyInstance } from "fastify";
import { isUuid } from "../api/ids.js";
import { requireAuth } from "../auth/middleware.js";
import {
  deleteAllMemories,
  forgetMemoryById,
  listConfirmedMemories
} from "./memory.js";

export async function assistantMemoryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/users/me/assistant-memories",
    { preHandler: requireAuth },
    async (request) => ({
      memories: await listConfirmedMemories(request.auth!.userId)
    })
  );

  app.delete(
    "/users/me/assistant-memories/:memoryId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { memoryId } = request.params as { memoryId: string };
      if (!isUuid(memoryId)) {
        return reply.code(404).send({
          error: { code: "MEMORY_NOT_FOUND", message: "Memory not found." }
        });
      }
      const removed = await forgetMemoryById(request.auth!.userId, memoryId);
      if (!removed) {
        return reply.code(404).send({
          error: { code: "MEMORY_NOT_FOUND", message: "Memory not found." }
        });
      }
      return reply.code(204).send();
    }
  );

  app.delete(
    "/users/me/assistant-memories",
    { preHandler: requireAuth },
    async (request) => ({ deleted: await deleteAllMemories(request.auth!.userId) })
  );
}

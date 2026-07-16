import type { FastifyInstance } from "fastify";
import { isUuid } from "../api/ids.js";
import { requireAuth } from "../auth/middleware.js";
import {
  deleteAllMemories,
  deleteCompactedMemoryDigest,
  forgetMemoryById,
  getCompactedMemoryDigest,
  listConfirmedMemories
} from "./memory.js";

export async function assistantMemoryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/users/me/assistant-memories",
    { preHandler: requireAuth },
    async (request) => {
      const [memories, compacted] = await Promise.all([
        listConfirmedMemories(request.auth!.userId),
        getCompactedMemoryDigest(request.auth!.userId)
      ]);
      return { memories, compacted_memory: compacted };
    }
  );

  app.delete(
    "/users/me/assistant-memories/compacted",
    { preHandler: requireAuth },
    async (request, reply) => {
      const removed = await deleteCompactedMemoryDigest(request.auth!.userId);
      return removed
        ? reply.code(204).send()
        : reply.code(404).send({
            error: { code: "COMPACTED_MEMORY_NOT_FOUND", message: "Compacted memory not found." }
          });
    }
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

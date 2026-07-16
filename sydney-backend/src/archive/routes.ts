import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { isUuid } from "../api/ids.js";
import { requireAuth } from "../auth/middleware.js";
import { callbackSchemeSchema } from "../security/input-validation.js";
import { pool } from "../db/index.js";
import {
  deleteDriveArchives,
  getMessageArchiveState,
  MessageArchiveError,
  readArchivedMessages,
  updateMessageArchiveSetting
} from "./message-archive.js";

const updateArchiveSchema = z.object({
  enabled: z.boolean(),
  callback_scheme: callbackSchemeSchema.optional()
}).strict();

const deleteArchiveSchema = z.object({
  confirmation: z.literal("DELETE_DRIVE_ARCHIVES")
}).strict();

export async function messageArchiveRoutes(app: FastifyInstance): Promise<void> {
  app.get("/users/me/message-archive", { preHandler: requireAuth }, async (request) =>
    getMessageArchiveState(request.auth!.userId)
  );

  app.put("/users/me/message-archive", { preHandler: requireAuth }, async (request, reply) => {
    const body = updateArchiveSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: { code: "INVALID_MESSAGE_ARCHIVE_SETTING", message: body.error.issues[0]?.message ?? "Invalid archive setting." }
      });
    }
    try {
      return await updateMessageArchiveSetting({
        userId: request.auth!.userId,
        enabled: body.data.enabled,
        callbackScheme: body.data.callback_scheme ?? "sydney"
      });
    } catch (error) {
      return archiveError(reply, error);
    }
  });

  app.get("/agents/:agentId/archived-messages", { preHandler: requireAuth }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    if (!isUuid(agentId)) {
      return reply.code(404).send({ error: { code: "AGENT_NOT_FOUND", message: "Agent not found." } });
    }
    const owned = await pool.query(
      `SELECT 1 FROM agents WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [agentId, request.auth!.userId]
    );
    if (!owned.rows[0]) {
      return reply.code(404).send({ error: { code: "AGENT_NOT_FOUND", message: "Agent not found." } });
    }
    const query = request.query as { cursor?: string; limit?: string };
    const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit ?? "50", 10) || 50));
    try {
      return await readArchivedMessages({
        userId: request.auth!.userId,
        agentId,
        cursor: query.cursor,
        limit
      });
    } catch (error) {
      return archiveError(reply, error);
    }
  });

  app.delete("/users/me/message-archive/files", { preHandler: requireAuth }, async (request, reply) => {
    const body = deleteArchiveSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: { code: "ARCHIVE_DELETE_CONFIRMATION_REQUIRED", message: "Explicit archive deletion confirmation is required." }
      });
    }
    try {
      return await deleteDriveArchives(request.auth!.userId);
    } catch (error) {
      return archiveError(reply, error);
    }
  });
}

function archiveError(reply: FastifyReply, error: unknown) {
  if (error instanceof MessageArchiveError) {
    return reply.code(error.statusCode).send({
      error: { code: error.code, message: error.message }
    });
  }
  throw error;
}

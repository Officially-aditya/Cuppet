import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { pool } from "../db/index.js";
import { registerFCMToken, unregisterFCMToken } from "./push.js";

const registerTokenSchema = z.object({
  token: z.string().min(1),
  device_info: z.record(z.unknown()).optional(),
});

const unregisterTokenSchema = z.object({
  token: z.string().min(1),
});

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/notifications/register",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.auth!.userId;
      const body = registerTokenSchema.safeParse(request.body);

      if (!body.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_REQUEST",
            message: body.error.issues[0]?.message ?? "Invalid request.",
          },
        });
      }

      try {
        await registerFCMToken(pool, userId, body.data.token, body.data.device_info);
        return reply.code(200).send({ success: true });
      } catch (error) {
        console.error("Failed to register FCM token:", error);
        return reply.code(500).send({
          error: {
            code: "REGISTRATION_FAILED",
            message: "Failed to register push notification token.",
          },
        });
      }
    }
  );

  app.post(
    "/notifications/unregister",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.auth!.userId;
      const body = unregisterTokenSchema.safeParse(request.body);

      if (!body.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_REQUEST",
            message: body.error.issues[0]?.message ?? "Invalid request.",
          },
        });
      }

      try {
        await unregisterFCMToken(pool, userId, body.data.token);
        return reply.code(200).send({ success: true });
      } catch (error) {
        console.error("Failed to unregister FCM token:", error);
        return reply.code(500).send({
          error: {
            code: "UNREGISTRATION_FAILED",
            message: "Failed to unregister push notification token.",
          },
        });
      }
    }
  );
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { pool } from "../db/index.js";

export const feedbackRequestSchema = z
  .object({
    topic: z.enum([
      "product_idea",
      "something_went_wrong",
      "general_feedback"
    ]),
    message: z.string().trim().min(1).max(5000)
  })
  .strict();

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/feedback",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = feedbackRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_FEEDBACK",
            message: parsed.error.issues[0]?.message ?? "Invalid feedback."
          }
        });
      }

      const result = await pool.query<{
        id: string;
        topic: string;
        created_at: Date;
      }>(
        `
          INSERT INTO product_feedback (user_id, topic, message)
          VALUES ($1, $2, $3)
          RETURNING id, topic, created_at
        `,
        [request.auth!.userId, parsed.data.topic, parsed.data.message]
      );

      return reply.code(201).send({ feedback: result.rows[0] });
    }
  );
}

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/index.js";

export const waitlistRequestSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320)
  })
  .strict();

export async function waitlistRoutes(app: FastifyInstance): Promise<void> {
  app.post("/waitlist", async (request, reply) => {
    const parsed = waitlistRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_EMAIL",
          message: "Enter a valid email address."
        }
      });
    }

    try {
      const result = await pool.query<{ id: string }>(
        `
          INSERT INTO waitlists (email)
          VALUES ($1)
          ON CONFLICT DO NOTHING
          RETURNING id
        `,
        [parsed.data.email]
      );

      return reply.code(200).send({
        success: true,
        already_registered: result.rowCount === 0
      });
    } catch (error) {
      request.log.error({ error }, "Failed to save waitlist submission");
      return reply.code(500).send({
        error: {
          code: "WAITLIST_SUBMISSION_FAILED",
          message: "We could not save your email right now. Please try again."
        }
      });
    }
  });
}

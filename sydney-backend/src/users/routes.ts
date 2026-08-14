import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import {
  rescheduleActiveAgentSchedulesForUser,
  removeScheduleForAgent
} from "../agents/scheduler.js";
import {
  effectiveTimeZone,
  ianaTimeZoneSchema,
  normalizeIanaTimeZone
} from "./time-zone.js";
import { updateUserSchema } from "./schemas.js";

const updatePreferencesSchema = z
  .object({
    time_zone: ianaTimeZoneSchema.optional(),
    follow_device_time_zone: z.boolean().optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one preference is required."
  });

type UserPreferenceRow = {
  time_zone: string | null;
  follow_device_time_zone: boolean;
};

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get("/users/me", { preHandler: requireAuth }, async (request) => ({
    user: request.auth!.user,
    session: request.auth!.session,
    preferences: await loadPreferences(request.auth!.userId)
  }));

  app.patch("/users/me", { preHandler: requireAuth }, async (request, reply) => {
    if (accountBindingMismatch(request)) {
      return accountChanged(reply);
    }
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_USER_DATA",
          message: parsed.error.issues[0]?.message ?? "Invalid user data."
        }
      });
    }

    const userId = request.auth!.userId;
    const { name, image, avatar } = parsed.data;

    const result = await pool.query<{
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      avatar: number | null;
    }>(
      `
        UPDATE users
        SET name = COALESCE($2, name),
            image = COALESCE($3, image),
            avatar = COALESCE($4, avatar),
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, name, image, avatar
      `,
      [userId, name ?? null, image ?? null, avatar ?? null]
    );

    const user = result.rows[0];
    if (!user) {
      return reply.code(404).send({
        error: { code: "USER_NOT_FOUND", message: "User not found." }
      });
    }

    return { user };
  });

  app.get(
    "/users/me/preferences",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (accountBindingMismatch(request)) {
        return accountChanged(reply);
      }
      return {
        preferences: await loadPreferences(request.auth!.userId)
      };
    }
  );

  app.patch(
    "/users/me/preferences",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (accountBindingMismatch(request)) {
        return accountChanged(reply);
      }
      const parsed = updatePreferencesSchema.safeParse(request.body);
      if (!parsed.success) {
        return invalidPreferences(reply, parsed.error.issues[0]?.message);
      }

      const userId = request.auth!.userId;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        const currentResult = await client.query<UserPreferenceRow>(
          `
            SELECT time_zone, follow_device_time_zone
            FROM users
            WHERE id = $1
            FOR UPDATE
          `,
          [userId]
        );
        const current = currentResult.rows[0];
        if (!current) {
          await client.query("ROLLBACK");
          return reply.code(404).send({
            error: {
              code: "USER_NOT_FOUND",
              message: "User not found."
            }
          });
        }

        const nextFollowDevice =
          parsed.data.follow_device_time_zone ??
          current.follow_device_time_zone;
        let nextTimeZone = parsed.data.time_zone ?? current.time_zone;
        if (!nextFollowDevice && normalizeIanaTimeZone(nextTimeZone) === null) {
          nextTimeZone = effectiveTimeZone(
            current.time_zone,
            config.AGENT_SCHEDULE_TIME_ZONE
          );
        }
        const nextRow: UserPreferenceRow = {
          time_zone: nextTimeZone,
          follow_device_time_zone: nextFollowDevice
        };
        const previousEffective = effectiveTimeZone(
          current.time_zone,
          config.AGENT_SCHEDULE_TIME_ZONE
        );
        const nextPreferences = preferencePayload(nextRow);
        const scheduleSync =
          previousEffective === nextPreferences.time_zone
            ? { attempted: 0, scheduled: 0, failed: 0 }
            : await rescheduleActiveAgentSchedulesForUser(
                userId,
                nextPreferences.time_zone,
                request.log
              );

        if (scheduleSync.failed > 0) {
          await client.query("ROLLBACK");
          return reply.code(503).send({
            error: {
              code: "SCHEDULE_TIME_ZONE_SYNC_FAILED",
              message:
                "The time zone could not be applied to every scheduled agent. Please try again."
            },
            schedule_sync: scheduleSync
          });
        }

        const updateResult = await client.query<UserPreferenceRow>(
          `
            UPDATE users
            SET time_zone = $2,
                follow_device_time_zone = $3,
                updated_at = NOW()
            WHERE id = $1
            RETURNING time_zone, follow_device_time_zone
          `,
          [
            userId,
            nextRow.time_zone,
            nextRow.follow_device_time_zone
          ]
        );
        const updated = updateResult.rows[0]!;
        await client.query("COMMIT");

        return {
          preferences: preferencePayload(updated),
          schedule_sync: scheduleSync
        };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  );

  app.delete(
    "/users/me",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (accountBindingMismatch(request)) {
        return accountChanged(reply);
      }

      const userId = request.auth!.userId;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const agentsResult = await client.query<{ id: string }>(
          `SELECT id FROM agents WHERE user_id = $1`,
          [userId]
        );
        for (const agent of agentsResult.rows) {
          await removeScheduleForAgent(agent.id);
        }

        await client.query("DELETE FROM users WHERE id = $1", [userId]);

        await client.query("COMMIT");

        return reply.code(200).send({ success: true });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  );
}

async function loadPreferences(userId: string) {
  const { rows } = await pool.query<UserPreferenceRow>(
    `
      SELECT time_zone, follow_device_time_zone
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  return preferencePayload(
    rows[0] ?? { time_zone: null, follow_device_time_zone: true }
  );
}

function preferencePayload(row: UserPreferenceRow) {
  const storedTimeZone = normalizeIanaTimeZone(row.time_zone);
  return {
    time_zone: effectiveTimeZone(
      storedTimeZone,
      config.AGENT_SCHEDULE_TIME_ZONE
    ),
    time_zone_is_explicit: storedTimeZone !== null,
    follow_device_time_zone: row.follow_device_time_zone
  };
}

function invalidPreferences(reply: FastifyReply, message?: string) {
  return reply.code(400).send({
    error: {
      code: "INVALID_USER_PREFERENCES",
      message: message ?? "Invalid user preferences."
    }
  });
}

function accountBindingMismatch(request: FastifyRequest): boolean {
  const expectedUserId = request.headers["x-cuppet-expected-user"];
  return (
    typeof expectedUserId === "string" &&
    expectedUserId !== request.auth!.userId
  );
}

function accountChanged(reply: FastifyReply) {
  return reply.code(409).send({
    error: {
      code: "AUTH_ACCOUNT_CHANGED",
      message: "The signed-in account changed before this update completed."
    }
  });
}

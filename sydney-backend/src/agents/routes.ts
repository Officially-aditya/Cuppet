import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { isUuid } from "../api/ids.js";
import { pool } from "../db/index.js";
import { requireAuth } from "../auth/middleware.js";
import { enqueueAgentRun, agentExecutorQueue, agentExecutorJobName } from "../queue/index.js";
import { ensureAssistantContact } from "./assistant.js";
import { parseIntentHybrid } from "./llm-intent.js";
import type { ParsedIntent } from "./parser.js";
import { removeScheduleForAgent, syncAgentSchedule } from "./scheduler.js";
import { publishRealtimeEvent } from "../realtime/events.js";
import { hasUsableGitHubToken } from "../connectors/github.js";
import { agentCreationThreadMessage } from "./creation-message.js";
import {
  cronSchema,
  hasSecurityValidationIssue,
  shortLabelSchema,
  validatedTextSchema
} from "../security/input-validation.js";

const createAgentSchema = z
  .object({
    prompt: validatedTextSchema({ field: "Prompt", min: 3, max: 4000 })
  })
  .strict();

const updateAgentSchema = z
  .object({
    name: shortLabelSchema.optional(),
    schedule_cron: cronSchema.nullable().optional(),
    status: z.enum(["active", "paused", "error"]).optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required."
  });

const agentMessageActionSchema = z
  .object({
    action: z.enum(["done", "snooze", "skip"])
  })
  .strict();

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.get("/agents", { preHandler: requireAuth }, async (request) => {
    const userId = request.auth!.userId;
    await ensureAssistantContact(userId);

    const { rows } = await pool.query(
      `
        SELECT
          a.id,
          a.name,
          a.avatar,
          a.prompt,
          a.parsed_intent,
          a.connector_ids,
          a.schedule_cron,
          a.is_assistant,
          a.status,
          a.safety_level,
          a.last_message_at,
          a.created_at,
          a.updated_at,
          CASE
            WHEN a.is_assistant THEN a.prompt
            ELSE COALESCE(NULLIF(a.parsed_intent->>'action', ''), a.name)
          END AS description,
          COALESCE(
            NULLIF(latest_message.content #>> '{data,body}', ''),
            NULLIF(latest_message.content #>> '{data,text}', ''),
            NULLIF(latest_message.content #>> '{data,message}', ''),
            NULLIF(latest_message.content #>> '{data,detail}', ''),
            NULLIF(latest_message.content #>> '{data,title}', ''),
            CASE
              WHEN latest_message.id IS NOT NULL THEN 'New message'
              WHEN a.is_assistant THEN a.prompt
              ELSE COALESCE(NULLIF(a.parsed_intent->>'action', ''), a.prompt)
            END
          ) AS last_message_preview,
          COALESCE(latest_message.created_at, a.last_message_at, a.updated_at, a.created_at) AS latest_message_at,
          COALESCE(unread_messages.unread_count, 0)::int AS unread_count
        FROM agents a
        LEFT JOIN LATERAL (
          SELECT id, role, content, created_at
          FROM agent_messages
          WHERE agent_id = a.id AND user_id = a.user_id
          ORDER BY
            created_at DESC,
            CASE role
              WHEN 'agent' THEN 0
              WHEN 'system' THEN 1
              WHEN 'user' THEN 2
              ELSE 3
            END ASC
          LIMIT 1
        ) latest_message ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS unread_count
          FROM agent_messages
          WHERE agent_id = a.id
            AND user_id = a.user_id
            AND role IN ('agent', 'system')
            AND read_at IS NULL
        ) unread_messages ON TRUE
        WHERE a.user_id = $1
        ORDER BY
          a.is_assistant DESC,
          (COALESCE(unread_messages.unread_count, 0) > 0) DESC,
          COALESCE(unread_messages.unread_count, 0) DESC,
          latest_message_at DESC NULLS LAST,
          a.created_at DESC
      `,
      [userId]
    );

    return { agents: rows };
  });

  app.post("/agents", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.auth!.userId;
    const body = createAgentSchema.safeParse(request.body);

    if (!body.success) {
      if (hasSecurityValidationIssue(body.error)) {
        request.log.warn(
          { userId, route: "create_agent" },
          "Rejected unsafe agent input"
        );
      }
      return reply.code(400).send({
        error: {
          code: hasSecurityValidationIssue(body.error)
            ? "UNSAFE_INPUT"
            : "INVALID_AGENT_PROMPT",
          message: body.error.issues[0]?.message ?? "Invalid prompt."
        }
      });
    }

    const parsedIntent = await parseIntentHybrid(body.data.prompt);
    if (parsedIntent.unsupported_connector) {
      return reply.code(422).send({
        error: {
          code: "UNSUPPORTED_CONNECTOR",
          message: `I can't access ${parsedIntent.unsupported_connector} yet. I can monitor Gmail, Calendar, Drive, GitHub, Slack, or web search instead.`,
          unsupported_connector: parsedIntent.unsupported_connector,
          alternatives: ["gmail", "calendar", "slack", "drive", "web_search"]
        }
      });
    }

    const { rows } = await pool.query(
      `
        INSERT INTO agents
          (user_id, name, avatar, prompt, parsed_intent, connector_ids,
           schedule_cron, is_assistant, status, safety_level, last_message_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, FALSE, 'active', $8, NOW())
        RETURNING
          id,
          name,
          avatar,
          prompt,
          parsed_intent,
          connector_ids,
          schedule_cron,
          is_assistant,
          status,
          safety_level,
          last_message_at,
          created_at,
          updated_at
      `,
      [
        userId,
        parsedIntent.name,
        parsedIntent.avatar,
        body.data.prompt,
        JSON.stringify(parsedIntent),
        parsedIntent.connector_ids,
        parsedIntent.schedule_cron,
        parsedIntent.safety_level
      ]
    );

    const agent = rows[0]!;
    await writeAgentCreatedMessage(userId, agent.id, parsedIntent);
    await syncAgentSchedule(agent);
    await publishRealtimeEvent({
      type: "agent.created",
      user_id: userId,
      agent_id: agent.id,
      data: { name: agent.name }
    });

    return reply.code(201).send({ agent });
  });

  app.get("/agents/:agentId", { preHandler: requireAuth }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const userId = request.auth!.userId;

    if (!isUuid(agentId)) {
      return agentNotFound(reply);
    }

    const agent = await getAgent(userId, agentId);

    if (!agent) {
      return agentNotFound(reply);
    }

    return { agent };
  });

  app.post("/agents/:agentId/run", { preHandler: requireAuth }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const userId = request.auth!.userId;

    if (!isUuid(agentId)) {
      return agentNotFound(reply);
    }

    const agent = await getAgent(userId, agentId);

    if (!agent) {
      return agentNotFound(reply);
    }

    if (agent.is_assistant) {
      return reply.code(400).send({
        error: {
          code: "ASSISTANT_RUN_NOT_SUPPORTED",
          message: "The Assistant contact does not run as a scheduled agent."
        }
      });
    }

    if (agent.status !== "active") {
      return reply.code(409).send({
        error: {
          code: "AGENT_NOT_ACTIVE",
          message: "Only active agents can be run."
        }
      });
    }

    const job = await enqueueAgentRun(agent.id, "manual");
    await publishRealtimeEvent({
      type: "run.queued",
      user_id: userId,
      agent_id: agent.id,
      data: { job_id: job.id, trigger: "manual" }
    });

    return reply.code(202).send({
      job: {
        id: job.id,
        name: job.name
      },
      message: "Agent run queued."
    });
  });

  app.patch("/agents/:agentId", { preHandler: requireAuth }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const userId = request.auth!.userId;
    const body = updateAgentSchema.safeParse(request.body);

    if (!isUuid(agentId)) {
      return agentNotFound(reply);
    }

    if (!body.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_AGENT_UPDATE",
          message: body.error.issues[0]?.message ?? "Invalid update."
        }
      });
    }

    const existing = await getAgent(userId, agentId);
    if (!existing) {
      return agentNotFound(reply);
    }

    const nextName = body.data.name ?? existing.name;
    const nextSchedule =
      body.data.schedule_cron === undefined
        ? existing.schedule_cron
        : body.data.schedule_cron;
    const nextStatus = body.data.status ?? existing.status;

    const { rows } = await pool.query(
      `
        UPDATE agents
        SET name = $1, schedule_cron = $2, status = $3
        WHERE id = $4 AND user_id = $5
        RETURNING
          id,
          name,
          avatar,
          prompt,
          parsed_intent,
          connector_ids,
          schedule_cron,
          is_assistant,
          status,
          safety_level,
          last_message_at,
          created_at,
          updated_at
      `,
      [nextName, nextSchedule, nextStatus, agentId, userId]
    );

    const updatedAgent = rows[0]!;
    await syncAgentSchedule(updatedAgent);
    await publishRealtimeEvent({
      type: "agent.updated",
      user_id: userId,
      agent_id: updatedAgent.id,
      data: {
        status: updatedAgent.status,
        schedule_cron: updatedAgent.schedule_cron
      }
    });

    return { agent: updatedAgent };
  });

  app.delete("/agents/:agentId", { preHandler: requireAuth }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const userId = request.auth!.userId;

    if (!isUuid(agentId)) {
      return agentNotFound(reply);
    }

    const existing = await getAgent(userId, agentId);

    if (!existing) {
      return agentNotFound(reply);
    }

    if (existing.is_assistant) {
      return reply.code(400).send({
        error: {
          code: "ASSISTANT_CANNOT_BE_DELETED",
          message: "The Assistant contact is always available."
        }
      });
    }

    await removeScheduleForAgent(agentId);
    await pool.query("DELETE FROM agents WHERE id = $1 AND user_id = $2", [
      agentId,
      userId
    ]);
    await publishRealtimeEvent({
      type: "agent.updated",
      user_id: userId,
      agent_id: agentId,
      data: { deleted: true }
    });

    return reply.code(204).send();
  });

  app.post("/agents/parse", { preHandler: requireAuth }, async (request, reply) => {
    const body = createAgentSchema.safeParse(request.body);

    if (!body.success) {
      if (hasSecurityValidationIssue(body.error)) {
        request.log.warn(
          { userId: request.auth!.userId, route: "parse_agent" },
          "Rejected unsafe agent input"
        );
      }
      return reply.code(400).send({
        error: {
          code: hasSecurityValidationIssue(body.error)
            ? "UNSAFE_INPUT"
            : "INVALID_AGENT_PROMPT",
          message: body.error.issues[0]?.message ?? "Invalid prompt."
        }
      });
    }

    const parsedIntent = await parseIntentHybrid(body.data.prompt);
    return reply.send({ parsed_intent: parsedIntent });
  });

  app.post("/agents/:agentId/messages/:messageId/action", { preHandler: requireAuth }, async (request, reply) => {
    const { agentId, messageId } = request.params as { agentId: string; messageId: string };
    const userId = request.auth!.userId;
    const body = agentMessageActionSchema.safeParse(request.body);

    if (!isUuid(agentId) || !isUuid(messageId)) {
      return reply.code(400).send({ error: "Invalid agent or message ID." });
    }
    if (!body.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_MESSAGE_ACTION",
          message: body.error.issues[0]?.message ?? "Invalid message action."
        }
      });
    }
    const { action } = body.data;

    // Verify ownership of agent
    const agent = await getAgent(userId, agentId);
    if (!agent) {
      return agentNotFound(reply);
    }

    const ownedMessage = await pool.query(
      `
        SELECT 1
        FROM agent_messages
        WHERE id = $1 AND agent_id = $2 AND user_id = $3
        LIMIT 1
      `,
      [messageId, agentId, userId]
    );
    if (!ownedMessage.rows[0]) {
      return reply.code(404).send({
        error: {
          code: "MESSAGE_NOT_FOUND",
          message: "Message not found."
        }
      });
    }

    const dateString = new Date().toISOString().split("T")[0];

    if (action === "done") {
      // 1. Mark current card as completed
      await pool.query(
        `UPDATE agent_messages SET content = jsonb_set(content, '{data,completed}', 'true'::jsonb) WHERE id = $1 AND agent_id = $2 AND user_id = $3`,
        [messageId, agentId, userId]
      );
      // 2. Append completed day to history heatmap
      await pool.query(
        `UPDATE agents SET parsed_intent = jsonb_set(parsed_intent, '{history,${dateString}}', 'true'::jsonb) WHERE id = $1 AND user_id = $2`,
        [agentId, userId]
      );
    } else if (action === "skip") {
      await pool.query(
        `UPDATE agent_messages SET content = jsonb_set(content, '{data,completed}', 'false'::jsonb) WHERE id = $1 AND agent_id = $2 AND user_id = $3`,
        [messageId, agentId, userId]
      );
      await pool.query(
        `UPDATE agents SET parsed_intent = jsonb_set(parsed_intent, '{history,${dateString}}', 'false'::jsonb) WHERE id = $1 AND user_id = $2`,
        [agentId, userId]
      );
    } else if (action === "snooze") {
      // bullmq enqueue with delay of 30 minutes
      await agentExecutorQueue.add(
        agentExecutorJobName,
        { agentId, trigger: "schedule" },
        {
          delay: 30 * 60 * 1000,
          attempts: 2,
          backoff: { type: "exponential", delay: 3000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 1000 }
        }
      );
    }

    return reply.send({ success: true });
  });
}

function agentNotFound(reply: FastifyReply) {
  return reply.code(404).send({
    error: {
      code: "AGENT_NOT_FOUND",
      message: "Agent not found."
    }
  });
}

async function getAgent(userId: string, agentId: string) {
  const { rows } = await pool.query(
    `
      SELECT
        id,
        name,
        avatar,
        prompt,
        parsed_intent,
        connector_ids,
        schedule_cron,
        is_assistant,
        status,
        safety_level,
        last_message_at,
        created_at,
        updated_at
      FROM agents
      WHERE id = $1 AND user_id = $2
    `,
    [agentId, userId]
  );

  return rows[0] ?? null;
}

async function writeAgentCreatedMessage(
  userId: string,
  agentId: string,
  parsedIntent: ParsedIntent
): Promise<void> {
  const githubConnected = !parsedIntent.connector_ids.includes("github") ||
    await hasUsableGitHubToken(userId);
  const message = agentCreationThreadMessage({
    parsedIntent,
    githubConnected,
    readyDetail: parsedIntent.schedule_cron
      ? `It will run on schedule ${parsedIntent.schedule_cron}.`
      : "It is ready for on-demand replies."
  });

  await pool.query(
    `
      INSERT INTO agent_messages
        (agent_id, user_id, role, content, source_refs)
      VALUES ($1, $2, $3, $4, '[]'::jsonb)
    `,
    [agentId, userId, message.role, JSON.stringify(message.content)]
  );
}

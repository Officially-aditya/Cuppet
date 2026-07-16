import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { isUuid } from "../api/ids.js";
import { pool } from "../db/index.js";
import { config } from "../config.js";
import { requireAuth } from "../auth/middleware.js";
import { agentExecutorQueue, agentExecutorJobName } from "../queue/index.js";
import { ensureAssistantContact } from "./assistant.js";
import { parseIntentHybrid } from "./llm-intent.js";
import { describeSchedule } from "./message-router.js";
import type { ParsedIntent } from "./parser.js";
import {
  syncAgentScheduleForUser
} from "./scheduler.js";
import { publishRealtimeEvent } from "../realtime/events.js";
import { hasUsableGitHubToken } from "../connectors/github.js";
import {
  agentCreationReadyDetail,
  agentCreationThreadMessage
} from "./creation-message.js";
import {
  cronSchema,
  hasSecurityValidationIssue,
  shortLabelSchema,
  validatedTextSchema
} from "../security/input-validation.js";
import {
  AgentServiceError,
  deleteManagedAgent,
  renameManagedAgent,
  runManagedAgent,
  setManagedAgentStatus,
  updateManagedAgentDescription
} from "./agent-service.js";

const createAgentSchema = z
  .object({
    prompt: validatedTextSchema({ field: "Prompt", min: 3, max: 4000 })
  })
  .strict();

const updateAgentSchema = z
  .object({
    name: shortLabelSchema.optional(),
    description: validatedTextSchema({
      field: "Description",
      min: 3,
      max: 4000
    }).optional(),
    schedule_cron: cronSchema.nullable().optional(),
    status: z.enum(["active", "paused", "error"]).optional(),
    notifications_muted: z.boolean().optional(),
    realtime_enabled: z.boolean().optional(),
    response_limit: z.enum(["concise", "balanced", "detailed"]).optional(),
    active_until: z.string().datetime().nullable().optional()
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required."
  });

const agentMessageActionSchema = z
  .object({
    action: z.enum(["done", "snooze", "skip"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
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
          COALESCE(
            latest_message.created_at,
            CASE WHEN $3::boolean = FALSE THEN a.last_message_at ELSE NULL END,
            a.updated_at,
            a.created_at
          ) AS latest_message_at,
          COALESCE(unread_messages.unread_count, 0)::int AS unread_count
        FROM agents a
        LEFT JOIN LATERAL (
          SELECT id, role, content, created_at
          FROM agent_messages
          WHERE agent_id = a.id AND user_id = a.user_id
            AND ($3::boolean = FALSE OR
                 created_at > NOW() - ($2::int * INTERVAL '1 day'))
            AND (content->'data'->>'action_taken' IS NULL OR content->'data'->>'action_taken' != 'skip')
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
            AND ($3::boolean = FALSE OR
                 created_at > NOW() - ($2::int * INTERVAL '1 day'))
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
      [userId, config.MESSAGE_RETENTION_DAYS, config.MESSAGE_RETENTION_ENABLED]
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
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    parsedIntent.active_until = oneYearLater.toISOString();
    if (parsedIntent.unsupported_connector) {
      return reply.code(422).send({
        error: {
          code: "UNSUPPORTED_CONNECTOR",
          message: `I can't access ${parsedIntent.unsupported_connector} yet. I can monitor Gmail, Calendar, Drive, GitHub, Slack, Notion, or web search instead.`,
          unsupported_connector: parsedIntent.unsupported_connector,
          alternatives: ["gmail", "calendar", "slack", "drive", "notion", "web_search"]
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
    const createdMessage = await writeAgentCreatedMessage(
      userId,
      agent.id,
      parsedIntent
    );
    await syncAgentScheduleForUser(agent, userId);
    await publishRealtimeEvent({
      type: "agent.created",
      user_id: userId,
      agent_id: agent.id,
      data: { name: agent.name }
    });

    return reply.code(201).send({
      agent: {
        ...agent,
        description: parsedIntent.action,
        last_message_preview: createdMessage.preview,
        latest_message_at: createdMessage.createdAt,
        unread_count: 1
      }
    });
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

    try {
      const { job } = await runManagedAgent(userId, agentId);
      return reply.code(202).send({
        job: { id: job.id, name: job.name },
        message: "Agent run queued."
      });
    } catch (error) {
      if (error instanceof AgentServiceError) {
        return reply.code(error.statusCode).send({
          error: { code: error.code, message: error.message }
        });
      }
      throw error;
    }
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

    const sharedFields = Object.keys(body.data).every((key) =>
      ["name", "description", "status"].includes(key)
    );
    if (sharedFields && body.data.status !== "error") {
      try {
        let updated = existing;
        if (body.data.description !== undefined) {
          updated = await updateManagedAgentDescription(
            userId,
            agentId,
            body.data.description
          );
        }
        if (body.data.name !== undefined) {
          updated = await renameManagedAgent(userId, agentId, body.data.name);
        }
        if (body.data.status === "active" || body.data.status === "paused") {
          updated = await setManagedAgentStatus(userId, agentId, body.data.status);
        }
        return { agent: updated };
      } catch (error) {
        if (error instanceof AgentServiceError) {
          return reply.code(error.statusCode).send({
            error: { code: error.code, message: error.message }
          });
        }
        throw error;
      }
    }

    const existingParsedIntent = {
      ...(typeof existing.parsed_intent === "string"
        ? JSON.parse(existing.parsed_intent)
        : (existing.parsed_intent || {}))
    };
    const description = body.data.description?.trim();
    let nextParsedIntent = existingParsedIntent;
    let nextPrompt = existing.prompt;
    let nextConnectorIds = existing.connector_ids;
    let nextSafetyLevel = existing.safety_level;

    if (description !== undefined) {
      const reparsed = await parseIntentHybrid(description);
      if (reparsed.unsupported_connector) {
        return reply.code(422).send({
          error: {
            code: "UNSUPPORTED_CONNECTOR",
            message: `I can't access ${reparsed.unsupported_connector} yet. Update the description to use Gmail, Calendar, Drive, GitHub, Slack, Notion, or web search instead.`
          }
        });
      }
      nextParsedIntent = {
        ...reparsed,
        ...preservedAgentState(existingParsedIntent)
      };
      nextPrompt = description;
      nextConnectorIds = reparsed.connector_ids;
      nextSafetyLevel = reparsed.safety_level;
    }

    const nextName = body.data.name ?? existing.name;
    let nextSchedule =
      body.data.schedule_cron === undefined
        ? description === undefined
          ? existing.schedule_cron
          : (nextParsedIntent.schedule_cron ?? null)
        : body.data.schedule_cron;
    if (
      body.data.realtime_enabled === true &&
      body.data.schedule_cron === undefined
    ) {
      nextSchedule = null;
    }
    const nextStatus = body.data.status ?? existing.status;

    if (body.data.response_limit !== undefined) {
      nextParsedIntent.response_limit = body.data.response_limit;
    }
    if (body.data.active_until !== undefined) {
      if (body.data.active_until === null) {
        delete nextParsedIntent.active_until;
      } else {
        nextParsedIntent.active_until = body.data.active_until;
      }
    }
    if (body.data.notifications_muted !== undefined) {
      nextParsedIntent.notifications_muted = body.data.notifications_muted;
    }
    if (body.data.realtime_enabled !== undefined) {
      nextParsedIntent.realtime_enabled = body.data.realtime_enabled;
    }
    nextParsedIntent.schedule_cron = nextSchedule;
    if (nextSchedule) {
      nextParsedIntent.realtime_enabled = false;
    }

    const { rows } = await pool.query(
      `
        UPDATE agents
        SET name = $1,
            schedule_cron = $2,
            status = $3,
            parsed_intent = $4::jsonb,
            prompt = $5,
            connector_ids = $6,
            safety_level = $7
        WHERE id = $8 AND user_id = $9
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
        nextName,
        nextSchedule,
        nextStatus,
        JSON.stringify(nextParsedIntent),
        nextPrompt,
        nextConnectorIds,
        nextSafetyLevel,
        agentId,
        userId
      ]
    );

    const updatedAgent = rows[0]!;
    await syncAgentScheduleForUser(updatedAgent, userId);
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

    try {
      await deleteManagedAgent(userId, agentId);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof AgentServiceError) {
        return reply.code(error.statusCode).send({
          error: { code: error.code, message: error.message }
        });
      }
      throw error;
    }
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
    const { action, date } = body.data;

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
          AND ($4::boolean = FALSE OR created_at > NOW() - ($5::int * INTERVAL '1 day'))
        LIMIT 1
      `,
      [messageId, agentId, userId, config.MESSAGE_RETENTION_ENABLED, config.MESSAGE_RETENTION_DAYS]
    );
    if (!ownedMessage.rows[0]) {
      return reply.code(404).send({
        error: {
          code: "MESSAGE_NOT_FOUND",
          message: "Message not found."
        }
      });
    }

    const dateString = date ?? new Date().toISOString().split("T")[0];

    if (action === "done") {
      // 1. Mark current card as completed and set action_taken to "done"
      await pool.query(
        `UPDATE agent_messages SET content = jsonb_set(jsonb_set(content, '{data,completed}', 'true'::jsonb), '{data,action_taken}', '"done"'::jsonb) WHERE id = $1 AND agent_id = $2 AND user_id = $3 AND ($4::boolean = FALSE OR created_at > NOW() - ($5::int * INTERVAL '1 day'))`,
        [messageId, agentId, userId, config.MESSAGE_RETENTION_ENABLED, config.MESSAGE_RETENTION_DAYS]
      );
      // 2. Append completed day to history heatmap
      await pool.query(
        `UPDATE agents SET parsed_intent = jsonb_set(parsed_intent, '{history}', coalesce(parsed_intent->'history', '{}'::jsonb) || jsonb_build_object($1::text, true)) WHERE id = $2 AND user_id = $3`,
        [dateString, agentId, userId]
      );
    } else if (action === "skip") {
      // Get the message content to check template and retrieve the topic or title
      const msgRes = await pool.query(
        "SELECT content FROM agent_messages WHERE id = $1 AND agent_id = $2 AND user_id = $3 AND ($4::boolean = FALSE OR created_at > NOW() - ($5::int * INTERVAL '1 day'))",
        [messageId, agentId, userId, config.MESSAGE_RETENTION_ENABLED, config.MESSAGE_RETENTION_DAYS]
      );
      const msg = msgRes.rows[0];
      if (msg) {
        const content = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
        if (content && content.template === "study_guide" && content.data && content.data.topic) {
          await pool.query(
            `
              UPDATE agents
              SET parsed_intent = jsonb_set(
                parsed_intent,
                '{topics_covered}',
                coalesce(
                  (
                    SELECT jsonb_agg(elem)
                    FROM jsonb_array_elements(coalesce(parsed_intent->'topics_covered', '[]'::jsonb)) elem
                    WHERE elem != $1::jsonb
                  ),
                  '[]'::jsonb
                )
              )
              WHERE id = $2 AND user_id = $3
            `,
            [JSON.stringify(content.data.topic), agentId, userId]
          );
        } else if (content && content.template === "dsa_question" && content.data && content.data.title) {
          await pool.query(
            `
              UPDATE agents
              SET parsed_intent = jsonb_set(
                parsed_intent,
                '{topics_covered}',
                coalesce(
                  (
                    SELECT jsonb_agg(elem)
                    FROM jsonb_array_elements(coalesce(parsed_intent->'topics_covered', '[]'::jsonb)) elem
                    WHERE elem != $1::jsonb
                  ),
                  '[]'::jsonb
                )
              )
              WHERE id = $2 AND user_id = $3
            `,
            [JSON.stringify(content.data.title), agentId, userId]
          );
        }
      }

      // Mark card as not completed and set action_taken to "skip"
      await pool.query(
        `UPDATE agent_messages SET content = jsonb_set(jsonb_set(content, '{data,completed}', 'false'::jsonb), '{data,action_taken}', '"skip"'::jsonb) WHERE id = $1 AND agent_id = $2 AND user_id = $3 AND ($4::boolean = FALSE OR created_at > NOW() - ($5::int * INTERVAL '1 day'))`,
        [messageId, agentId, userId, config.MESSAGE_RETENTION_ENABLED, config.MESSAGE_RETENTION_DAYS]
      );
      await pool.query(
        `UPDATE agents SET parsed_intent = jsonb_set(parsed_intent, '{history}', coalesce(parsed_intent->'history', '{}'::jsonb) || jsonb_build_object($1::text, false)) WHERE id = $2 AND user_id = $3`,
        [dateString, agentId, userId]
      );
    } else if (action === "snooze") {
      // Set action_taken to "snooze"
      await pool.query(
        `UPDATE agent_messages SET content = jsonb_set(content, '{data,action_taken}', '"snooze"'::jsonb) WHERE id = $1 AND agent_id = $2 AND user_id = $3 AND ($4::boolean = FALSE OR created_at > NOW() - ($5::int * INTERVAL '1 day'))`,
        [messageId, agentId, userId, config.MESSAGE_RETENTION_ENABLED, config.MESSAGE_RETENTION_DAYS]
      );
      // bullmq enqueue with delay of 30 minutes
      await agentExecutorQueue.add(
        agentExecutorJobName,
        { agentId, trigger: "snooze", snoozedMessageId: messageId },
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

function preservedAgentState(
  intent: Record<string, unknown>
): Record<string, unknown> {
  const preserved: Record<string, unknown> = {};
  for (const key of [
    "active_until",
    "history",
    "notifications_muted",
    "response_limit",
    "topics_covered"
  ]) {
    if (intent[key] !== undefined) preserved[key] = intent[key];
  }
  return preserved;
}

async function writeAgentCreatedMessage(
  userId: string,
  agentId: string,
  parsedIntent: ParsedIntent
): Promise<{ id: string; createdAt: Date | string; preview: string }> {
  const githubConnected = !parsedIntent.connector_ids.includes("github") ||
    await hasUsableGitHubToken(userId);
  const message = agentCreationThreadMessage({
    parsedIntent,
    githubConnected,
    readyDetail: agentCreationReadyDetail(parsedIntent, describeSchedule)
  });

  const { rows } = await pool.query<{ id: string; created_at: Date | string }>(
    `
      INSERT INTO agent_messages
        (agent_id, user_id, role, content, source_refs)
      VALUES ($1, $2, $3, $4, '[]'::jsonb)
      RETURNING id, created_at
    `,
    [agentId, userId, message.role, JSON.stringify(message.content)]
  );
  const data = message.content.data;
  const preview = [data.text, data.task, data.title]
    .find((value) => typeof value === "string" && value.trim())
    ?.toString() ?? `${parsedIntent.name} is ready.`;
  return {
    id: rows[0]!.id,
    createdAt: rows[0]!.created_at,
    preview
  };
}

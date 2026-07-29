import type { FastifyInstance, FastifyReply } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { isUuid } from "../api/ids.js";
import { pool } from "../db/index.js";
import { config } from "../config.js";
import { requireAuth } from "../auth/middleware.js";
import { agentExecutorQueue, agentExecutorJobName } from "../queue/index.js";
import { ensureAssistantContact } from "./assistant.js";
import { parseIntentHybrid } from "./llm-intent.js";
import { describeSchedule } from "./message-router.js";
import {
  isDraftOutputPlatformName,
  looksLikeContentDraftPrompt,
  type ParsedIntent
} from "./parser.js";
import {
  syncAgentScheduleForUser
} from "./scheduler.js";
import { publishRealtimeEvent } from "../realtime/events.js";
import { hasUsableGitHubToken } from "../connectors/github.js";
import {
  agentCreationReadyDetail,
  agentCreationThreadMessage,
  missingAccessForCreation
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
import {
  agentConfigurationView,
  compileAgentRecipe,
  compileAgentDefinition,
  definitionToParsedIntent,
  validateCompiledDefinition
} from "./runtime/compiler.js";
import {
  listAgentRecipeProfiles,
  publicAgentRecipeProfile
} from "./runtime/recipe-registry.js";
import {
  insertConfiguredAgent,
  loadCurrentAgentDefinition,
  loadRuntimeState,
  reviseAgentDefinition
} from "./runtime/configuration-service.js";
import { outputStateEffects } from "./runtime/output-registry.js";
import {
  applyAgentStateEvents,
  type AgentStateEvent
} from "./runtime/state-store.js";
import { isLlmTokenLimitError, withLlmUser } from "./token-rate-limit.js";
import { recordCuppetActivitySignal } from "../personalization/activity-events.js";

const createAgentSchema = z
  .object({
    prompt: validatedTextSchema({ field: "Prompt", min: 3, max: 4000 }).optional(),
    recipe_id: z.string().trim().regex(/^[a-z][a-z0-9_]{1,79}$/).optional(),
    recipe_version: z.number().int().positive().optional(),
    recipe_inputs: z.record(z.unknown()).optional()
  })
  .strict()
  .refine((body) => Boolean(body.prompt || body.recipe_id), {
    message: "Provide a prompt or a recipe_id."
  })
  .refine(
    (body) =>
      Boolean(body.recipe_id) ||
      (body.recipe_version === undefined &&
        (body.recipe_inputs === undefined ||
          Object.keys(body.recipe_inputs).length === 0)),
    {
      message: "recipe_version and recipe_inputs require recipe_id."
    }
  );

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
  app.get("/agents/recipes", { preHandler: requireAuth }, async () => ({
    schema_version: 1,
    recipes: listAgentRecipeProfiles({ visibleOnly: true }).map(
      publicAgentRecipeProfile
    )
  }));

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
          revision.definition AS agent_definition,
          runtime.state AS agent_runtime_state,
          CASE
            WHEN a.is_assistant THEN a.prompt
            ELSE COALESCE(
              NULLIF(revision.definition #>> '{instructions,0}', ''),
              a.name
            )
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
              ELSE COALESCE(
                NULLIF(revision.definition #>> '{instructions,0}', ''),
                a.prompt
              )
            END
          ) AS last_message_preview,
          COALESCE(
            latest_message.created_at,
            a.updated_at,
            a.created_at
          ) AS latest_message_at,
          COALESCE(unread_messages.unread_count, 0)::int AS unread_count
        FROM agents a
        LEFT JOIN agent_config_heads config_head
          ON config_head.agent_id = a.id
        LEFT JOIN agent_config_revisions revision
          ON revision.id = config_head.revision_id
        LEFT JOIN agent_runtime_states runtime
          ON runtime.agent_id = a.id
        LEFT JOIN LATERAL (
          SELECT id, role, content, created_at
          FROM agent_messages
          WHERE agent_id = a.id AND user_id = a.user_id
            AND created_at > NOW() - ($2::int * INTERVAL '1 day')
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
          SELECT COUNT(
            DISTINCT COALESCE(
              content #>> '{presentation,group_id}',
              id::text
            )
          ) AS unread_count
          FROM agent_messages
          WHERE agent_id = a.id
            AND user_id = a.user_id
            AND created_at > NOW() - ($2::int * INTERVAL '1 day')
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
      [userId, config.MESSAGE_RETENTION_DAYS]
    );

    return {
      agents: rows.map((agent) => withConfigurationViews(agent))
    };
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

    let creation: Awaited<ReturnType<typeof resolveAgentCreationRequest>>;
    try {
      creation = await withLlmUser(userId, () =>
        resolveAgentCreationRequest(body.data)
      );
    } catch (error) {
      if (!body.data.recipe_id || isLlmTokenLimitError(error)) throw error;
      return invalidRecipeReply(reply, error);
    }
    const { parsedIntent, prompt } = creation;
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
    const definition = compileAgentDefinition(parsedIntent, prompt);

    const client = await pool.connect();
    let agent: any;
    let createdMessage: Awaited<ReturnType<typeof writeAgentCreatedMessage>>;
    try {
      await client.query("BEGIN");
      agent = await insertConfiguredAgent(client, {
        userId,
        name: parsedIntent.name,
        avatar: parsedIntent.avatar,
        prompt,
        parsedIntent,
        createdBy: "api"
      });
      createdMessage = await writeAgentCreatedMessage(
        userId,
        agent.id,
        agent.parsed_intent,
        client
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
        unread_count: 1,
        configuration: agentConfigurationView(definition, agent),
        agent_preview: agentConfigurationView(definition, agent)
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

    if (description !== undefined) {
      let reparsed = await withLlmUser(userId, () =>
        parseIntentHybrid(description)
      );
      if (reparsed.unsupported_connector) {
        const platform = reparsed.unsupported_connector.toLowerCase();
        const existingIsDraftAgent =
          existingParsedIntent.intent === "content_extractor" ||
          looksLikeContentDraftPrompt(existing.prompt ?? "") ||
          looksLikeContentDraftPrompt(description);
        if (isDraftOutputPlatformName(platform) && existingIsDraftAgent) {
          reparsed = await withLlmUser(userId, () =>
            parseIntentHybrid(`Content extractor agent: ${description}`)
          );
        }
      }
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
        ...(existingParsedIntent.intent === "content_extractor"
          ? {
              intent: "content_extractor",
              output_template: "content_extractor"
            }
          : {}),
        ...preservedAgentState(existingParsedIntent),
        ...(reparsed.intent === existingParsedIntent.intent
          ? preservedRecipeConfiguration(existingParsedIntent)
          : {})
      };
      nextPrompt = description;
    }

    const nextName = body.data.name ?? existing.name;
    const existingNotificationsMuted =
      existing.parsed_intent && typeof existing.parsed_intent === "object"
        ? (existing.parsed_intent as Record<string, unknown>).notifications_muted === true
        : false;
    const notificationMuteChanged =
      body.data.notifications_muted !== undefined &&
      body.data.notifications_muted !== existingNotificationsMuted;
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
    if (
      nextParsedIntent.recipe_inputs &&
      typeof nextParsedIntent.recipe_inputs === "object" &&
      !Array.isArray(nextParsedIntent.recipe_inputs) &&
      "schedule" in nextParsedIntent.recipe_inputs &&
      nextSchedule
    ) {
      nextParsedIntent.recipe_inputs = {
        ...nextParsedIntent.recipe_inputs,
        schedule: nextSchedule
      };
    }
    if (nextSchedule) {
      nextParsedIntent.realtime_enabled = false;
    }

    const client = await pool.connect();
    let updatedAgent: any;
    try {
      await client.query("BEGIN");
      await reviseAgentDefinition(client, {
        agentId,
        userId,
        definition: compileAgentDefinition(
          nextParsedIntent as ParsedIntent,
          nextPrompt
        ),
        name: nextName,
        avatar: existing.avatar,
        prompt: nextPrompt,
        status: nextStatus,
        createdBy: "settings"
      });
      const { rows } = await client.query(
        `SELECT
           id, name, avatar, prompt, parsed_intent, connector_ids,
           schedule_cron, is_assistant, status, safety_level,
           last_message_at, created_at, updated_at
         FROM agents
         WHERE id = $1 AND user_id = $2`,
        [agentId, userId]
      );
      updatedAgent = rows[0]!;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
    if (notificationMuteChanged && body.data.notifications_muted === true) {
      void recordCuppetActivitySignal({
        userId,
        eventType: "notification_muted",
        subjectType: "agent_type",
        subjectKey: `agent_${agentId}`,
        agentId
      }).catch((error) => {
        console.error("Notification mute preference recording failed:", error);
      });
    }

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

    let creation: Awaited<ReturnType<typeof resolveAgentCreationRequest>>;
    try {
      creation = await withLlmUser(request.auth!.userId, () =>
        resolveAgentCreationRequest(body.data)
      );
    } catch (error) {
      if (!body.data.recipe_id || isLlmTokenLimitError(error)) throw error;
      return invalidRecipeReply(reply, error);
    }
    const { parsedIntent } = creation;
    const definition = parsedIntent.unsupported_connector
      ? null
      : creation.definition;
    return reply.send({
      parsed_intent: parsedIntent,
      ...(definition
        ? {
            configuration: agentConfigurationView(definition, {
              name: parsedIntent.name,
              avatar: parsedIntent.avatar
            }),
            agent_preview: agentConfigurationView(definition, {
              name: parsedIntent.name,
              avatar: parsedIntent.avatar
            })
          }
        : {})
    });
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

    const dateString = date ?? new Date().toISOString().split("T")[0]!;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const messageResult = await client.query<{ content: any }>(
        `SELECT content
         FROM agent_messages
         WHERE id = $1 AND agent_id = $2 AND user_id = $3
           AND created_at > NOW() - ($4::int * INTERVAL '1 day')
         FOR UPDATE`,
        [messageId, agentId, userId, config.MESSAGE_RETENTION_DAYS]
      );
      const message = messageResult.rows[0];
      if (!message) {
        await client.query("ROLLBACK");
        return reply.code(404).send({
          error: {
            code: "MESSAGE_NOT_FOUND",
            message: "Message not found."
          }
        });
      }
      const content =
        typeof message.content === "string"
          ? JSON.parse(message.content)
          : message.content;
      const effects = outputStateEffects({
        content,
        action,
        date: dateString
      }) as AgentStateEvent[];
      await client.query(
        action === "snooze"
          ? `UPDATE agent_messages
             SET content = jsonb_set(content, '{data,action_taken}', '"snooze"'::jsonb)
             WHERE id = $1`
          : `UPDATE agent_messages
             SET content = jsonb_set(
               jsonb_set(content, '{data,completed}', $2::jsonb),
               '{data,action_taken}',
               $3::jsonb
             )
             WHERE id = $1`,
        action === "snooze"
          ? [messageId]
          : [
              messageId,
              JSON.stringify(action === "done"),
              JSON.stringify(action)
            ]
      );
      await applyAgentStateEvents(client, agentId, effects);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (action === "snooze") {
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

  return rows[0] ? hydrateAgentConfiguration(rows[0]) : null;
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

function preservedRecipeConfiguration(
  intent: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...(typeof intent.recipe_version === "number"
      ? { recipe_version: intent.recipe_version }
      : {}),
    ...(typeof intent.prompt_profile_version === "number"
      ? { prompt_profile_version: intent.prompt_profile_version }
      : {}),
    ...(intent.recipe_inputs &&
    typeof intent.recipe_inputs === "object" &&
    !Array.isArray(intent.recipe_inputs)
      ? {
          recipe_inputs: {
            ...(intent.recipe_inputs as Record<string, unknown>)
          }
        }
      : {})
  };
}

async function resolveAgentCreationRequest(
  body: z.infer<typeof createAgentSchema>
): Promise<{
  parsedIntent: ParsedIntent;
  prompt: string;
  definition: ReturnType<typeof compileAgentDefinition> | null;
}> {
  if (body.recipe_id) {
    return compileAgentRecipe({
      recipeId: body.recipe_id,
      recipeVersion: body.recipe_version,
      recipeInputs: body.recipe_inputs,
      prompt: body.prompt
    });
  }

  const prompt = body.prompt!;
  const parsedIntent = await parseIntentHybrid(prompt);
  return {
    parsedIntent,
    prompt,
    definition: parsedIntent.unsupported_connector
      ? null
      : compileAgentDefinition(parsedIntent, prompt)
  };
}

function invalidRecipeReply(reply: FastifyReply, error: unknown) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message.slice(0, 500)
      : "The selected recipe configuration is invalid.";
  return reply.code(400).send({
    error: {
      code: "INVALID_AGENT_RECIPE",
      message
    }
  });
}

async function writeAgentCreatedMessage(
  userId: string,
  agentId: string,
  parsedIntent: ParsedIntent,
  client: Pick<PoolClient, "query"> = pool
): Promise<{ id: string; createdAt: Date | string; preview: string }> {
  const githubConnected = !parsedIntent.connector_ids.includes("github") ||
    await hasUsableGitHubToken(userId);
  const missingAccess = await missingAccessForCreation(userId, parsedIntent);
  const message = agentCreationThreadMessage({
    parsedIntent,
    githubConnected,
    missingAccess,
    readyDetail: agentCreationReadyDetail(parsedIntent, describeSchedule)
  });

  const { rows } = await client.query<{ id: string; created_at: Date | string }>(
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

async function hydrateAgentConfiguration(agent: any): Promise<any> {
  if (agent.is_assistant) return agent;
  const [configuration, runtimeState] = await Promise.all([
    loadCurrentAgentDefinition(agent.id),
    loadRuntimeState(agent.id)
  ]);
  if (!configuration) return agent;
  const parsedIntent = definitionToParsedIntent(configuration.definition, {
    name: agent.name,
    avatar: agent.avatar,
    runtimeState
  });
  const view = agentConfigurationView(configuration.definition, agent);
  return {
    ...agent,
    parsed_intent: parsedIntent,
    configuration: view,
    agent_preview: view,
    config_revision: configuration.revisionId
  };
}

function withConfigurationViews(agent: any): any {
  if (!agent.agent_definition) return agent;
  const definition = validateCompiledDefinition(agent.agent_definition);
  const runtimeState =
    agent.agent_runtime_state &&
    typeof agent.agent_runtime_state === "object"
      ? agent.agent_runtime_state
      : {};
  const view = agentConfigurationView(definition, agent);
  const parsedIntent = definitionToParsedIntent(definition, {
    name: agent.name,
    avatar: agent.avatar,
    runtimeState
  });
  const {
    agent_definition: _definition,
    agent_runtime_state: _runtime,
    ...publicAgent
  } = agent;
  return {
    ...publicAgent,
    parsed_intent: parsedIntent,
    configuration: view,
    agent_preview: view
  };
}

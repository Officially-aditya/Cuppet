import type { FastifyInstance, FastifyReply } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { isUuid } from "../api/ids.js";
import {
  decideAgentInstruction,
  type AgentInstructionDecision
} from "../agents/instruction-updater.js";
import { createAgentChatReply } from "../agents/agent-chat.js";
import { createAssistantChatReply } from "../agents/assistant-chat.js";
import { ensureAssistantContact } from "../agents/assistant.js";
import { parseIntentHybrid } from "../agents/llm-intent.js";
import { refineAmbiguousAgentMessage } from "../agents/llm-message-router.js";
import {
  describeSchedule,
  routeAgentMessage
} from "../agents/message-router.js";
import type { ParsedIntent } from "../agents/parser.js";
import { syncAgentScheduleForUser } from "../agents/scheduler.js";
import { requireAuth } from "../auth/middleware.js";
import { pool } from "../db/index.js";
import { enqueueAgentRun } from "../queue/index.js";
import { publishRealtimeEvent } from "../realtime/events.js";
import { hasUsableGitHubToken } from "../connectors/github.js";
import {
  agentCreationReadyDetail,
  agentCreationThreadMessage
} from "../agents/creation-message.js";
import {
  hasSecurityValidationIssue,
  validatedTextSchema
} from "../security/input-validation.js";
import { handleAssistantMessage } from "../assistant/handler.js";
import { clearUnconfirmedAssistantState } from "../assistant/memory.js";
import { AttachmentValidationError } from "../uploads/attachment-analysis.js";
import { config } from "../config.js";
import { insertConfiguredAgent } from "../agents/runtime/configuration-service.js";
import { reviseAgentDefinition } from "../agents/runtime/configuration-service.js";
import { compileAgentDefinition } from "../agents/runtime/compiler.js";
import {
  loadCurrentAgentDefinition,
  loadRuntimeState
} from "../agents/runtime/configuration-service.js";
import { definitionToParsedIntent } from "../agents/runtime/compiler.js";
import {
  isScheduledOutputContract,
  textualizeOutput
} from "../agents/runtime/output-registry.js";
import {
  mergeAgentMessageContents,
  messageGroupId
} from "../agents/runtime/message-parts.js";
import type { AgentMessageContent } from "../agents/output.js";
import { withLlmUser } from "../agents/token-rate-limit.js";

const sendMessageSchema = z
  .object({
    text: validatedTextSchema({ field: "Message", min: 1, max: 8000 }).optional(),
    action: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9_.:-]+$/i, "Invalid action identifier.")
      .optional(),
    payload: z.record(z.unknown()).optional(),
    source_message_id: z.string().uuid().optional(),
    attachment_ids: z.array(z.string().uuid()).max(4).optional()
  })
  .strict()
  .refine((body) => body.text || body.action || (body.attachment_ids?.length ?? 0) > 0, {
    message: "Text, an attachment, or an action is required."
  });

type AgentRow = {
  id: string;
  is_assistant: boolean;
  name: string;
  avatar: string;
  prompt: string;
  parsed_intent: ParsedIntent;
  connector_ids: string[];
  schedule_cron: string | null;
  status: "active" | "paused" | "error";
  safety_level: "read" | "suggest" | "act";
};

type CreatedAgentRow = {
  id: string;
  name: string;
  avatar: string;
  prompt: string;
  parsed_intent: ParsedIntent;
  connector_ids: string[];
  schedule_cron: string | null;
  is_assistant: boolean;
  status: "active" | "paused" | "error";
  safety_level: "read" | "suggest" | "act";
  last_message_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type MessageRow = {
  id: string;
  agent_id: string;
  user_id: string;
  role: "agent" | "user" | "system";
  content: Record<string, unknown>;
  source_refs: unknown[];
  read_at: Date | string | null;
  created_at: Date | string;
};

type UpdatedAgentRow = CreatedAgentRow;

type InstructionUpdateRow = {
  id: string;
  agent_id: string;
  user_id: string;
  source_message_id: string | null;
  kind: AgentInstructionDecision["kind"];
  status: AgentInstructionDecision["status"];
  confidence: string | number;
  reason: string;
  patch: Record<string, unknown>;
  previous_prompt: string | null;
  previous_parsed_intent: ParsedIntent | null;
  previous_schedule_cron: string | null;
  next_prompt: string | null;
  next_parsed_intent: ParsedIntent | null;
  next_schedule_cron: string | null;
  created_at: Date | string;
};

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/agents/:agentId/messages", { preHandler: requireAuth }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const userId = request.auth!.userId;
    const limit = clampLimit((request.query as { limit?: string }).limit);

    if (!isUuid(agentId)) {
      return agentNotFound(reply);
    }

    const agent = await getOwnedAgent(userId, agentId);
    if (!agent) {
      return agentNotFound(reply);
    }

    try {
      await ensureGitHubSetupMessage(userId, agent);
    } catch (error) {
      request.log.error(
        { error, userId, agentId },
        "Failed to ensure GitHub setup message"
      );
    }

    await pool.query(
      `
        UPDATE agent_messages
        SET read_at = COALESCE(read_at, NOW())
        WHERE user_id = $1
          AND agent_id = $2
          AND role IN ('agent', 'system')
          AND read_at IS NULL
          AND created_at > NOW() - ($3::int * INTERVAL '1 day')
      `,
      [userId, agentId, config.MESSAGE_RETENTION_DAYS]
    );

    const { rows } = await pool.query(
      `
        SELECT id, agent_id, user_id, role, content, source_refs, read_at, created_at
        FROM agent_messages
        WHERE user_id = $1 AND agent_id = $2
          AND created_at > NOW() - ($4::int * INTERVAL '1 day')
          AND (content->'data'->>'action_taken' IS NULL OR content->'data'->>'action_taken' != 'skip')
        ORDER BY
          created_at DESC,
          CASE role
            WHEN 'agent' THEN 0
            WHEN 'system' THEN 1
            WHEN 'user' THEN 2
            ELSE 3
          END ASC
        LIMIT $3
      `,
      [
        userId,
        agentId,
        limit,
        config.MESSAGE_RETENTION_DAYS
      ]
    );

    return { messages: rows.reverse() };
  });

  app.get("/briefings", { preHandler: requireAuth }, async (request) => {
    const userId = request.auth!.userId;
    const { rows } = await pool.query(
      `
        SELECT * FROM (
          SELECT DISTINCT ON (m.agent_id)
            m.id, m.agent_id, m.user_id, m.role, m.content, m.source_refs,
            m.read_at, m.created_at
          FROM agent_messages m
          INNER JOIN agents a ON a.id = m.agent_id AND a.user_id = m.user_id
          WHERE m.user_id = $1
            AND m.created_at > NOW() - ($2::int * INTERVAL '1 day')
            AND m.role = 'agent'
            AND m.content->>'template' = 'briefing_card'
            AND COALESCE(m.content #>> '{presentation,part_index}', '0') = '0'
            AND m.content #>> '{data,home_dismissed_at}' IS NULL
            -- Handoff copies live on Assistant with assistant_context=true; never show those on home.
            AND COALESCE(m.content #>> '{data,assistant_context}', 'false') <> 'true'
            AND a.is_assistant = FALSE
          ORDER BY m.agent_id, m.created_at DESC
        ) latest
        ORDER BY created_at DESC
        LIMIT 6
      `,
      [userId, config.MESSAGE_RETENTION_DAYS]
    );
    return { briefings: rows };
  });

  app.post(
    "/agents/:agentId/messages/:messageId/assistant-handoff",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { agentId, messageId } = request.params as {
        agentId: string;
        messageId: string;
      };
      const userId = request.auth!.userId;
      if (!isUuid(agentId) || !isUuid(messageId)) return agentNotFound(reply);

      const sourceGroup = await loadAgentMessageGroup(
        userId,
        agentId,
        messageId
      );
      const sourceContent = mergeAgentMessageContents(
        sourceGroup.rows.map((row) => row.content as AgentMessageContent)
      );
      if (!sourceContent || sourceContent.template !== "briefing_card") {
        return reply.code(404).send({
          error: { code: "MESSAGE_NOT_FOUND", message: "Briefing message not found." }
        });
      }
      const source = {
        content: sourceContent as unknown as Record<string, unknown>,
        source_refs: mergeSourceRefs(sourceGroup.rows)
      };

      const assistantId = await ensureAssistantContact(userId);
      const title = briefingTitle(source.content);

      const question = `Open “${title}” as context. Give me a short orientation, then help me explore any part of the report in detail.`;
      const sourceData = source.content.data;
      // Copy into Assistant for thread context only — never reappear on the home surface.
      const assistantBriefingContent = {
        ...source.content,
        data: {
          ...(sourceData &&
          typeof sourceData === "object" &&
          !Array.isArray(sourceData)
            ? (sourceData as Record<string, unknown>)
            : {}),
          assistant_context: true,
          home_dismissed_at: new Date().toISOString()
        }
      };
      let answer: string;
      const userName = request.auth!.user.name || "";
      const firstName = userName.trim().split(/\s+/)[0] || "";
      const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

      answer = await withLlmUser(userId, async () => {
        try {
          return await createAssistantChatReply(question, {
            userName: capitalizedFirstName,
            briefing: JSON.stringify(source.content),
            sourceRefs: source.source_refs
          });
        } catch {
          return `Here’s “${title}”. Ask about any section and I’ll dig in.`;
        }
      });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const now = new Date();
        const briefingMessage = await insertMessage(client, {
          agentId: assistantId,
          userId,
          role: "agent",
          content: assistantBriefingContent,
          sourceRefs: source.source_refs,
          createdAt: now
        });
        const assistantMessage = await insertMessage(client, {
          agentId: assistantId,
          userId,
          role: "agent",
          content: plainTextContent(answer),
          sourceRefs: source.source_refs,
          createdAt: offsetDate(now, 1)
        });
        await client.query(
          `
            UPDATE agent_messages
            SET content = jsonb_set(
              CASE
                WHEN jsonb_typeof(content->'data') = 'object' THEN content
                ELSE jsonb_set(content, '{data}', '{}'::jsonb, true)
              END,
              '{data,home_dismissed_at}',
              to_jsonb(NOW()::text),
              true
            )
            WHERE agent_id = $2 AND user_id = $3
              AND (
                id = $1
                OR (
                  $4::text IS NOT NULL
                  AND content #>> '{presentation,group_id}' = $4
                )
              )
          `,
          [messageId, agentId, userId, sourceGroup.groupId]
        );
        await touchAgentWithClient(client, userId, assistantId);
        await client.query("COMMIT");
        try {
          await publishMessageEvents(userId, [
            briefingMessage,
            assistantMessage
          ]);
        } catch (error) {
          request.log.warn(
            { error, userId, assistantId, messageId },
            "Briefing handoff committed but realtime publication failed"
          );
        }
        return reply.code(201).send({
          assistant_agent_id: assistantId,
          message: briefingMessage,
          assistant_message: assistantMessage
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  );

  app.delete("/agents/:agentId/messages", { preHandler: requireAuth }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const userId = request.auth!.userId;

    if (!isUuid(agentId)) {
      return agentNotFound(reply);
    }

    const agent = await getOwnedAgent(userId, agentId);
    if (!agent) {
      return agentNotFound(reply);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
        [userId, agentId]
      );
      await client.query(
        "DELETE FROM agent_messages WHERE user_id = $1 AND agent_id = $2",
        [userId, agentId]
      );
      await client.query(
        "UPDATE agents SET last_message_at = NULL WHERE id = $1 AND user_id = $2",
        [agentId, userId]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    if (agent.is_assistant) await clearUnconfirmedAssistantState(userId, agentId);

    await publishRealtimeEvent({
      type: "messages.cleared",
      user_id: userId,
      agent_id: agentId,
      data: {}
    });

    return reply.code(204).send();
  });

  app.post("/agents/:agentId/messages", { preHandler: requireAuth }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const userId = request.auth!.userId;
    const body = sendMessageSchema.safeParse(request.body);

    if (!isUuid(agentId)) {
      return agentNotFound(reply);
    }

    if (!body.success) {
      if (hasSecurityValidationIssue(body.error)) {
        request.log.warn(
          { userId, agentId, route: "send_message" },
          "Rejected unsafe message input"
        );
      }
      return reply.code(400).send({
        error: {
          code: hasSecurityValidationIssue(body.error)
            ? "UNSAFE_INPUT"
            : "INVALID_MESSAGE",
          message: body.error.issues[0]?.message ?? "Invalid message."
        }
      });
    }

    const agent = await getOwnedAgent(userId, agentId);
    if (!agent) {
      return agentNotFound(reply);
    }

    if (agent.is_assistant) {
      const assistantTurnStartedAt = Date.now();
      try {
        const result = await withLlmUser(userId, () =>
          handleAssistantMessage({
            userId,
            userName: request.auth!.user.name ?? undefined,
            assistantId: agentId,
            text: body.data.text,
            attachmentIds: body.data.attachment_ids,
            action: body.data.action,
            payload: body.data.payload
          })
        );
        request.log.info(
          {
            userId,
            assistantId: agentId,
            duration_ms: Date.now() - assistantTurnStartedAt,
            attachment_count: body.data.attachment_ids?.length ?? 0,
            source_count: result.source_references?.length ?? 0,
            pending_action_type: result.pending_action?.action_type ?? null,
            updated_agent_id: result.agent?.id ?? null
          },
          "Assistant turn completed"
        );

        return reply.code(201).send(result);
      } catch (error) {
        if (error instanceof AttachmentValidationError) {
          return reply.code(400).send({
            error: { code: error.code, message: error.message }
          });
        }
        request.log.error(
          {
            userId,
            assistantId: agentId,
            duration_ms: Date.now() - assistantTurnStartedAt,
            attachment_count: body.data.attachment_ids?.length ?? 0,
            error_name: error instanceof Error ? error.name : "unknown"
          },
          "Assistant turn failed"
        );
        throw error;
      }
    }

    if ((body.data.attachment_ids?.length ?? 0) > 0) {
      return reply.code(400).send({
        error: {
          code: "ATTACHMENTS_ASSISTANT_ONLY",
          message: "Open the Assistant contact to discuss attachments."
        }
      });
    }

    if (!agent.is_assistant && body.data.text) {
      const result = await withLlmUser(userId, () =>
        handleAgentTextMessage(
          userId,
          agent,
          body.data.text!,
          body.data.source_message_id
        )
      );
      return reply.code(201).send(result);
    }

    const message = await writeUserMessage(
      userId,
      agentId,
      messageContent(body.data)
    );
    await touchAgent(userId, agentId);
    await publishMessageEvents(userId, [message]);

    return reply.code(201).send({ message });
  });

  app.patch(
    "/agents/:agentId/messages/:messageId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { agentId, messageId } = request.params as {
        agentId: string;
        messageId: string;
      };
      const userId = request.auth!.userId;

      if (!isUuid(agentId)) {
        return agentNotFound(reply);
      }

      if (!isUuid(messageId)) {
        return reply.code(404).send({
          error: {
            code: "MESSAGE_NOT_FOUND",
            message: "Message not found."
          }
        });
      }

      const agent = await getOwnedAgent(userId, agentId);
      if (!agent) {
        return agentNotFound(reply);
      }

      const { rows } = await pool.query(
        `
          UPDATE agent_messages
          SET read_at = COALESCE(read_at, NOW())
          WHERE id = $1 AND agent_id = $2 AND user_id = $3
            AND created_at > NOW() - ($4::int * INTERVAL '1 day')
          RETURNING id, agent_id, user_id, role, content, source_refs, read_at, created_at
        `,
        [messageId, agentId, userId, config.MESSAGE_RETENTION_DAYS]
      );

      if (!rows[0]) {
        return reply.code(404).send({
          error: {
            code: "MESSAGE_NOT_FOUND",
            message: "Message not found."
          }
        });
      }

      return { message: rows[0] };
    }
  );
}

function agentNotFound(reply: FastifyReply) {
  return reply.code(404).send({
    error: {
      code: "AGENT_NOT_FOUND",
      message: "Agent not found."
    }
  });
}

async function getOwnedAgent(userId: string, agentId: string): Promise<AgentRow | null> {
  const { rows } = await pool.query<AgentRow>(
    `
      SELECT
        id,
        is_assistant,
        name,
        avatar,
        prompt,
        parsed_intent,
        connector_ids,
        schedule_cron,
        status,
        safety_level
      FROM agents
      WHERE id = $1 AND user_id = $2
    `,
    [agentId, userId]
  );

  const agent = rows[0];
  if (!agent || agent.is_assistant) return agent ?? null;
  const [configuration, runtimeState] = await Promise.all([
    loadCurrentAgentDefinition(agent.id),
    loadRuntimeState(agent.id)
  ]);
  if (!configuration) return agent;
  return {
    ...agent,
    parsed_intent: definitionToParsedIntent(configuration.definition, {
      name: agent.name,
      avatar: agent.avatar,
      runtimeState
    })
  };
}

function clampLimit(rawLimit: string | undefined): number {
  const parsed = rawLimit ? Number(rawLimit) : 50;
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.floor(parsed), 1), 100);
}

function messageContent(body: z.infer<typeof sendMessageSchema>) {
  return body.text
    ? plainTextContent(body.text)
    : {
        template: "action",
        version: "1.0",
        data: {
          action: body.action,
          payload: body.payload ?? {}
        }
      };
}

function plainTextContent(body: string) {
  return {
    template: "plain_text",
    version: "1.0",
    data: { body }
  };
}

async function handleAssistantTextMessage(
  userId: string,
  assistantId: string,
  text: string
): Promise<{
  message: MessageRow;
  agent_message: MessageRow;
  assistant_message: MessageRow;
  messages: MessageRow[];
  agent?: CreatedAgentRow;
}> {
  const assistantMode = classifyAssistantMessage(text);
  const client = await pool.connect();
  let createdAgent: CreatedAgentRow | undefined;
  const userCreatedAt = new Date();
  const assistantCreatedAt = offsetDate(userCreatedAt, 1);

  try {
    await client.query("BEGIN");

    const userMessage = await insertMessage(client, {
      agentId: assistantId,
      userId,
      role: "user",
      content: {
        template: "plain_text",
        version: "1.0",
        data: { body: text }
      },
      readAtNow: true,
      createdAt: userCreatedAt
    });

    if (assistantMode === "chat") {
      const briefingContext = await latestAssistantBriefingContext(
        userId,
        assistantId
      );
      const userResult = await client.query<{ name: string | null }>(
        "SELECT name FROM users WHERE id = $1",
        [userId]
      );
      const userName = userResult.rows[0]?.name || "";
      const firstName = userName.trim().split(/\s+/)[0] || "";
      const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

      const reply = await createAssistantChatReply(
        text,
        {
          ...(briefingContext ?? {}),
          userName: capitalizedFirstName
        }
      );
      const assistantMessage = await insertMessage(client, {
        agentId: assistantId,
        userId,
        role: "agent",
        content: plainTextContent(reply),
        createdAt: assistantCreatedAt
      });

      await touchAgentWithClient(client, userId, assistantId);
      await client.query("COMMIT");
      await publishMessageEvents(userId, [userMessage, assistantMessage]);

      return {
        message: userMessage,
        agent_message: assistantMessage,
        messages: [userMessage, assistantMessage],
        assistant_message: assistantMessage
      };
    }

    const parsedIntent = await parseIntentHybrid(text);

    if (parsedIntent.unsupported_connector) {
      const assistantMessage = await insertMessage(client, {
        agentId: assistantId,
        userId,
        role: "agent",
        content: unsupportedConnectorContent(parsedIntent),
        createdAt: assistantCreatedAt
      });

      await touchAgentWithClient(client, userId, assistantId);
      await client.query("COMMIT");
      await publishMessageEvents(userId, [userMessage, assistantMessage]);

      return {
        message: userMessage,
        agent_message: assistantMessage,
        messages: [userMessage, assistantMessage],
        assistant_message: assistantMessage
      };
    }

    createdAgent = await createAgent(client, userId, text, parsedIntent);
    await writeAgentCreatedMessage(
      client,
      userId,
      createdAgent.id,
      createdAgent.parsed_intent
    );

    const assistantMessage = await insertMessage(client, {
      agentId: assistantId,
      userId,
      role: "agent",
      content: assistantAgentCreatedContent(parsedIntent),
      createdAt: assistantCreatedAt
    });

    await touchAgentWithClient(client, userId, assistantId);
    await client.query("COMMIT");
    await syncAgentScheduleForUser(createdAgent, userId);
    await publishMessageEvents(userId, [userMessage, assistantMessage]);
    await publishRealtimeEvent({
      type: "agent.created",
      user_id: userId,
      agent_id: createdAgent.id,
      data: { name: createdAgent.name }
    });

    return {
      message: userMessage,
      agent_message: assistantMessage,
      assistant_message: assistantMessage,
      messages: [userMessage, assistantMessage],
      agent: createdAgent
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function handleAgentTextMessage(
  userId: string,
  agent: AgentRow,
  text: string,
  sourceMessageId?: string
): Promise<{
  message: MessageRow;
  agent_message: MessageRow;
  messages: MessageRow[];
  agent?: UpdatedAgentRow;
  classification: ReturnType<typeof classificationPayload>;
  instruction_update: InstructionUpdateRow;
  job?: {
    id: string | undefined;
    name: string;
  };
}> {
  const lastAgentReply = await latestAgentReplyText(userId, agent.id);
  const route = routeAgentMessage(agent, text);
  const refinedRoute = route.intent === "clarification_needed"
    ? await refineAmbiguousAgentMessage({ agent, text, route })
    : null;
  const decision = decideAgentInstruction(agent, text, {
    lastAgentReply,
    routeOverride: refinedRoute ?? route
  });

  // Generate LLM reply for chat follow-ups on agent output.
  let chatReplyText = decision.reply;
  if (decision.needsLlmReply) {
    try {
      const agentOutput = await latestAgentReply(
        userId,
        agent.id,
        sourceMessageId
      );
      const recentUserMsgs = await recentUserMessageTexts(userId, agent.id, 2);
      chatReplyText = await createAgentChatReply({
        userId,
        agent: {
          name: agent.name,
          prompt: agent.prompt,
          parsed_intent: agent.parsed_intent
        },
        latestAgentOutput: agentOutput.body ?? "",
        sourceRefs: agentOutput.sourceRefs,
        recentUserMessages: recentUserMsgs,
        userText: text
      });
    } catch {
      // Fall back to the static reply from the decision.
      chatReplyText = decision.reply;
    }
  }

  const client = await pool.connect();
  let updatedAgent: UpdatedAgentRow | undefined;
  let instructionUpdate: InstructionUpdateRow;
  let userMessage: MessageRow;
  let agentMessage: MessageRow;
  let job: Awaited<ReturnType<typeof enqueueAgentRun>> | undefined;
  let committed = false;
  const userCreatedAt = new Date();
  const agentCreatedAt = offsetDate(userCreatedAt, 1);

  try {
    await client.query("BEGIN");

    userMessage = await insertMessage(client, {
      agentId: agent.id,
      userId,
      role: "user",
      content: {
        template: "plain_text",
        version: "1.0",
        data: { body: text }
      },
      readAtNow: true,
      createdAt: userCreatedAt
    });

    if (
      decision.kind === "update_agent" &&
      decision.nextPrompt &&
      decision.nextParsedIntent
    ) {
      updatedAgent = await updateAgentInstructions(client, userId, agent, {
        prompt: decision.nextPrompt,
        parsedIntent: decision.nextParsedIntent,
        scheduleCron: decision.nextScheduleCron ?? null,
        status: decision.nextStatus ?? agent.status
      });
    }

    agentMessage = await insertMessage(client, {
      agentId: agent.id,
      userId,
      role: "agent",
      content: {
        template: "plain_text",
        version: "1.0",
        data: { body: chatReplyText }
      },
      createdAt: agentCreatedAt
    });

    instructionUpdate = await recordInstructionUpdate(client, {
      userId,
      agent,
      sourceMessageId: userMessage.id,
      decision
    });

    await touchAgentWithClient(client, userId, agent.id);
    job =
      decision.kind === "run_now" && agent.status === "active"
        ? await enqueueAgentRun(agent.id, "manual")
        : undefined;
    await client.query("COMMIT");
    committed = true;

    if (updatedAgent) {
      await syncAgentScheduleForUser(updatedAgent, userId);
    }

    await publishMessageEvents(userId, [userMessage, agentMessage]);

    if (updatedAgent) {
      await publishRealtimeEvent({
        type: "agent.updated",
        user_id: userId,
        agent_id: updatedAgent.id,
        data: {
          status: updatedAgent.status,
          schedule_cron: updatedAgent.schedule_cron
        }
      });
    }

    if (job) {
      await publishRealtimeEvent({
        type: "run.queued",
        user_id: userId,
        agent_id: agent.id,
        data: { job_id: job.id, trigger: "manual" }
      });
    }

    return {
      message: userMessage,
      agent_message: agentMessage,
      messages: [userMessage, agentMessage],
      ...(updatedAgent ? { agent: updatedAgent } : {}),
      classification: classificationPayload(decision),
      instruction_update: instructionUpdate,
      ...(job ? { job: { id: job.id, name: job.name } } : {})
    };
  } catch (error) {
    if (!committed) {
      await client.query("ROLLBACK");
      if (job) {
        await job.remove().catch(() => undefined);
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

function extractBodyFromContent(content: any): string | null {
  if (!content) return null;
  if (typeof content === "string") return content;

  const template = content.template;
  const data = content.data;
  if (!data) return null;

  if (typeof template === "string" && isScheduledOutputContract(template)) {
    try {
      return textualizeOutput(content);
    } catch {
      // Old retained payloads still use the compatibility textualizers below.
    }
  }

  if (template === "plain_text") {
    return data.body || data.text || data.headline || "";
  }

  if (template === "news_brief") {
    const title = data.title ? `${data.title}\n` : "";
    const items = Array.isArray(data.items)
      ? data.items
          .map((item: any) => {
            const headline = item.headline ? `Headline: ${item.headline}\n` : "";
            const summary = item.summary ? `Summary: ${item.summary}` : "";
            return `${headline}${summary}`;
          })
          .join("\n\n")
      : "";
    return `${title}\n${items}`.trim();
  }

  if (template === "data_summary") {
    const title = data.title ? `${data.title}\n` : "";
    const summary = data.summary ? `Summary: ${data.summary}\n` : "";
    const desc = data.description ? `Description: ${data.description}\n` : "";
    const footer = data.footer ? `\n${data.footer}` : "";
    return `${title}${summary}${desc}${footer}`.trim();
  }

  if (template === "briefing_card") {
    const sections = Array.isArray(data.sections)
      ? data.sections
          .map((section: any) => {
            const heading = section.title || section.source || "Update";
            const items = Array.isArray(section.items)
              ? section.items
                  .map((item: any) => `- ${item.title}${item.detail ? `: ${item.detail}` : ""}`)
                  .join("\n")
              : "";
            return `${heading}\n${items}`.trim();
          })
          .join("\n\n")
      : "";
    return [data.title, data.summary, sections].filter(Boolean).join("\n\n");
  }

  if (template === "urgency_list") {
    const title = data.title ? `${data.title}\n` : "";
    const items = Array.isArray(data.items)
      ? data.items
          .map((item: any) => `- ${item.label} (Urgency: ${item.urgency ?? "none"}, Due: ${item.due ?? "N/A"}): ${item.preview ?? ""}`)
          .join("\n")
      : "";
    return `${title}\n${items}`.trim();
  }

  if (template === "progress_tracker") {
    const title = data.title ? `${data.title}\n` : "";
    const text = data.text ? `${data.text}\n` : "";
    const progress = `Progress: ${data.current}/${data.total}\n`;
    const steps = Array.isArray(data.steps)
      ? data.steps.map((s: any) => `[${s.done ? "x" : " "}] ${s.label}`).join("\n")
      : "";
    return `${title}${text}${progress}\n${steps}`.trim();
  }

  if (template === "checklist") {
    const title = data.title ? `${data.title}\n` : "";
    const subtitle = data.subtitle ? `${data.subtitle}\n` : "";
    const msg = data.message ? `${data.message}\n` : "";
    const items = Array.isArray(data.items)
      ? data.items.map((item: any) => `[${item.checked ? "x" : " "}] ${item.label}`).join("\n")
      : "";
    return `${title}${subtitle}${msg}\n${items}`.trim();
  }

  if (template === "daily_task") {
    const title = data.title ? `${data.title}\n` : "";
    const task = data.task ? `Task: ${data.task}\n` : "";
    const context = data.context ? `Context: ${data.context}` : "";
    return `${title}${task}${context}`.trim();
  }

  if (template === "streak_counter") {
    const label = data.label ? `${data.label}: ` : "";
    const count = `${data.count} ${data.unit}\n`;
    const caption = data.caption ? `${data.caption}\n` : "";
    return `${label}${count}${caption}`.trim();
  }

  if (template === "comparison") {
    const title = data.title ? `${data.title}\n` : "";
    const narrative = data.trending_narrative ? `${data.trending_narrative}\n` : "";
    const rows = Array.isArray(data.rows)
      ? data.rows.map((row: any) => `${row.label}: ${Array.isArray(row.changes) ? row.changes.join(", ") : ""}`).join("\n")
      : "";
    const insight = data.insight ? `\nInsight: ${data.insight}` : "";
    return `${title}${narrative}\n${rows}${insight}`.trim();
  }

  return data.body || data.text || data.message || data.summary || JSON.stringify(data);
}

async function latestAgentReplyText(
  userId: string,
  agentId: string
): Promise<string | null> {
  const group = await loadAgentMessageGroup(userId, agentId);
  const content = mergeAgentMessageContents(
    group.rows.map((row) => row.content as AgentMessageContent)
  );
  return content ? extractBodyFromContent(content) : null;
}

async function latestAssistantBriefingContext(
  userId: string,
  assistantId: string
): Promise<{ briefing: string; sourceRefs: unknown[] } | null> {
  const { rows } = await pool.query<{
    briefing_context: Record<string, unknown> | null;
    source_refs: unknown[];
  }>(
    `
      SELECT
        CASE
          WHEN content->'data'->'briefing_context' IS NOT NULL
            THEN content->'data'->'briefing_context'
          ELSE content
        END AS briefing_context,
        COALESCE(source_refs, '[]'::jsonb) AS source_refs
      FROM agent_messages
      WHERE user_id = $1
        AND agent_id = $2
        AND created_at > NOW() - ($3::int * INTERVAL '1 day')
        AND (
          content->'data'->'briefing_context' IS NOT NULL
          OR (
            content->>'template' = 'briefing_card'
            AND content #>> '{data,assistant_context}' = 'true'
          )
        )
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId, assistantId, config.MESSAGE_RETENTION_DAYS]
  );
  const context = rows[0];
  if (!context?.briefing_context) return null;
  return {
    briefing: JSON.stringify(context.briefing_context),
    sourceRefs: context.source_refs
  };
}

async function latestAgentReply(
  userId: string,
  agentId: string,
  sourceMessageId?: string
): Promise<{ body: string | null; sourceRefs: unknown[] }> {
  const group = await loadAgentMessageGroup(
    userId,
    agentId,
    sourceMessageId
  );
  const content = mergeAgentMessageContents(
    group.rows.map((row) => row.content as AgentMessageContent)
  );
  if (!content) {
    return { body: null, sourceRefs: [] };
  }

  return {
    body: extractBodyFromContent(content),
    sourceRefs: mergeSourceRefs(group.rows)
  };
}

type AgentMessageGroupRow = {
  id: string;
  content: unknown;
  source_refs: unknown[];
};

async function loadAgentMessageGroup(
  userId: string,
  agentId: string,
  sourceMessageId?: string
): Promise<{ rows: AgentMessageGroupRow[]; groupId: string | null }> {
  const { rows } = await pool.query<AgentMessageGroupRow>(
    `
      WITH selected AS (
        SELECT id, content, created_at
        FROM agent_messages
        WHERE user_id = $1
          AND agent_id = $2
          AND role = 'agent'
          AND created_at > NOW() - ($3::int * INTERVAL '1 day')
          AND ($4::uuid IS NULL OR id = $4)
        ORDER BY created_at DESC
        LIMIT 1
      )
      SELECT message.id,
             message.content,
             COALESCE(message.source_refs, '[]'::jsonb) AS source_refs
      FROM selected
      INNER JOIN agent_messages AS message
        ON message.user_id = $1
       AND message.agent_id = $2
       AND message.role = 'agent'
       AND (
         (
           selected.content #>> '{presentation,group_id}' IS NULL
           AND message.id = selected.id
         )
         OR (
           selected.content #>> '{presentation,group_id}' IS NOT NULL
           AND message.content #>> '{presentation,group_id}' =
               selected.content #>> '{presentation,group_id}'
         )
       )
      ORDER BY
        COALESCE(
          NULLIF(message.content #>> '{presentation,part_index}', '')::int,
          0
        ) ASC,
        message.created_at ASC
    `,
    [
      userId,
      agentId,
      config.MESSAGE_RETENTION_DAYS,
      sourceMessageId ?? null
    ]
  );
  return {
    rows,
    groupId: rows.length > 0 ? messageGroupId(rows[0]!.content) : null
  };
}

function mergeSourceRefs(rows: AgentMessageGroupRow[]): unknown[] {
  const seen = new Set<string>();
  const merged: unknown[] = [];
  for (const row of rows) {
    for (const reference of Array.isArray(row.source_refs)
      ? row.source_refs
      : []) {
      const key = JSON.stringify(reference);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(reference);
    }
  }
  return merged;
}

async function recentUserMessageTexts(
  userId: string,
  agentId: string,
  limit: number
): Promise<string[]> {
  const { rows } = await pool.query<{ body: string | null }>(
    `
      SELECT COALESCE(
        content #>> '{data,body}',
        content #>> '{data,text}'
      ) AS body
      FROM agent_messages
      WHERE user_id = $1
        AND agent_id = $2
        AND role = 'user'
        AND created_at > NOW() - ($4::int * INTERVAL '1 day')
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [userId, agentId, limit, config.MESSAGE_RETENTION_DAYS]
  );

  return rows
    .map((row) => row.body)
    .filter((body): body is string => body !== null && body.trim().length > 0)
    .reverse();
}

async function writeUserMessage(
  userId: string,
  agentId: string,
  content: Record<string, unknown>
): Promise<MessageRow> {
  const { rows } = await pool.query<MessageRow>(
    `
      INSERT INTO agent_messages
        (agent_id, user_id, role, content, source_refs, read_at)
      VALUES ($1, $2, 'user', $3, '[]'::jsonb, NOW())
      RETURNING id, agent_id, user_id, role, content, source_refs, read_at, created_at
    `,
    [agentId, userId, JSON.stringify(content)]
  );

  return rows[0]!;
}

async function insertMessage(
  client: PoolClient,
  input: {
    agentId: string;
    userId: string;
    role: "agent" | "user" | "system";
    content: Record<string, unknown>;
    readAtNow?: boolean;
    createdAt?: Date;
    sourceRefs?: unknown[];
  }
): Promise<MessageRow> {
  const { rows } = await client.query<MessageRow>(
    `
      INSERT INTO agent_messages
        (agent_id, user_id, role, content, source_refs, read_at, created_at)
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $6,
        ${input.readAtNow ? "COALESCE($5::timestamptz, NOW())" : "NULL"},
        COALESCE($5::timestamptz, NOW())
      )
      RETURNING id, agent_id, user_id, role, content, source_refs, read_at, created_at
    `,
    [
      input.agentId,
      input.userId,
      input.role,
      JSON.stringify(input.content),
      input.createdAt ?? null,
      JSON.stringify(input.sourceRefs ?? [])
    ]
  );

  return rows[0]!;
}

function briefingTitle(content: Record<string, unknown>): string {
  const data = content.data;
  if (data && typeof data === "object") {
    const title = (data as Record<string, unknown>).title;
    if (typeof title === "string" && title.trim()) return title.trim().slice(0, 160);
  }
  return "this briefing";
}

function offsetDate(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

type AssistantMessageMode = "create_agent" | "chat";

function classifyAssistantMessage(text: string): AssistantMessageMode {
  const lower = text.trim().toLowerCase();
  const explicitlyCreatesAgent =
    /\b(?:create|make|build|setup)\b.*\bagent\b/.test(lower) ||
    /\bset\s+up\b.*\bagent\b/.test(lower);

  if (explicitlyCreatesAgent) {
    return "create_agent";
  }

  return "chat";
}

async function createAgent(
  client: PoolClient,
  userId: string,
  prompt: string,
  parsedIntent: ParsedIntent
): Promise<CreatedAgentRow> {
  return insertConfiguredAgent<CreatedAgentRow>(client, {
    userId,
    name: parsedIntent.name,
    avatar: parsedIntent.avatar,
    prompt,
    parsedIntent,
    createdBy: "assistant_message"
  });
}

async function updateAgentInstructions(
  client: PoolClient,
  userId: string,
  agent: AgentRow,
  update: {
    prompt: string;
    parsedIntent: ParsedIntent;
    scheduleCron: string | null;
    status: "active" | "paused" | "error";
  }
): Promise<UpdatedAgentRow> {
  await reviseAgentDefinition(client, {
    agentId: agent.id,
    userId,
    definition: compileAgentDefinition(update.parsedIntent, update.prompt),
    name: agent.name,
    avatar: agent.avatar,
    prompt: update.prompt,
    status: update.status,
    createdBy: "agent_chat"
  });
  await client.query(
    `UPDATE agents SET last_message_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [agent.id, userId]
  );
  const { rows } = await client.query<UpdatedAgentRow>(
    `SELECT
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
     WHERE id = $1 AND user_id = $2`,
    [agent.id, userId]
  );

  return rows[0]!;
}

async function recordInstructionUpdate(
  client: PoolClient,
  input: {
    userId: string;
    agent: AgentRow;
    sourceMessageId: string;
    decision: AgentInstructionDecision;
  }
): Promise<InstructionUpdateRow> {
  const { agent, decision } = input;
  const { rows } = await client.query<InstructionUpdateRow>(
    `
      INSERT INTO agent_instruction_updates
        (agent_id, user_id, source_message_id, kind, status, confidence, reason,
         patch, previous_prompt, previous_parsed_intent, previous_schedule_cron,
         next_prompt, next_parsed_intent, next_schedule_cron)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12, $13, $14)
      RETURNING
        id,
        agent_id,
        user_id,
        source_message_id,
        kind,
        status,
        confidence,
        reason,
        patch,
        previous_prompt,
        previous_parsed_intent,
        previous_schedule_cron,
        next_prompt,
        next_parsed_intent,
        next_schedule_cron,
        created_at
    `,
    [
      agent.id,
      input.userId,
      input.sourceMessageId,
      decision.kind,
      decision.status,
      decision.confidence,
      decision.reason,
      JSON.stringify(decision.patch),
      agent.prompt,
      JSON.stringify(agent.parsed_intent),
      agent.schedule_cron,
      decision.nextPrompt ?? null,
      decision.nextParsedIntent ? JSON.stringify(decision.nextParsedIntent) : null,
      decision.nextScheduleCron ?? null
    ]
  );

  return rows[0]!;
}

function classificationPayload(decision: AgentInstructionDecision) {
  return {
    kind: decision.kind,
    status: decision.status,
    confidence: decision.confidence,
    reason: decision.reason,
    patch: decision.patch
  };
}

async function publishMessageEvents(
  userId: string,
  messages: MessageRow[]
): Promise<void> {
  for (const message of messages) {
    await publishRealtimeEvent({
      type: "message.created",
      user_id: userId,
      agent_id: message.agent_id,
      message_id: message.id,
      data: {
        role: message.role,
        created_at: message.created_at
      }
    });
  }
}

async function writeAgentCreatedMessage(
  client: PoolClient,
  userId: string,
  agentId: string,
  parsedIntent: ParsedIntent
): Promise<void> {
  const githubConnected = !parsedIntent.connector_ids.includes("github") ||
    await hasUsableGitHubToken(userId);
  const message = agentCreationThreadMessage({
    parsedIntent,
    githubConnected,
    readyDetail: agentCreationReadyDetail(parsedIntent, describeSchedule)
  });

  await insertMessage(client, {
    agentId,
    userId,
    role: message.role,
    content: message.content
  });
}

async function ensureGitHubSetupMessage(
  userId: string,
  agent: AgentRow
): Promise<void> {
  if (!agent.connector_ids.includes("github")) return;

  try {
    if (await hasUsableGitHubToken(userId)) return;
  } catch {
    // Keep the thread usable and surface the reconnect action if status lookup fails.
  }

  const message = agentCreationThreadMessage({
    parsedIntent: agent.parsed_intent,
    githubConnected: false,
    readyDetail: "GitHub authorization is required."
  });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      [userId, agent.id]
    );
    const existing = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM agent_messages
          WHERE user_id = $1
            AND agent_id = $2
            AND created_at > NOW() - ($4::int * INTERVAL '1 day')
            AND content->'data'->'actions' @> $3::jsonb
        ) AS exists
      `,
      [
        userId,
        agent.id,
        JSON.stringify([{ connector_id: "github" }]),
        config.MESSAGE_RETENTION_DAYS
      ]
    );

    if (!existing.rows[0]?.exists) {
      await client.query(
        `
          INSERT INTO agent_messages
            (agent_id, user_id, role, content, source_refs)
          VALUES ($1, $2, $3, $4, '[]'::jsonb)
        `,
        [agent.id, userId, message.role, JSON.stringify(message.content)]
      );
      await client.query(
        "UPDATE agents SET last_message_at = NOW() WHERE id = $1 AND user_id = $2",
        [agent.id, userId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function touchAgent(userId: string, agentId: string): Promise<void> {
  await pool.query(
    "UPDATE agents SET last_message_at = NOW() WHERE id = $1 AND user_id = $2",
    [agentId, userId]
  );
}

async function touchAgentWithClient(
  client: PoolClient,
  userId: string,
  agentId: string
): Promise<void> {
  await client.query(
    "UPDATE agents SET last_message_at = NOW() WHERE id = $1 AND user_id = $2",
    [agentId, userId]
  );
}

function unsupportedConnectorContent(parsedIntent: ParsedIntent) {
  return {
    template: "plain_text",
    version: "1.0",
    data: {
      body: `I can't create that yet because ${parsedIntent.unsupported_connector} is not supported. I can create agents for Gmail, Google Calendar, GitHub, Slack, Notion, Drive, web search, reminders, and study plans.`
    }
  };
}

function assistantAgentCreatedContent(parsedIntent: ParsedIntent) {
  return {
    template: "plain_text",
    version: "1.0",
    data: {
      body: [
        `${parsedIntent.name} is ready.`,
        agentCreationReadyDetail(parsedIntent, describeSchedule),
        "I created it as a new contact in your inbox."
      ].join("\n")
    }
  };
}

function buildAgentInstructionUpdate(
  agent: AgentRow,
  text: string
): {
  prompt: string;
  parsedIntent: ParsedIntent;
  scheduleCron: string | null;
  reply: string;
} {
  const instruction = normalizeInstruction(text);
  const scheduleCron = scheduleOverrideFromText(text) ?? agent.schedule_cron;
  const parsedIntent = {
    ...agent.parsed_intent,
    action: mergeAction(agent.parsed_intent, instruction),
    schedule_cron: scheduleCron
  };
  const prompt = [agent.prompt, `User update: ${text}`].join("\n\n");

  return {
    prompt,
    parsedIntent,
    scheduleCron,
    reply: updateReply(agent, instruction, scheduleCron)
  };
}

function normalizeInstruction(text: string): string {
  const normalized = text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^along with (?:the )?(?:reminders?|agent),?\s*/i, "")
    .replace(/^(?:also|and|plus),?\s*/i, "")
    .replace(/^(?:please\s+)?(?:add|include)\s+/i, "")
    .trim();

  return restoreAcronyms(normalized || text.trim());
}

function mergeAction(parsedIntent: ParsedIntent, instruction: string): string {
  if (parsedIntent.intent === "scheduled_reminder") {
    const existing = parsedIntent.action
      .replace(/^Reminder:\s*/i, "")
      .replace(/\.$/, "")
      .trim();
    const next = instruction.replace(/\.$/, "").trim();

    if (!existing) {
      return `Reminder: ${sentenceCase(next)}.`;
    }

    return `Reminder: ${existing} and ${next}.`;
  }

  const action = parsedIntent.action.replace(/\.$/, "").trim();
  return `${action}. Also: ${instruction}.`;
}

function updateReply(
  agent: AgentRow,
  instruction: string,
  scheduleCron: string | null
): string {
  const replyItem = replyInstruction(instruction);
  const schedule = scheduleCron
    ? ` on the existing schedule: ${describeSchedule(scheduleCron)}`
    : "";

  if (agent.parsed_intent.intent === "scheduled_reminder") {
    return `Updated. I'll include ${replyItem}${schedule}.`;
  }

  return `Updated. I'll include ${replyItem} going forward.`;
}

function replyInstruction(instruction: string): string {
  const stripped = instruction
    .replace(/^send me\s+/i, "")
    .replace(/^send\s+/i, "")
    .replace(/^remind me to\s+/i, "")
    .trim();

  return stripped || instruction;
}

function restoreAcronyms(value: string): string {
  return value.replace(/\bdsa\b/gi, "DSA");
}

function sentenceCase(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function scheduleOverrideFromText(text: string): string | null {
  const lower = text.toLowerCase();
  const explicitTime = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (!explicitTime) {
    return null;
  }

  const hour = to24Hour(explicitTime[1], explicitTime[3]);
  const minute = explicitTime[2] ? Number(explicitTime[2]) : 0;

  if (lower.includes("friday")) return `${minute} ${hour} * * 5`;
  if (lower.includes("weekly") || lower.includes("every week")) {
    return `${minute} ${hour} * * 1`;
  }
  if (lower.includes("monthly") || lower.includes("every month")) {
    return `${minute} ${hour} 1 * *`;
  }

  return `${minute} ${hour} * * *`;
}

function to24Hour(rawHour: string | undefined, meridiem: string | undefined): number {
  const hour = Number(rawHour);
  if (meridiem === "am") return hour === 12 ? 0 : hour;
  if (meridiem === "pm") return hour === 12 ? 12 : hour + 12;
  return hour;
}

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
import { parseIntentHybrid } from "../agents/llm-intent.js";
import { refineAmbiguousAgentMessage } from "../agents/llm-message-router.js";
import { routeAgentMessage } from "../agents/message-router.js";
import type { ParsedIntent } from "../agents/parser.js";
import { syncAgentSchedule } from "../agents/scheduler.js";
import { requireAuth } from "../auth/middleware.js";
import { pool } from "../db/index.js";
import { enqueueAgentRun } from "../queue/index.js";
import { publishRealtimeEvent } from "../realtime/events.js";
import { hasUsableGitHubToken } from "../connectors/github.js";
import { agentCreationThreadMessage } from "../agents/creation-message.js";
import {
  hasSecurityValidationIssue,
  validatedTextSchema
} from "../security/input-validation.js";

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
    payload: z.record(z.unknown()).optional()
  })
  .strict()
  .refine((body) => body.text || body.action, {
    message: "Either text or action is required."
  });

type AgentRow = {
  id: string;
  is_assistant: boolean;
  name: string;
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
      `,
      [userId, agentId]
    );

    const { rows } = await pool.query(
      `
        SELECT id, agent_id, user_id, role, content, source_refs, read_at, created_at
        FROM agent_messages
        WHERE user_id = $1 AND agent_id = $2
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
      [userId, agentId, limit]
    );

    return { messages: rows.reverse() };
  });

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

    await pool.query(
      "DELETE FROM agent_messages WHERE user_id = $1 AND agent_id = $2",
      [userId, agentId]
    );

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

    if (agent.is_assistant && body.data.text) {
      const result = await handleAssistantTextMessage(
        userId,
        agentId,
        body.data.text
      );

      return reply.code(201).send(result);
    }

    if (!agent.is_assistant && body.data.text) {
      const result = await handleAgentTextMessage(userId, agent, body.data.text);
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
          RETURNING id, agent_id, user_id, role, content, source_refs, read_at, created_at
        `,
        [messageId, agentId, userId]
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

  return rows[0] ?? null;
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
      const reply = await createAssistantChatReply(text);
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
    await writeAgentCreatedMessage(client, userId, createdAgent.id, parsedIntent);

    const assistantMessage = await insertMessage(client, {
      agentId: assistantId,
      userId,
      role: "agent",
      content: assistantAgentCreatedContent(parsedIntent),
      createdAt: assistantCreatedAt
    });

    await touchAgentWithClient(client, userId, assistantId);
    await client.query("COMMIT");
    await syncAgentSchedule(createdAgent);
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
  text: string
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
      const agentOutput = await latestAgentReply(userId, agent.id);
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
    await client.query("COMMIT");

    if (updatedAgent) {
      await syncAgentSchedule(updatedAgent);
    }

    const job =
      decision.kind === "run_now" && agent.status === "active"
        ? await enqueueAgentRun(agent.id, "manual")
        : undefined;

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
    await client.query("ROLLBACK");
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
  const { rows } = await pool.query<{ content: any }>(
    `
      SELECT content
      FROM agent_messages
      WHERE user_id = $1
        AND agent_id = $2
        AND role = 'agent'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId, agentId]
  );

  return rows[0] ? extractBodyFromContent(rows[0].content) : null;
}

async function latestAgentReply(
  userId: string,
  agentId: string
): Promise<{ body: string | null; sourceRefs: unknown[] }> {
  const { rows } = await pool.query<{ content: any; source_refs: unknown[] }>(
    `
      SELECT content,
      COALESCE(source_refs, '[]'::jsonb) AS source_refs
      FROM agent_messages
      WHERE user_id = $1
        AND agent_id = $2
        AND role = 'agent'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId, agentId]
  );

  if (!rows[0]) {
    return { body: null, sourceRefs: [] };
  }

  return {
    body: extractBodyFromContent(rows[0].content),
    sourceRefs: rows[0].source_refs
  };
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
      ORDER BY created_at DESC
      LIMIT $3
    `,
    [userId, agentId, limit]
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
        '[]'::jsonb,
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
      input.createdAt ?? null
    ]
  );

  return rows[0]!;
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
  const { rows } = await client.query<CreatedAgentRow>(
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
      prompt,
      JSON.stringify(parsedIntent),
      parsedIntent.connector_ids,
      parsedIntent.schedule_cron,
      parsedIntent.safety_level
    ]
  );

  return rows[0]!;
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
  const parsedIntent = typeof agent.parsed_intent === "string"
    ? JSON.parse(agent.parsed_intent)
    : (agent.parsed_intent || {});
  const mergedIntent = {
    ...update.parsedIntent,
    topics_covered: parsedIntent.topics_covered ?? [],
    history: parsedIntent.history ?? {}
  };

  const { rows } = await client.query<UpdatedAgentRow>(
    `
      UPDATE agents
      SET prompt = $1,
          parsed_intent = $2,
          schedule_cron = $3,
          status = $4,
          last_message_at = NOW()
      WHERE id = $5 AND user_id = $6
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
      update.prompt,
      JSON.stringify(mergedIntent),
      update.scheduleCron,
      update.status,
      agent.id,
      userId
    ]
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
    readyDetail: parsedIntent.schedule_cron
      ? `It will run ${describeSchedule(parsedIntent.schedule_cron)}.`
      : "It is ready for on-demand replies."
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
            AND content->'data'->'actions' @> $3::jsonb
        ) AS exists
      `,
      [userId, agent.id, JSON.stringify([{ connector_id: "github" }])]
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
      body: `I can't create that yet because ${parsedIntent.unsupported_connector} is not supported. I can create agents for Gmail, Google Calendar, GitHub, Slack, Drive, web search, reminders, and study plans.`
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
        parsedIntent.schedule_cron
          ? `It will run ${describeSchedule(parsedIntent.schedule_cron)}.`
          : "I did not detect a schedule, so it is ready for manual runs.",
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

function describeSchedule(cron: string): string {
  const daily = cron.match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
  if (daily) {
    return `every day at ${formatTime(Number(daily[2]), Number(daily[1]))}`;
  }

  const weekly = cron.match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+(\d)$/);
  if (weekly) {
    return `weekly on ${weekdayName(Number(weekly[3]))} at ${formatTime(Number(weekly[2]), Number(weekly[1]))}`;
  }

  const monthly = cron.match(/^(\d{1,2})\s+(\d{1,2})\s+1\s+\*\s+\*$/);
  if (monthly) {
    return `monthly on day 1 at ${formatTime(Number(monthly[2]), Number(monthly[1]))}`;
  }

  return `on schedule ${cron}`;
}

function formatTime(hour24: number, minute: number): string {
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

function weekdayName(day: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day] ?? "Monday";
}

function to24Hour(rawHour: string | undefined, meridiem: string | undefined): number {
  const hour = Number(rawHour);
  if (meridiem === "am") return hour === 12 ? 0 : hour;
  if (meridiem === "pm") return hour === 12 ? 12 : hour + 12;
  return hour;
}

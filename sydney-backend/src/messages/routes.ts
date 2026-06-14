import type { FastifyInstance, FastifyReply } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { isUuid } from "../api/ids.js";
import {
  decideAgentInstruction,
  type AgentInstructionDecision
} from "../agents/instruction-updater.js";
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

const sendMessageSchema = z.object({
  text: z.string().trim().min(1).max(8000).optional(),
  action: z.string().trim().min(1).max(200).optional(),
  payload: z.record(z.unknown()).optional()
}).refine((body) => body.text || body.action, {
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

    const { rows } = await pool.query(
      `
        SELECT id, agent_id, user_id, role, content, source_refs, read_at, created_at
        FROM agent_messages
        WHERE user_id = $1 AND agent_id = $2
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

  app.post("/agents/:agentId/messages", { preHandler: requireAuth }, async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const userId = request.auth!.userId;
    const body = sendMessageSchema.safeParse(request.body);

    if (!isUuid(agentId)) {
      return agentNotFound(reply);
    }

    if (!body.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_MESSAGE",
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
        data: { body: decision.reply }
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

async function latestAgentReplyText(
  userId: string,
  agentId: string
): Promise<string | null> {
  const { rows } = await pool.query<{ body: string | null }>(
    `
      SELECT COALESCE(
        content #>> '{data,body}',
        content #>> '{data,text}',
        content #>> '{data,message}',
        content #>> '{data,summary}'
      ) AS body
      FROM agent_messages
      WHERE user_id = $1
        AND agent_id = $2
        AND role = 'agent'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId, agentId]
  );

  return rows[0]?.body ?? null;
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
    /\b(?:create|make|build)\s+(?:a|an|new|the)?\s*agent\b/.test(lower) ||
    /\bset\s+up\s+(?:a|an|new|the)?\s*agent\b/.test(lower) ||
    /\bsetup\s+(?:a|an|new|the)?\s*agent\b/.test(lower);

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
      JSON.stringify(update.parsedIntent),
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
  await insertMessage(client, {
    agentId,
    userId,
    role: "system",
    content: {
      template: "system",
      version: "1.0",
      data: {
        type: "agent_created",
        icon: "check",
        message: `${parsedIntent.name} is ready.`,
        detail: parsedIntent.schedule_cron
          ? `It will run ${describeSchedule(parsedIntent.schedule_cron)}.`
          : "It is ready for on-demand replies.",
        action: null
      }
    }
  });
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
      body: `I can't create that yet because ${parsedIntent.unsupported_connector} is not supported. I can create agents for Gmail, Slack, Drive, web search, reminders, and study plans.`
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

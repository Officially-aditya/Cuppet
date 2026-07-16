import type { PoolClient } from "pg";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import { createAssistantChatReply } from "../agents/assistant-chat.js";
import {
  AgentServiceError,
  deleteManagedAgent,
  listManagedAgents,
  renameManagedAgent,
  resolveAgentTarget,
  runManagedAgent,
  setManagedAgentStatus,
  updateManagedAgentDescription,
  type ManagedAgent
} from "../agents/agent-service.js";
import { parseIntentHybrid } from "../agents/llm-intent.js";
import type { ParsedIntent } from "../agents/parser.js";
import { describeSchedule } from "../agents/message-router.js";
import {
  agentCreationReadyDetail,
  agentCreationThreadMessage
} from "../agents/creation-message.js";
import { syncAgentScheduleForUser } from "../agents/scheduler.js";
import { hasUsableGitHubToken } from "../connectors/github.js";
import { publishRealtimeEvent } from "../realtime/events.js";
import {
  analyzeAttachments,
  attachmentEvidence,
  attachmentMetadata,
  loadOwnedAttachments,
  storeMessageAttachments,
  type AnalyzedAttachment
} from "../uploads/attachment-analysis.js";
import {
  assembleAssistantKernel,
  deleteAllMemories,
  extractMemoryObservation,
  forgetMemoriesMatching,
  getCompactedMemoryDigest,
  isUnsafeMemoryText,
  listConfirmedMemories,
  recordMemoryObservation,
  setMemoryStatus,
  type MemoryRecordResult
} from "./memory.js";
import {
  classifyAmbiguousConnectorQuery,
  connectorActionContent,
  executeAssistantConnectorReads
} from "./connector-tools.js";
import { routeAssistantMessage, type AssistantRoute } from "./router.js";

export type AssistantMessageRow = {
  id: string;
  agent_id: string;
  user_id: string;
  role: "agent" | "user" | "system";
  content: Record<string, unknown>;
  source_refs: unknown[];
  read_at: Date | string | null;
  created_at: Date | string;
};

export type AssistantHandleResult = {
  message: AssistantMessageRow;
  agent_message: AssistantMessageRow;
  assistant_message: AssistantMessageRow;
  messages: AssistantMessageRow[];
  agent?: ManagedAgent;
  source_references?: unknown[];
  pending_action?: Record<string, unknown>;
  attachments?: ReturnType<typeof attachmentMetadata>;
  job?: { id: string | undefined; name: string };
};

type PendingAction = {
  id: string;
  user_id: string;
  assistant_id: string;
  target_agent_id: string | null;
  source_message_id: string | null;
  action_type: "delete_agent" | "forget_everything" | "confirm_memory";
  payload: Record<string, unknown>;
  expires_at: Date | string;
};

export async function handleAssistantMessage(input: {
  userId: string;
  assistantId: string;
  text?: string;
  attachmentIds?: string[];
  action?: string;
  payload?: Record<string, unknown>;
}): Promise<AssistantHandleResult> {
  const text = input.text?.trim() ?? "";
  const currentInstruction = text || "Please analyze the attached files.";
  const activePending = await activePendingAction(input.userId, input.assistantId);
  const route = input.action
    ? actionRoute(input.action, Boolean(activePending))
    : routeAssistantMessage(currentInstruction, {
        hasPendingAction: Boolean(activePending)
      });
  const kernel = config.ASSISTANT_MEMORY_ENABLED
    ? await assembleAssistantKernel(input.userId, input.assistantId)
    : {
        stm: [],
        ltm: [],
        pendingAction: null,
        evidenceTree: {
          assistantId: input.assistantId,
          messageIds: [],
          attachmentIds: [],
          sourceReferences: []
        }
      };

  const attachments = await loadAndAnalyzeAttachments(
    input.userId,
    input.attachmentIds ?? []
  );
  const written = await writeUserTurn({
    userId: input.userId,
    assistantId: input.assistantId,
    text,
    action: input.action,
    payload: input.payload,
    attachments
  });

  let outcome: AssistantOutcome;
  if (route.kind === "confirm") {
    outcome = await handlePendingDecision(
      input.userId,
      input.assistantId,
      route.decision,
      input.payload?.pending_action_id?.toString()
    );
  } else if (written.memoryResult?.rejected) {
    outcome = {
      content: plainText(
        "I can’t store passwords, tokens, security prompts, private keys, or other secrets in memory."
      )
    };
  } else if (written.memoryResult?.confirmationRequired && written.memoryResult.memory) {
    const pending = await createPendingAction({
      userId: input.userId,
      assistantId: input.assistantId,
      sourceMessageId: written.userMessage.id,
      actionType: "confirm_memory",
      payload: { memory_id: written.memoryResult.memory.id }
    });
    outcome = {
      content: confirmationContent({
        title: "Remember this preference?",
        detail: written.memoryResult.memory.value.text,
        pending,
        confirmLabel: "Remember",
        cancelLabel: "Not now"
      }),
      pendingAction: publicPendingAction(pending)
    };
  } else if (written.memoryResult?.memory?.status === "confirmed") {
    outcome = {
      content: plainText(`I’ll remember: ${written.memoryResult.memory.value.text}.`)
    };
  } else {
    outcome = await executeRoute({
      route,
      userId: input.userId,
      assistantId: input.assistantId,
      sourceMessageId: written.userMessage.id,
      text: currentInstruction,
      attachments,
      kernel
    });
  }

  const assistantMessage = await writeAssistantReply({
    userId: input.userId,
    assistantId: input.assistantId,
    content: outcome.content,
    sourceRefs: outcome.sourceRefs ?? []
  });
  await publishMessageEvents(input.userId, [written.userMessage, assistantMessage]);
  return {
    message: written.userMessage,
    agent_message: assistantMessage,
    assistant_message: assistantMessage,
    messages: [written.userMessage, assistantMessage],
    ...(outcome.agent ? { agent: outcome.agent } : {}),
    ...(outcome.sourceRefs?.length
      ? { source_references: outcome.sourceRefs }
      : {}),
    ...(outcome.pendingAction
      ? { pending_action: outcome.pendingAction }
      : {}),
    ...(attachments.length
      ? { attachments: attachmentMetadata(attachments) }
      : {}),
    ...(outcome.job ? { job: outcome.job } : {})
  };
}

type AssistantOutcome = {
  content: Record<string, unknown>;
  sourceRefs?: unknown[];
  pendingAction?: Record<string, unknown>;
  agent?: ManagedAgent;
  job?: { id: string | undefined; name: string };
};

async function executeRoute(input: {
  route: Exclude<AssistantRoute, { kind: "confirm" }>;
  userId: string;
  assistantId: string;
  sourceMessageId: string;
  text: string;
  attachments: AnalyzedAttachment[];
  kernel: Awaited<ReturnType<typeof assembleAssistantKernel>>;
}): Promise<AssistantOutcome> {
  const { route } = input;
  if (route.kind === "memory_list") {
    const [memories, compacted] = await Promise.all([
      listConfirmedMemories(input.userId),
      getCompactedMemoryDigest(input.userId)
    ]);
    const lines = [
      ...memories.map((memory) => `- ${memory.value.text}`),
      ...(compacted ? ["Compacted memory:", compacted.summary] : [])
    ];
    return {
      content: plainText(
        lines.length === 0
          ? "I don’t have any confirmed or compacted memories about you."
          : ["Here’s what I remember:", ...lines].join("\n")
      )
    };
  }
  if (route.kind === "memory_forget") {
    if (route.all) {
      const pending = await createPendingAction({
        userId: input.userId,
        assistantId: input.assistantId,
        sourceMessageId: input.sourceMessageId,
        actionType: "forget_everything",
        payload: {}
      });
      return {
        content: confirmationContent({
          title: "Forget everything?",
          detail: "This permanently deletes every active and compacted Assistant memory. Your agent contacts are not affected.",
          pending,
          confirmLabel: "Delete all memories",
          cancelLabel: "Cancel"
        }),
        pendingAction: publicPendingAction(pending)
      };
    }
    const count = await forgetMemoriesMatching(input.userId, route.target);
    return {
      content: plainText(
        count > 0
          ? `Forgot ${count === 1 ? "that memory" : `${count} matching memories`}.`
          : "I couldn’t find an active or compacted memory matching that."
      )
    };
  }
  if (route.kind === "agent_list") {
    const agents = await listManagedAgents(input.userId);
    if (route.target) {
      const resolution = await resolveAgentTarget(input.userId, route.target);
      if (resolution.kind === "not_found") {
        return { content: plainText(`I couldn’t find an agent named “${route.target}”.`) };
      }
      if (resolution.kind === "ambiguous") {
        return {
          content: plainText(
            `That name matches multiple agents: ${resolution.matches.map((agent) => agent.name).join(", ")}. Use the exact name.`
          )
        };
      }
      const agent = resolution.agent;
      return {
        content: plainText(
          `${agent.name} is ${agent.status}${agent.schedule_cron ? ` and runs ${describeSchedule(agent.schedule_cron)}` : " with manual runs"}.`
        )
      };
    }
    if (route.countOnly) {
      return {
        content: plainText(
          `You have created ${agents.length} specialist ${agents.length === 1 ? "agent" : "agents"}.`
        )
      };
    }
    return {
      content: plainText(
        agents.length === 0
          ? "You don’t have any specialist agents yet."
          : [
              "Your agents:",
              ...agents.map((agent) =>
                `- ${agent.name} — ${agent.status}${agent.schedule_cron ? `, ${describeSchedule(agent.schedule_cron)}` : ", manual"}`
              )
            ].join("\n")
      )
    };
  }
  if (
    route.kind === "agent_manage" ||
    route.kind === "agent_rename" ||
    route.kind === "agent_update"
  ) {
    if (!config.ASSISTANT_AGENT_MANAGEMENT_ENABLED) {
      return { content: plainText("Assistant agent management is not enabled yet.") };
    }
    return manageAgentRoute(input, route);
  }
  if (route.kind === "create_agent") {
    return createAgentFromAssistant(input);
  }
  if (route.kind === "connector_query") {
    if (!config.ASSISTANT_CONNECTOR_TOOLS_ENABLED) {
      return { content: plainText("Assistant connector questions are not enabled yet.") };
    }
    const result = await executeAssistantConnectorReads(
      input.userId,
      input.text,
      route.connectors
    );
    if (result.evidence.length === 0 && result.failures.length > 0) {
      return { content: connectorActionContent(result.failures) };
    }
    const answer = await createAssistantChatReply(input.text, {
      stm: input.kernel.stm,
      memories: input.kernel.ltm,
      evidence: result.evidence,
      sourceRefs: result.sourceRefs,
      attachmentEvidence: attachmentEvidence(input.attachments)
    });
    const failureNote = result.failures.length
      ? `\n\nI couldn’t read ${result.failures.map((failure) => failure.connectorName).join(", ")}; connect or reconnect it for a complete answer.`
      : "";
    const links = sourceLinks(result.sourceRefs);
    return {
      content: plainText(`${answer}${failureNote}${links ? `\n\n### Sources\n${links}` : ""}`),
      sourceRefs: result.sourceRefs
    };
  }

  if (route.kind === "chat" && config.ASSISTANT_CONNECTOR_TOOLS_ENABLED) {
    const classifiedConnectors = await classifyAmbiguousConnectorQuery(input.text);
    if (classifiedConnectors.length > 0) {
      return executeRoute({
        ...input,
        route: { kind: "connector_query", connectors: classifiedConnectors }
      });
    }
  }

  if (
    input.attachments.length > 0 &&
    input.attachments.every((file) => file.analysisStatus !== "complete")
  ) {
    return {
      content: plainText(
        "I kept your message, but I couldn’t analyze the attached file(s). Please try a supported JPEG, PNG, WebP, PDF, TXT, Markdown, CSV, or JSON file."
      )
    };
  }
  const briefing = await latestBriefing(input.userId, input.assistantId);
  const reply = await createAssistantChatReply(input.text, {
    stm: input.kernel.stm,
    memories: input.kernel.ltm,
    ...(briefing ?? {}),
    attachmentEvidence: attachmentEvidence(input.attachments)
  });
  return { content: plainText(reply), sourceRefs: briefing?.sourceRefs ?? [] };
}

function sourceLinks(sourceRefs: unknown[]): string {
  const seen = new Set<string>();
  const links: string[] = [];
  for (const source of sourceRefs) {
    if (!source || typeof source !== "object") continue;
    const ref = source as Record<string, unknown>;
    const url = typeof ref.url === "string" ? ref.url : "";
    if (!url || seen.has(url) || !/^https?:\/\//i.test(url)) continue;
    seen.add(url);
    const label = [ref.label, ref.name, ref.title, ref.subject, ref.source]
      .find((value) => typeof value === "string" && value.trim())?.toString() ?? "Open source";
    links.push(`- [${label.replace(/[\[\]]/g, "").slice(0, 160)}](${url})`);
    if (links.length >= 6) break;
  }
  return links.join("\n");
}

async function manageAgentRoute(
  input: Parameters<typeof executeRoute>[0],
  route: Extract<AssistantRoute, { kind: "agent_manage" | "agent_rename" | "agent_update" }>
): Promise<AssistantOutcome> {
  const resolution = await resolveAgentTarget(input.userId, route.target);
  if (resolution.kind === "not_found") {
    return { content: plainText(`I couldn’t find an agent named “${route.target}”.`) };
  }
  if (resolution.kind === "ambiguous") {
    return {
      content: plainText(
        `That name matches multiple agents: ${resolution.matches.map((agent) => agent.name).join(", ")}. Use the exact name.`
      )
    };
  }
  const target = resolution.agent;
  try {
    if (route.kind === "agent_manage") {
      if (route.operation === "delete") {
        const pending = await createPendingAction({
          userId: input.userId,
          assistantId: input.assistantId,
          sourceMessageId: input.sourceMessageId,
          targetAgentId: target.id,
          actionType: "delete_agent",
          payload: { target_name: target.name }
        });
        await auditAction(input, target.id, "delete", "confirmation_required");
        return {
          content: confirmationContent({
            title: `Delete ${target.name}?`,
            detail: "Deletion is permanent and removes the agent’s thread and schedule.",
            pending,
            confirmLabel: "Delete agent",
            cancelLabel: "Cancel"
          }),
          pendingAction: publicPendingAction(pending)
        };
      }
      if (route.operation === "run") {
        const { job } = await runManagedAgent(input.userId, target.id);
        await auditAction(input, target.id, "run", "queued", { job_id: job.id });
        return {
          content: plainText(
            `Queued ${target.name}. Its result will appear in that agent’s thread.`
          ),
          agent: target,
          job: { id: job.id, name: job.name }
        };
      }
      const status = route.operation === "pause" ? "paused" : "active";
      const agent = await setManagedAgentStatus(input.userId, target.id, status);
      await auditAction(input, target.id, route.operation, "applied");
      return {
        content: plainText(
          status === "paused"
            ? `Paused ${agent.name}. It won’t run until you resume it.`
            : `Resumed ${agent.name}. It is active again.`
        ),
        agent
      };
    }
    if (route.kind === "agent_rename") {
      const agent = await renameManagedAgent(input.userId, target.id, route.name);
      await auditAction(input, target.id, "rename", "applied", { name: agent.name });
      return { content: plainText(`Renamed ${target.name} to ${agent.name}.`), agent };
    }
    const agent = await updateManagedAgentDescription(
      input.userId,
      target.id,
      route.description
    );
    await auditAction(input, target.id, "update", "applied");
    return {
      content: plainText(`Updated ${agent.name}’s functionality and schedule.`),
      agent
    };
  } catch (error) {
    if (error instanceof AgentServiceError) {
      await auditAction(input, target.id, route.kind, "rejected", {
        code: error.code
      });
      return { content: plainText(error.message) };
    }
    throw error;
  }
}

async function createAgentFromAssistant(
  input: Parameters<typeof executeRoute>[0]
): Promise<AssistantOutcome> {
  const parsedIntent = await parseIntentHybrid(input.text);
  if (parsedIntent.unsupported_connector) {
    return {
      content: plainText(
        `I can’t create that yet because ${parsedIntent.unsupported_connector} is not supported. I can use Gmail, Calendar, Drive, GitHub, Slack, Notion, or web search.`
      )
    };
  }
  const client = await pool.connect();
  let agent: ManagedAgent;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<ManagedAgent>(
      `INSERT INTO agents
        (user_id, name, avatar, prompt, parsed_intent, connector_ids,
         schedule_cron, is_assistant, status, safety_level, last_message_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, 'active', $8, NOW())
       RETURNING *`,
      [
        input.userId,
        parsedIntent.name,
        parsedIntent.avatar,
        input.text,
        JSON.stringify(parsedIntent),
        parsedIntent.connector_ids,
        parsedIntent.schedule_cron,
        parsedIntent.safety_level
      ]
    );
    agent = rows[0]!;
    const githubConnected = !parsedIntent.connector_ids.includes("github") ||
      await hasUsableGitHubToken(input.userId);
    const created = agentCreationThreadMessage({
      parsedIntent,
      githubConnected,
      readyDetail: agentCreationReadyDetail(parsedIntent, describeSchedule)
    });
    await insertMessage(client, {
      agentId: agent.id,
      userId: input.userId,
      role: created.role,
      content: created.content
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await syncAgentScheduleForUser(agent, input.userId);
  await publishRealtimeEvent({
    type: "agent.created",
    user_id: input.userId,
    agent_id: agent.id,
    data: { name: agent.name }
  });
  return {
    content: plainText([
      `${agent.name} is ready.`,
      agentCreationReadyDetail(parsedIntent, describeSchedule),
      "I created it as a new contact in your inbox."
    ].join("\n")),
    agent
  };
}

async function handlePendingDecision(
  userId: string,
  assistantId: string,
  decision: "confirm" | "cancel",
  expectedId?: string
): Promise<AssistantOutcome> {
  const client = await pool.connect();
  let pending: PendingAction | null = null;
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<PendingAction>(
      `UPDATE assistant_pending_actions
       SET consumed_at = NOW()
       WHERE id = COALESCE($3::uuid, (
         SELECT id FROM assistant_pending_actions
         WHERE user_id = $1 AND assistant_id = $2
           AND consumed_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1
       ))
         AND user_id = $1 AND assistant_id = $2
         AND consumed_at IS NULL AND expires_at > NOW()
       RETURNING *`,
      [userId, assistantId, expectedId ?? null]
    );
    pending = rows[0] ?? null;
    if (pending?.action_type === "confirm_memory") {
      const memoryId = pending.payload.memory_id?.toString();
      if (memoryId) {
        await setMemoryStatus(
          client,
          userId,
          memoryId,
          decision === "confirm" ? "confirmed" : "dismissed"
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  if (!pending) {
    return { content: plainText("That confirmation expired or was already used.") };
  }
  if (decision === "cancel") {
    return { content: plainText("Cancelled. Nothing was changed.") };
  }
  if (pending.action_type === "confirm_memory") {
    return { content: plainText("Got it. I’ll remember that.") };
  }
  if (pending.action_type === "forget_everything") {
    const count = await deleteAllMemories(userId);
    return { content: plainText(`Deleted ${count} Assistant ${count === 1 ? "memory" : "memories"}.`) };
  }
  if (pending.action_type === "delete_agent" && pending.target_agent_id) {
    try {
      const deleted = await deleteManagedAgent(userId, pending.target_agent_id);
      await auditAction(
        { userId, assistantId, sourceMessageId: pending.source_message_id ?? "" },
        deleted.id,
        "delete",
        "applied"
      );
      return { content: plainText(`Deleted ${deleted.name}.`) };
    } catch (error) {
      return {
        content: plainText(
          error instanceof AgentServiceError ? error.message : "I couldn’t delete that agent."
        )
      };
    }
  }
  return { content: plainText("Confirmed.") };
}

async function loadAndAnalyzeAttachments(
  userId: string,
  attachmentIds: string[]
): Promise<AnalyzedAttachment[]> {
  if (attachmentIds.length === 0) return [];
  const client = await pool.connect();
  try {
    const files = await loadOwnedAttachments(client, userId, attachmentIds);
    return analyzeAttachments(files);
  } finally {
    client.release();
  }
}

async function writeUserTurn(input: {
  userId: string;
  assistantId: string;
  text: string;
  action?: string;
  payload?: Record<string, unknown>;
  attachments: AnalyzedAttachment[];
}): Promise<{
  userMessage: AssistantMessageRow;
  memoryResult: MemoryRecordResult | null;
}> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const content = input.action && !input.text
      ? plainText(
          /cancel/i.test(input.action) ? "Cancel" : "Confirm"
        )
      : plainText(input.text, attachmentMetadata(input.attachments));
    const userMessage = await insertMessage(client, {
      agentId: input.assistantId,
      userId: input.userId,
      role: "user",
      content,
      readAtNow: true
    });
    await storeMessageAttachments(client, {
      messageId: userMessage.id,
      userId: input.userId,
      attachments: input.attachments
    });
    let memoryResult: MemoryRecordResult | null = null;
    if (config.ASSISTANT_MEMORY_ENABLED && input.text) {
      const observation = extractMemoryObservation(input.text);
      if (observation) {
        memoryResult = await recordMemoryObservation(client, {
          userId: input.userId,
          sourceMessageId: userMessage.id,
          observation
        });
      } else if (
        /^(?:please\s+)?(?:remember|(?:i\s+)?prefer|always)\b/i.test(input.text) &&
        isUnsafeMemoryText(input.text)
      ) {
        memoryResult = { memory: null, rejected: true, confirmationRequired: false };
      }
    }
    await client.query(
      "UPDATE agents SET last_message_at = NOW() WHERE id = $1 AND user_id = $2",
      [input.assistantId, input.userId]
    );
    await client.query("COMMIT");
    return { userMessage, memoryResult };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function writeAssistantReply(input: {
  userId: string;
  assistantId: string;
  content: Record<string, unknown>;
  sourceRefs: unknown[];
}): Promise<AssistantMessageRow> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const message = await insertMessage(client, {
      agentId: input.assistantId,
      userId: input.userId,
      role: "agent",
      content: input.content,
      sourceRefs: input.sourceRefs
    });
    await client.query(
      "UPDATE agents SET last_message_at = NOW() WHERE id = $1 AND user_id = $2",
      [input.assistantId, input.userId]
    );
    await client.query("COMMIT");
    return message;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function insertMessage(
  client: PoolClient,
  input: {
    agentId: string;
    userId: string;
    role: "agent" | "user" | "system";
    content: Record<string, unknown>;
    sourceRefs?: unknown[];
    readAtNow?: boolean;
  }
): Promise<AssistantMessageRow> {
  const { rows } = await client.query<AssistantMessageRow>(
    `INSERT INTO agent_messages
      (agent_id, user_id, role, content, source_refs, read_at)
     VALUES ($1, $2, $3, $4, $5, ${input.readAtNow ? "NOW()" : "NULL"})
     RETURNING id, agent_id, user_id, role, content,
               COALESCE(source_refs, '[]'::jsonb) AS source_refs,
               read_at, created_at`,
    [
      input.agentId,
      input.userId,
      input.role,
      JSON.stringify(input.content),
      JSON.stringify(input.sourceRefs ?? [])
    ]
  );
  return rows[0]!;
}

async function activePendingAction(
  userId: string,
  assistantId: string
): Promise<PendingAction | null> {
  const { rows } = await pool.query<PendingAction>(
    `SELECT * FROM assistant_pending_actions
     WHERE user_id = $1 AND assistant_id = $2
       AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId, assistantId]
  );
  return rows[0] ?? null;
}

async function createPendingAction(input: {
  userId: string;
  assistantId: string;
  sourceMessageId: string;
  targetAgentId?: string;
  actionType: PendingAction["action_type"];
  payload: Record<string, unknown>;
}): Promise<PendingAction> {
  await pool.query(
    `UPDATE assistant_pending_actions SET consumed_at = NOW()
     WHERE user_id = $1 AND assistant_id = $2 AND consumed_at IS NULL`,
    [input.userId, input.assistantId]
  );
  const { rows } = await pool.query<PendingAction>(
    `INSERT INTO assistant_pending_actions
      (user_id, assistant_id, target_agent_id, source_message_id,
       action_type, payload, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '10 minutes')
     RETURNING *`,
    [
      input.userId,
      input.assistantId,
      input.targetAgentId ?? null,
      input.sourceMessageId,
      input.actionType,
      JSON.stringify(input.payload)
    ]
  );
  return rows[0]!;
}

function confirmationContent(input: {
  title: string;
  detail: string;
  pending: PendingAction;
  confirmLabel: string;
  cancelLabel: string;
}) {
  return {
    template: "daily_task",
    version: "1.0",
    data: {
      title: input.title,
      task: input.detail,
      context: "This confirmation expires in 10 minutes and can be used once.",
      actions: [
        {
          id: "assistant_confirm",
          type: "assistant_pending_action",
          decision: "confirm",
          pending_action_id: input.pending.id,
          label: input.confirmLabel,
          style: "primary"
        },
        {
          id: "assistant_cancel",
          type: "assistant_pending_action",
          decision: "cancel",
          pending_action_id: input.pending.id,
          label: input.cancelLabel,
          style: "secondary"
        }
      ]
    }
  };
}

function publicPendingAction(pending: PendingAction): Record<string, unknown> {
  return {
    id: pending.id,
    action_type: pending.action_type,
    target_agent_id: pending.target_agent_id,
    expires_at: pending.expires_at
  };
}

function plainText(body: string, attachments?: unknown[]) {
  return {
    template: "plain_text",
    version: "1.0",
    data: {
      body,
      ...(attachments?.length ? { attachments } : {})
    }
  };
}

function actionRoute(action: string, _hasPending: boolean): AssistantRoute {
  if (/^(?:confirm|assistant_confirm)$/i.test(action)) {
    return { kind: "confirm", decision: "confirm" };
  }
  if (/^(?:cancel|assistant_cancel)$/i.test(action)) {
    return { kind: "confirm", decision: "cancel" };
  }
  return { kind: "chat" };
}

async function latestBriefing(
  userId: string,
  assistantId: string
): Promise<{ briefing: string; sourceRefs: unknown[] } | null> {
  const { rows } = await pool.query<{
    briefing_context: Record<string, unknown>;
    source_refs: unknown[];
  }>(
    `SELECT CASE
       WHEN content->'data'->'briefing_context' IS NOT NULL
         THEN content->'data'->'briefing_context'
       ELSE content
     END AS briefing_context,
     COALESCE(source_refs, '[]'::jsonb) AS source_refs
     FROM agent_messages
     WHERE user_id = $1 AND agent_id = $2
       AND ($4::boolean = FALSE OR created_at > NOW() - ($3::int * INTERVAL '1 day'))
       AND (content->'data'->'briefing_context' IS NOT NULL OR
         (content->>'template' = 'briefing_card' AND
          content #>> '{data,assistant_context}' = 'true'))
     ORDER BY created_at DESC LIMIT 1`,
    [userId, assistantId, config.MESSAGE_RETENTION_DAYS, config.MESSAGE_RETENTION_ENABLED]
  );
  return rows[0]
    ? { briefing: JSON.stringify(rows[0].briefing_context), sourceRefs: rows[0].source_refs }
    : null;
}

async function auditAction(
  input: {
    userId: string;
    assistantId: string;
    sourceMessageId: string;
  },
  targetAgentId: string,
  action: string,
  status: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO assistant_agent_action_audits
      (user_id, assistant_id, target_agent_id, source_message_id,
       action, status, detail)
     VALUES ($1, $2, $3, NULLIF($4, '')::uuid, $5, $6, $7)`,
    [
      input.userId,
      input.assistantId,
      targetAgentId,
      input.sourceMessageId,
      action,
      status,
      JSON.stringify(detail)
    ]
  );
}

async function publishMessageEvents(
  userId: string,
  messages: AssistantMessageRow[]
): Promise<void> {
  for (const message of messages) {
    await publishRealtimeEvent({
      type: "message.created",
      user_id: userId,
      agent_id: message.agent_id,
      message_id: message.id,
      data: { role: message.role, created_at: message.created_at }
    });
  }
}

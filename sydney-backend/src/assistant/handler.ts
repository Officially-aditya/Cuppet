import type { PoolClient } from "pg";
import { isUuid } from "../api/ids.js";
import { publicMessage } from "../api/public-errors.js";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import { createAssistantChatReply } from "../agents/assistant-chat.js";
import { createAgentChatReply } from "../agents/agent-chat.js";
import {
  AgentServiceError,
  deleteManagedAgent,
  getManagedAgent,
  listManagedAgents,
  renameManagedAgent,
  resolveAgentTarget,
  runManagedAgent,
  setManagedAgentStatus,
  updateManagedAgentDescription,
  type ManagedAgent
} from "../agents/agent-service.js";
import { isContextualAgentTarget } from "../agents/agent-target.js";
import { parseIntentHybrid } from "../agents/llm-intent.js";
import type { ParsedIntent } from "../agents/parser.js";
import { describeSchedule } from "../agents/message-router.js";
import type { AgentMessageContent } from "../agents/output.js";
import { mergeAgentMessageContents } from "../agents/runtime/message-parts.js";
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
  connectorActionContent,
  executeAssistantConnectorReads
} from "./connector-tools.js";
import { classifyAssistantIntent } from "./intent-classifier.js";
import {
  assistantActionSummary,
  confirmableRouteFor,
  confirmedAssistantRoute,
  requiresActionConfirmation,
  type ConfirmableAssistantRoute
} from "./action-confirmation.js";
import {
  agentSelectionQuestion,
  selectedAgentRoute,
  selectionIntentForRoute,
  type AgentSelectionIntent
} from "./agent-selection.js";
import { routeAssistantMessage, type AssistantRoute } from "./router.js";
import { insertConfiguredAgent } from "../agents/runtime/configuration-service.js";

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
  deleted_agent_id?: string;
  attachments?: ReturnType<typeof attachmentMetadata>;
  job?: { id: string | undefined; name: string };
};

type PendingAction = {
  id: string;
  user_id: string;
  assistant_id: string;
  target_agent_id: string | null;
  source_message_id: string | null;
  action_type:
    | "delete_agent"
    | "forget_everything"
    | "confirm_memory"
    | "select_agent"
    | "confirm_intent";
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
  let route = input.action
    ? actionRoute(input.action, input.payload, Boolean(activePending))
    : routeAssistantMessage(currentInstruction, {
        hasPendingAction: Boolean(activePending)
      });
  let confirmClassifiedAgentTarget = false;
  let confirmLowConfidenceAction = false;
  if (!input.action && text && route.kind === "chat") {
    const classified = await classifyAssistantIntent(text, {
      hasPendingAction: Boolean(activePending)
    });
    if (classified) {
      route = classified.route;
      confirmClassifiedAgentTarget = selectionIntentForRoute(route) !== null;
      confirmLowConfidenceAction = requiresActionConfirmation(
        route,
        classified.confidence
      );
    }
  }
  const kernel = await assembleAssistantKernel(
    input.userId,
    input.assistantId
  );

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
    outcome = await handlePendingDecision({
      userId: input.userId,
      assistantId: input.assistantId,
      decision: route.decision,
      expectedId: input.payload?.pending_action_id?.toString(),
      sourceMessageId: written.userMessage.id,
      text: currentInstruction,
      attachments,
      kernel
    });
  } else if (route.kind === "agent_selection") {
    outcome = await handleAgentSelection({
      route,
      userId: input.userId,
      assistantId: input.assistantId,
      sourceMessageId: written.userMessage.id,
      text: currentInstruction,
      attachments,
      kernel
    });
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
      kernel,
      confirmAgentTarget: confirmClassifiedAgentTarget,
      confirmLowConfidenceAction
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
    ...(outcome.deletedAgentId
      ? { deleted_agent_id: outcome.deletedAgentId }
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
  deletedAgentId?: string;
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
  confirmAgentTarget?: boolean;
  confirmLowConfidenceAction?: boolean;
}): Promise<AssistantOutcome> {
  const { route } = input;
  if (input.confirmAgentTarget) {
    const intent = selectionIntentForRoute(route);
    if (intent) {
      return createAgentSelection(input, route, intent);
    }
  }
  if (input.confirmLowConfidenceAction) {
    const confirmedRoute = confirmableRouteFor(route);
    if (confirmedRoute) {
      return createLowConfidenceActionConfirmation(input, confirmedRoute);
    }
  }
  if (route.kind === "clarify") {
    const prompts = {
      agent:
        "Tell me which agent you mean and whether you want to list, inspect, run, pause, resume, rename, update, or delete it.",
      memory:
        "Tell me whether you want to review memories, forget a specific detail, or forget everything.",
      connector:
        "Tell me which connected service and what private information you want me to read."
    } as const;
    return { content: plainText(prompts[route.subject]) };
  }
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
      const resolution = await resolveAssistantAgentTarget(input, route.target);
      if (resolution.kind === "not_found") {
        if (isContextualAgentTarget(route.target)) {
          return createAgentSelection(input, route, { kind: "agent_status" });
        }
        return { content: plainText(`I couldn’t find an agent named “${route.target}”.`) };
      }
      if (resolution.kind === "ambiguous") {
        return createAgentSelection(input, route, { kind: "agent_status" });
      }
      const agent = resolution.agent;
      return withAgentContext({
        content: plainText(
          `${agent.name} is ${agent.status}${agent.schedule_cron ? ` and runs ${describeSchedule(agent.schedule_cron)}` : " with manual runs"}.`
        )
      }, agent);
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
  if (route.kind === "agent_query") {
    return queryManagedAgentRoute(input, route);
  }
  if (
    route.kind === "agent_manage" ||
    route.kind === "agent_rename" ||
    route.kind === "agent_update"
  ) {
    return manageAgentRoute(input, route);
  }
  if (route.kind === "create_agent") {
    return createAgentFromAssistant(input);
  }
  if (route.kind === "connector_query") {
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

async function createLowConfidenceActionConfirmation(
  input: Parameters<typeof executeRoute>[0],
  route: ConfirmableAssistantRoute
): Promise<AssistantOutcome> {
  const summary = assistantActionSummary(route);
  const pending = await createPendingAction({
    userId: input.userId,
    assistantId: input.assistantId,
    sourceMessageId: input.sourceMessageId,
    actionType: "confirm_intent",
    payload: {
      confirmed_route: route,
      attachment_ids: input.attachments.map((attachment) => attachment.id)
    }
  });
  return {
    content: {
      template: "action_confirmation",
      version: "1.0",
      data: {
        title: "Confirm this action",
        question: "Is this what you want me to do?",
        action_label: summary.label,
        action_detail: summary.detail,
        context:
          "I’m less than 80% confident I understood your request, so nothing has run yet. This confirmation expires in 10 minutes and can be used once.",
        actions: [
          {
            id: "assistant_confirm",
            type: "assistant_pending_action",
            decision: "confirm",
            pending_action_id: pending.id,
            label: "Yes, continue",
            style: "primary"
          },
          {
            id: "assistant_cancel",
            type: "assistant_pending_action",
            decision: "cancel",
            pending_action_id: pending.id,
            label: "Cancel",
            style: "secondary"
          }
        ]
      }
    },
    pendingAction: publicPendingAction(pending)
  };
}

async function createAgentSelection(
  input: Parameters<typeof executeRoute>[0],
  route: AssistantRoute,
  intent: AgentSelectionIntent
): Promise<AssistantOutcome> {
  const agents = await listManagedAgents(input.userId);
  if (agents.length === 0) {
    return { content: plainText("You don’t have any specialist agents yet.") };
  }
  const proposedTarget = targetForAgentRoute(route);
  const resolution = proposedTarget
    ? await resolveAssistantAgentTarget(input, proposedTarget)
    : null;
  const suggested = resolution?.kind === "resolved" ? resolution.agent : null;
  const ordered = suggested
    ? [suggested, ...agents.filter((agent) => agent.id !== suggested.id)]
    : agents;
  const visible = ordered.slice(0, 8);
  const pending = await createPendingAction({
    userId: input.userId,
    assistantId: input.assistantId,
    sourceMessageId: input.sourceMessageId,
    ...(suggested ? { targetAgentId: suggested.id } : {}),
    actionType: "select_agent",
    payload: { selection_intent: intent }
  });
  return {
    content: {
      template: "agent_selection",
      version: "1.0",
      data: {
        title: "Confirm the agent",
        question: agentSelectionQuestion(intent),
        context: input.confirmLowConfidenceAction
          ? suggested
            ? `I’m less than 80% confident I understood the action. I matched it to ${suggested.name}; confirm that agent or choose another.`
            : "I’m less than 80% confident I understood the action and couldn’t identify one exact agent. Choose an agent below."
          : suggested
            ? `I matched your request to ${suggested.name}. Confirm it or choose another agent.`
            : "I couldn’t safely identify one exact agent. Choose from your agents below.",
        pending_action_id: pending.id,
        suggested_agent_id: suggested?.id ?? null,
        options: visible.map((agent) => ({
          id: agent.id,
          name: agent.name,
          detail: agent.schedule_cron
            ? `${agent.status} · ${describeSchedule(agent.schedule_cron)}`
            : `${agent.status} · manual runs`
        })),
        truncated: agents.length > visible.length,
        cancel_action: {
          id: "assistant_cancel",
          type: "assistant_pending_action",
          decision: "cancel",
          pending_action_id: pending.id,
          label: "Cancel"
        }
      }
    },
    pendingAction: publicPendingAction(pending)
  };
}

async function handleAgentSelection(
  input: Parameters<typeof executeRoute>[0] & {
    route: Extract<AssistantRoute, { kind: "agent_selection" }>;
  }
): Promise<AssistantOutcome> {
  if (
    !isUuid(input.route.pendingActionId) ||
    !isUuid(input.route.selectedAgentId)
  ) {
    return { content: plainText("That agent selection is invalid.") };
  }
  const agents = await listManagedAgents(input.userId);
  const selected = agents.find(
    (agent) => agent.id === input.route.selectedAgentId
  );
  if (!selected) {
    return { content: plainText("That agent is no longer available.") };
  }
  const { rows } = await pool.query<PendingAction>(
    `UPDATE assistant_pending_actions
     SET consumed_at = NOW(),
         target_agent_id = $4,
         payload = payload || jsonb_build_object('selected_agent_id', $5::text)
     WHERE id = $1 AND user_id = $2 AND assistant_id = $3
       AND action_type = 'select_agent'
       AND consumed_at IS NULL AND expires_at > NOW()
     RETURNING *`,
    [
      input.route.pendingActionId,
      input.userId,
      input.assistantId,
      selected.id,
      selected.id
    ]
  );
  const pending = rows[0];
  if (!pending) {
    return {
      content: plainText("That agent selection expired or was already used.")
    };
  }
  await resolveAgentSelectionCard(pending, {
    resolution: "selected",
    selectedAgentId: selected.id,
    selectedAgentName: selected.name
  }).catch((error) => {
    console.error("Failed to persist resolved agent selection card:", error);
  });
  const resumedRoute = selectedAgentRoute(
    pending.payload.selection_intent,
    selected.name
  );
  if (!resumedRoute) {
    return { content: plainText("That agent request could not be resumed safely.") };
  }
  if (resumedRoute.kind === "agent_list") {
    return withAgentContext(
      { content: plainText(agentStatusText(selected)) },
      selected
    );
  }
  if (resumedRoute.kind === "agent_query") {
    const originalText = await pendingSourceText(pending, input.text);
    return queryManagedAgentRoute(
      { ...input, text: originalText },
      resumedRoute,
      selected
    );
  }
  if (
    resumedRoute.kind !== "agent_manage" &&
    resumedRoute.kind !== "agent_rename" &&
    resumedRoute.kind !== "agent_update"
  ) {
    return { content: plainText("That agent request could not be resumed safely.") };
  }
  const outcome = await applyManagedAgentRoute(input, resumedRoute, selected);
  return withAgentContext(outcome, selected);
}

function targetForAgentRoute(route: AssistantRoute): string | null {
  if (
    route.kind === "agent_list" ||
    route.kind === "agent_manage" ||
    route.kind === "agent_rename" ||
    route.kind === "agent_update" ||
    route.kind === "agent_query"
  ) {
    return route.target ?? null;
  }
  return null;
}

function agentStatusText(agent: ManagedAgent): string {
  return `${agent.name} is ${agent.status}${agent.schedule_cron ? ` and runs ${describeSchedule(agent.schedule_cron)}` : " with manual runs"}.`;
}

async function resolveAssistantAgentTarget(
  input: Pick<Parameters<typeof executeRoute>[0], "userId" | "assistantId">,
  target: string
): Promise<Awaited<ReturnType<typeof resolveAgentTarget>>> {
  if (!isContextualAgentTarget(target)) {
    return resolveAgentTarget(input.userId, target);
  }
  const recent = await recentReferencedAgent(input.userId, input.assistantId);
  return recent
    ? { kind: "resolved", agent: recent }
    : { kind: "not_found", matches: [] };
}

async function recentReferencedAgent(
  userId: string,
  assistantId: string
): Promise<ManagedAgent | null> {
  const { rows } = await pool.query<{ agent_id: string }>(
    `SELECT reference.value->>'agent_id' AS agent_id
     FROM agent_messages message
     CROSS JOIN LATERAL jsonb_array_elements(
       COALESCE(message.source_refs, '[]'::jsonb)
     ) AS reference(value)
     WHERE message.user_id = $1
       AND message.agent_id = $2
       AND message.role = 'agent'
       AND message.created_at > NOW() - ($3::int * INTERVAL '1 day')
       AND reference.value->>'type' = 'cuppet_agent_context'
       AND reference.value->>'agent_id' IS NOT NULL
     ORDER BY message.created_at DESC
     LIMIT 1`,
    [userId, assistantId, config.MESSAGE_RETENTION_DAYS]
  );
  const agentId = rows[0]?.agent_id;
  return agentId ? getManagedAgent(userId, agentId) : null;
}

async function queryManagedAgentRoute(
  input: Parameters<typeof executeRoute>[0],
  route: Extract<AssistantRoute, { kind: "agent_query" }>,
  selectedAgent?: ManagedAgent
): Promise<AssistantOutcome> {
  let target = selectedAgent ?? null;
  if (!target && route.target) {
    const resolution = await resolveAssistantAgentTarget(input, route.target);
    if (resolution.kind === "resolved") {
      target = resolution.agent;
    } else {
      return createAgentSelection(input, route, { kind: "agent_query" });
    }
  }
  if (!target) {
    target = await recentReferencedAgent(input.userId, input.assistantId);
  }
  if (!target) {
    return createAgentSelection(input, route, { kind: "agent_query" });
  }

  const latest = await latestManagedAgentOutput(
    input.userId,
    target.id
  );
  if (!latest) {
    return withAgentContext(
      {
        content: plainText(
          `${target.name} has no available output yet. Run it once, then ask me about the result.`
        )
      },
      target
    );
  }
  const parsedIntent = typeof target.parsed_intent === "string"
    ? JSON.parse(target.parsed_intent)
    : target.parsed_intent;
  const reply = await createAgentChatReply({
    userId: input.userId,
    agent: {
      name: target.name,
      prompt: target.prompt,
      parsed_intent: parsedIntent
    },
    latestAgentOutput: agentOutputText(latest.content),
    sourceRefs: latest.source_refs,
    recentUserMessages: [],
    userText: input.text
  });
  return withAgentContext(
    {
      content: plainText(reply),
      sourceRefs: latest.source_refs
    },
    target
  );
}

async function latestManagedAgentOutput(
  userId: string,
  agentId: string
): Promise<{ content: unknown; source_refs: unknown[] } | null> {
  const { rows } = await pool.query<{
    content: unknown;
    source_refs: unknown[];
  }>(
    `WITH selected AS (
       SELECT id, content, created_at
       FROM agent_messages
       WHERE user_id = $1
         AND agent_id = $2
         AND role = 'agent'
         AND created_at > NOW() - ($3::int * INTERVAL '1 day')
       ORDER BY created_at DESC
       LIMIT 1
     )
     SELECT message.content,
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
       message.created_at ASC`,
    [userId, agentId, config.MESSAGE_RETENTION_DAYS]
  );
  if (rows.length === 0) return null;
  const content = mergeAgentMessageContents(
    rows.map((row) => row.content as AgentMessageContent)
  );
  if (!content) return null;
  const seen = new Set<string>();
  const sourceRefs: unknown[] = [];
  for (const row of rows) {
    for (const reference of Array.isArray(row.source_refs)
      ? row.source_refs
      : []) {
      const key = JSON.stringify(reference);
      if (seen.has(key)) continue;
      seen.add(key);
      sourceRefs.push(reference);
    }
  }
  return { content, source_refs: sourceRefs };
}

function agentOutputText(content: unknown): string {
  if (typeof content === "string") {
    try {
      return agentOutputText(JSON.parse(content));
    } catch {
      return content.slice(0, 12_000);
    }
  }
  if (!content || typeof content !== "object") return "";
  const record = content as Record<string, unknown>;
  const data = record.data;
  if (!data || typeof data !== "object") {
    return JSON.stringify(record).slice(0, 12_000);
  }
  const fields = data as Record<string, unknown>;
  const body = [fields.body, fields.text, fields.summary]
    .find((value) => typeof value === "string");
  return typeof body === "string"
    ? body.slice(0, 12_000)
    : JSON.stringify(fields).slice(0, 12_000);
}

function withAgentContext(
  outcome: AssistantOutcome,
  agent: Pick<ManagedAgent, "id" | "name">
): AssistantOutcome {
  const contextReference = {
    type: "cuppet_agent_context",
    source: "Cuppet",
    id: agent.id,
    agent_id: agent.id,
    name: agent.name
  };
  return {
    ...outcome,
    sourceRefs: [
      contextReference,
      ...(outcome.sourceRefs ?? []).filter((reference) => {
        if (!reference || typeof reference !== "object") return true;
        const value = reference as Record<string, unknown>;
        return !(
          value.type === "cuppet_agent_context" &&
          value.agent_id === agent.id
        );
      })
    ]
  };
}

async function manageAgentRoute(
  input: Parameters<typeof executeRoute>[0],
  route: Extract<AssistantRoute, { kind: "agent_manage" | "agent_rename" | "agent_update" }>
): Promise<AssistantOutcome> {
  const resolution = await resolveAssistantAgentTarget(input, route.target);
  if (resolution.kind === "not_found") {
    if (isContextualAgentTarget(route.target)) {
      const intent = selectionIntentForRoute(route);
      if (intent) return createAgentSelection(input, route, intent);
    }
    return { content: plainText(`I couldn’t find an agent named “${route.target}”.`) };
  }
  if (resolution.kind === "ambiguous") {
    const intent = selectionIntentForRoute(route);
    if (intent) return createAgentSelection(input, route, intent);
  }
  if (resolution.kind !== "resolved") {
    return { content: plainText("I couldn’t identify that agent safely.") };
  }
  const target = resolution.agent;
  const outcome = await applyManagedAgentRoute(input, route, target);
  return withAgentContext(outcome, target);
}

async function applyManagedAgentRoute(
  input: Parameters<typeof executeRoute>[0],
  route: Extract<AssistantRoute, { kind: "agent_manage" | "agent_rename" | "agent_update" }>,
  target: ManagedAgent
): Promise<AssistantOutcome> {
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
      return {
        content: plainText(
          publicMessage(error.message, error.statusCode, error.code)
        )
      };
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
    agent = await insertConfiguredAgent<ManagedAgent>(client, {
      userId: input.userId,
      name: parsedIntent.name,
      avatar: parsedIntent.avatar,
      prompt: input.text,
      parsedIntent,
      createdBy: "assistant"
    });
    const githubConnected = !parsedIntent.connector_ids.includes("github") ||
      await hasUsableGitHubToken(input.userId);
    const created = agentCreationThreadMessage({
      parsedIntent: agent.parsed_intent,
      githubConnected,
      readyDetail: agentCreationReadyDetail(
        agent.parsed_intent,
        describeSchedule
      )
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

async function handlePendingDecision(input: {
  userId: string;
  assistantId: string;
  decision: "confirm" | "cancel";
  expectedId?: string;
  sourceMessageId: string;
  text: string;
  attachments: AnalyzedAttachment[];
  kernel: Awaited<ReturnType<typeof assembleAssistantKernel>>;
}): Promise<AssistantOutcome> {
  if (input.expectedId && !isUuid(input.expectedId)) {
    return { content: plainText("That confirmation is invalid.") };
  }
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
      [input.userId, input.assistantId, input.expectedId ?? null]
    );
    pending = rows[0] ?? null;
    if (pending?.action_type === "confirm_memory") {
      const memoryId = pending.payload.memory_id?.toString();
      if (memoryId) {
        await setMemoryStatus(
          client,
          input.userId,
          memoryId,
          input.decision === "confirm" ? "confirmed" : "dismissed"
        );
      }
    }
    if (
      pending?.action_type === "select_agent" &&
      input.decision === "confirm"
    ) {
      await client.query(
        `UPDATE assistant_pending_actions SET consumed_at = NULL WHERE id = $1`,
        [pending.id]
      );
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
  if (input.decision === "cancel") {
    if (pending.action_type === "select_agent") {
      await resolveAgentSelectionCard(pending, { resolution: "cancelled" });
    }
    if (pending.action_type === "delete_agent") {
      await resolveDeleteConfirmationCard(pending, {
        resolution: "cancelled",
        resultLabel: "Deletion cancelled"
      }).catch((error) => {
        console.error("Failed to persist cancelled delete confirmation:", error);
      });
    }
    return { content: plainText("Cancelled. Nothing was changed.") };
  }
  if (pending.action_type === "confirm_memory") {
    return { content: plainText("Got it. I’ll remember that.") };
  }
  if (pending.action_type === "select_agent") {
    return {
      content: plainText("Choose an agent from the selection card so I use the right one.")
    };
  }
  if (pending.action_type === "confirm_intent") {
    const route = confirmedAssistantRoute(pending.payload.confirmed_route);
    if (!route) {
      return {
        content: plainText("That action could not be confirmed safely. Nothing was changed.")
      };
    }
    const attachmentIds = pendingAttachmentIds(
      pending.payload.attachment_ids
    );
    const [originalText, originalAttachments] = await Promise.all([
      pendingSourceText(pending, input.text),
      loadAndAnalyzeAttachments(input.userId, attachmentIds)
    ]);
    return executeRoute({
      route,
      userId: input.userId,
      assistantId: input.assistantId,
      sourceMessageId: pending.source_message_id ?? input.sourceMessageId,
      text: originalText,
      attachments: originalAttachments,
      kernel: input.kernel,
      confirmAgentTarget: false,
      confirmLowConfidenceAction: false
    });
  }
  if (pending.action_type === "forget_everything") {
    const count = await deleteAllMemories(input.userId);
    return { content: plainText(`Deleted ${count} Assistant ${count === 1 ? "memory" : "memories"}.`) };
  }
  if (pending.action_type === "delete_agent" && pending.target_agent_id) {
    try {
      const deleted = await deleteManagedAgent(
        input.userId,
        pending.target_agent_id
      );
      await resolveDeleteConfirmationCard(pending, {
        resolution: "confirmed",
        resultLabel: `Deleted ${deleted.name}`
      }).catch((error) => {
        console.error("Failed to persist completed delete confirmation:", error);
      });
      await auditAction(
        {
          userId: input.userId,
          assistantId: input.assistantId,
          sourceMessageId: pending.source_message_id ?? ""
        },
        deleted.id,
        "delete",
        "applied"
      );
      return {
        content: plainText(`Deleted ${deleted.name}.`),
        deletedAgentId: deleted.id
      };
    } catch (error) {
      await resolveDeleteConfirmationCard(pending, {
        resolution: "failed",
        resultLabel: "Deletion failed"
      }).catch((cardError) => {
        console.error("Failed to persist failed delete confirmation:", cardError);
      });
      return {
        content: plainText(
          error instanceof AgentServiceError
            ? publicMessage(error.message, error.statusCode, error.code)
            : "I couldn’t delete that agent right now. Please wait a moment and try again."
        )
      };
    }
  }
  return { content: plainText("Confirmed.") };
}

function pendingAttachmentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((id): id is string => typeof id === "string" && isUuid(id))
    .slice(0, 4);
}

async function pendingSourceText(
  pending: PendingAction,
  fallback: string
): Promise<string> {
  if (!pending.source_message_id) return fallback;
  const { rows } = await pool.query<{ body: string | null }>(
    `SELECT content #>> '{data,body}' AS body
     FROM agent_messages
     WHERE id = $1 AND user_id = $2 AND agent_id = $3
     LIMIT 1`,
    [pending.source_message_id, pending.user_id, pending.assistant_id]
  );
  const body = rows[0]?.body?.trim();
  return body || fallback;
}

async function resolveAgentSelectionCard(
  pending: PendingAction,
  result:
    | {
        resolution: "selected";
        selectedAgentId: string;
        selectedAgentName: string;
      }
    | { resolution: "cancelled" }
): Promise<void> {
  const resolvedData = {
    resolved: true,
    resolution: result.resolution,
    ...(result.resolution === "selected"
      ? {
          selected_agent_id: result.selectedAgentId,
          selected_agent_name: result.selectedAgentName
        }
      : {})
  };
  await pool.query(
    `UPDATE agent_messages
     SET content = jsonb_set(
       content,
       '{data}',
       COALESCE(content->'data', '{}'::jsonb) || $4::jsonb
     )
     WHERE user_id = $1
       AND agent_id = $2
       AND role = 'agent'
       AND content->>'template' = 'agent_selection'
       AND content #>> '{data,pending_action_id}' = $3`,
    [
      pending.user_id,
      pending.assistant_id,
      pending.id,
      JSON.stringify(resolvedData)
    ]
  );
}

async function resolveDeleteConfirmationCard(
  pending: PendingAction,
  result: {
    resolution: "confirmed" | "cancelled" | "failed";
    resultLabel: string;
  }
): Promise<void> {
  const resolvedData = {
    resolved: true,
    resolution: result.resolution,
    result_label: result.resultLabel,
    actions: []
  };
  await pool.query(
    `UPDATE agent_messages
     SET content = jsonb_set(
       content,
       '{data}',
       COALESCE(content->'data', '{}'::jsonb) || $4::jsonb
     )
     WHERE user_id = $1
       AND agent_id = $2
       AND role = 'agent'
       AND content->>'template' = 'daily_task'
       AND (
         content #>> '{data,pending_action_id}' = $3
         OR content #>> '{data,actions,0,pending_action_id}' = $3
         OR content #>> '{data,actions,1,pending_action_id}' = $3
       )`,
    [
      pending.user_id,
      pending.assistant_id,
      pending.id,
      JSON.stringify(resolvedData)
    ]
  );
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
          /cancel/i.test(input.action)
            ? "Cancel"
            : /select_agent/i.test(input.action)
              ? "Selected agent"
              : "Confirm"
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
    if (input.text) {
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
      pending_action_id: input.pending.id,
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

function actionRoute(
  action: string,
  payload: Record<string, unknown> | undefined,
  _hasPending: boolean
): AssistantRoute {
  if (/^assistant_select_agent$/i.test(action)) {
    const pendingActionId = payload?.pending_action_id?.toString() ?? "";
    const selectedAgentId = payload?.selected_agent_id?.toString() ?? "";
    return pendingActionId && selectedAgentId
      ? { kind: "agent_selection", pendingActionId, selectedAgentId }
      : { kind: "clarify", subject: "agent" };
  }
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
       AND created_at > NOW() - ($3::int * INTERVAL '1 day')
       AND (content->'data'->'briefing_context' IS NOT NULL OR
         (content->>'template' = 'briefing_card' AND
          content #>> '{data,assistant_context}' = 'true'))
     ORDER BY created_at DESC LIMIT 1`,
    [userId, assistantId, config.MESSAGE_RETENTION_DAYS]
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

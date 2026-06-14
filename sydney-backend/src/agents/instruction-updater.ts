import type { ParsedIntent } from "./parser.js";
import {
  describeSchedule,
  routeAgentMessage,
  type AgentMessageRoute,
  type AgentMessageRouterContext
} from "./message-router.js";

export type AgentMessageKind =
  | "chat"
  | "update_agent"
  | "run_now"
  | "clarification_needed"
  | "unsupported";

export type AgentInstructionPatch = {
  action?: string;
  schedule_cron?: string | null;
  status?: "active" | "paused" | "error";
};

export type AgentInstructionDecision = {
  kind: AgentMessageKind;
  status:
    | "applied"
    | "recorded"
    | "queued"
    | "rejected"
    | "clarification_needed";
  confidence: number;
  reason: string;
  reply: string;
  patch: AgentInstructionPatch;
  nextPrompt?: string;
  nextParsedIntent?: ParsedIntent;
  nextScheduleCron?: string | null;
  nextStatus?: "active" | "paused" | "error";
};

export type AgentInstructionContext = AgentMessageRouterContext;

export function decideAgentInstruction(
  agent: AgentInstructionContext,
  text: string,
  context: { lastAgentReply?: string | null; routeOverride?: AgentMessageRoute | null } = {}
): AgentInstructionDecision {
  const trimmed = text.trim();
  if (confirmsPendingRun(trimmed, context.lastAgentReply)) {
    const canRun = agent.status === "active";
    return {
      kind: "run_now",
      status: canRun ? "queued" : "rejected",
      confidence: 0.93,
      reason: canRun ? "confirmed_pending_run" : "agent_not_active",
      reply: canRun
        ? "Queued a run now. I'll add the result to this thread when it finishes."
        : "I can't run while this agent is paused or in an error state.",
      patch: {}
    };
  }

  const route = context.routeOverride ?? routeAgentMessage(agent, trimmed);

  switch (route.intent) {
    case "unsupported":
      return {
        kind: "unsupported",
        status: "rejected",
        confidence: route.confidence,
        reason: route.reason,
        reply: route.reply ?? "I can't add that connector yet.",
        patch: {}
      };

    case "run_now": {
      const canRun = agent.status === "active";
      return {
        kind: "run_now",
        status: canRun ? "queued" : "rejected",
        confidence: route.confidence,
        reason: canRun ? route.reason : "agent_not_active",
        reply: canRun
          ? "Queued a run now. I'll add the result to this thread when it finishes."
          : "I can't run while this agent is paused or in an error state.",
        patch: {}
      };
    }

    case "pause_agent":
      return statusDecision(agent, "paused", route.confidence, route.reason);

    case "resume_agent":
      return statusDecision(agent, "active", route.confidence, route.reason);

    case "change_schedule":
    case "update_instructions":
      return updateDecision(agent, trimmed, route);

    case "ask_capability":
    case "ask_schedule":
    case "connector_help":
    case "chat":
      return {
        kind: "chat",
        status: "recorded",
        confidence: route.confidence,
        reason: route.reason,
        reply: chatReply(agent, route.intent),
        patch: {}
      };

    case "delete_agent":
    case "clarification_needed":
      return clarificationDecision(
        route.reason,
        route.clarification ??
          "I am not fully sure what you want me to do. Do you want me to run this once, update it, or just answer a question?",
        route.confidence
      );
  }
}

function confirmsPendingRun(
  text: string,
  lastAgentReply: string | null | undefined
): boolean {
  if (!lastAgentReply) return false;

  const lower = text.trim().toLowerCase();
  const reply = lastAgentReply.toLowerCase();
  return (
    /\bdo you want me to run this agent once now\b/.test(reply) &&
    /^(yes|yeah|yep|sure|ok|okay|please do|go ahead|do it|run it)$/i.test(
      lower
    )
  );
}

function statusDecision(
  agent: AgentInstructionContext,
  nextStatus: "active" | "paused",
  confidence: number,
  reason: string
): AgentInstructionDecision {
  if (agent.status === nextStatus) {
    return {
      kind: "chat",
      status: "recorded",
      confidence,
      reason,
      reply:
        nextStatus === "active"
          ? "This agent is already active."
          : "This agent is already paused.",
      patch: {}
    };
  }

  return {
    kind: "update_agent",
    status: "applied",
    confidence,
    reason,
    reply:
      nextStatus === "active"
        ? "Resumed. This agent is active again."
        : "Paused. This agent will not run until you resume it.",
    patch: { status: nextStatus },
    nextPrompt: agent.prompt,
    nextParsedIntent: agent.parsed_intent,
    nextScheduleCron: agent.schedule_cron,
    nextStatus
  };
}

function updateDecision(
  agent: AgentInstructionContext,
  text: string,
  route: ReturnType<typeof routeAgentMessage>
): AgentInstructionDecision {
  const instruction = route.slots.instruction ?? "";
  const scheduleCron =
    route.slots.scheduleCron === undefined
      ? agent.schedule_cron
      : route.slots.scheduleCron;

  if (route.intent === "update_instructions" && !instruction) {
    return clarificationDecision(
      "missing_instruction_update",
      "What should I add or change for this agent?",
      route.confidence
    );
  }

  const nextParsedIntent = {
    ...agent.parsed_intent,
    action: instruction
      ? mergeAction(agent.parsed_intent, instruction)
      : agent.parsed_intent.action,
    schedule_cron: scheduleCron ?? null
  };
  const nextPrompt = instruction
    ? [agent.prompt, `User update: ${text}`].join("\n\n")
    : agent.prompt;

  return {
    kind: "update_agent",
    status: "applied",
    confidence: route.confidence,
    reason: route.reason,
    reply: updateReply(agent, instruction, scheduleCron ?? null),
    patch: {
      ...(instruction ? { action: nextParsedIntent.action } : {}),
      ...(route.slots.scheduleCron !== undefined
        ? { schedule_cron: route.slots.scheduleCron }
        : {})
    },
    nextPrompt,
    nextParsedIntent,
    nextScheduleCron: scheduleCron ?? null,
    nextStatus: agent.status
  };
}

function clarificationDecision(
  reason: string,
  reply: string,
  confidence = 0.72
): AgentInstructionDecision {
  return {
    kind: "clarification_needed",
    status: "clarification_needed",
    confidence,
    reason,
    reply,
    patch: {}
  };
}

function mergeAction(parsedIntent: ParsedIntent, instruction: string): string {
  if (parsedIntent.intent === "scheduled_reminder") {
    const existing = parsedIntent.action
      .replace(/^Reminder:\s*/i, "")
      .replace(/\.$/, "")
      .trim();
    const next = instruction
      .replace(/^send me\s+/i, "")
      .replace(/^send\s+/i, "")
      .replace(/^remind me to\s+/i, "")
      .replace(/\.$/, "")
      .trim();

    if (!existing) {
      return `Reminder: ${sentenceCase(next)}.`;
    }

    return `Reminder: ${existing} and ${next}.`;
  }

  const action = parsedIntent.action.replace(/\.$/, "").trim();
  return `${action}. Also: ${instruction.replace(/\.$/, "").trim()}.`;
}

function updateReply(
  agent: AgentInstructionContext,
  instruction: string,
  scheduleCron: string | null
): string {
  if (instruction) {
    const replyItem = instruction
      .replace(/^send me\s+/i, "")
      .replace(/^send\s+/i, "")
      .replace(/^remind me to\s+/i, "")
      .replace(/\s+going forward\.?$/i, "")
      .trim();
    const schedule = scheduleCron
      ? ` on this schedule: ${describeSchedule(scheduleCron)}`
      : "";

    if (agent.parsed_intent.intent === "scheduled_reminder") {
      return `Updated. I'll include ${replyItem}${schedule}.`;
    }

    return `Updated. I'll include ${replyItem} going forward.`;
  }

  if (scheduleCron) {
    return `Updated. I'll run ${describeSchedule(scheduleCron)}.`;
  }

  return "Updated.";
}

function chatReply(
  agent: AgentInstructionContext,
  intent: "ask_capability" | "ask_schedule" | "connector_help" | "chat"
): string {
  if (intent === "ask_capability") {
    return `I'm set up to: ${agent.parsed_intent.action}`;
  }

  if (intent === "ask_schedule") {
    return agent.schedule_cron
      ? `Current schedule: ${describeSchedule(agent.schedule_cron)}.`
      : "This agent does not have a schedule yet.";
  }

  if (intent === "connector_help") {
    const connectors = agent.parsed_intent.connector_ids;
    return connectors.length > 0
      ? `This agent needs ${connectors.join(" + ")} connected. Open Connectors to review or reconnect access.`
      : "This agent does not need a user connector.";
  }

  return "Got it. I will keep this agent unchanged.";
}

function sentenceCase(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

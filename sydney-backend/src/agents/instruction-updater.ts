import type { ParsedIntent } from "./parser.js";

export type AgentMessageKind =
  | "chat"
  | "update_agent"
  | "run_now"
  | "clarification_needed"
  | "unsupported";

export type AgentInstructionPatch = {
  action?: string;
  schedule_cron?: string | null;
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
};

export type AgentInstructionContext = {
  name: string;
  prompt: string;
  parsed_intent: ParsedIntent;
  schedule_cron: string | null;
  status: "active" | "paused" | "error";
};

const unsupportedConnectors = [
  "instagram",
  "whatsapp",
  "twitter",
  "linkedin",
  "calendar",
  "notion"
];

export function decideAgentInstruction(
  agent: AgentInstructionContext,
  text: string
): AgentInstructionDecision {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const unsupported = unsupportedConnectors.find((connector) =>
    lower.includes(connector)
  );

  if (unsupported) {
    return {
      kind: "unsupported",
      status: "rejected",
      confidence: 0.98,
      reason: "requested_unsupported_connector",
      reply: `I can't add ${unsupported} access yet. I can work with the current setup, or you can use Gmail, Slack, Drive, web search, reminders, and study-plan style agents as they become available.`,
      patch: {}
    };
  }

  if (isRunNowRequest(lower)) {
    const canRun = agent.status === "active";
    return {
      kind: "run_now",
      status: canRun ? "queued" : "rejected",
      confidence: 0.93,
      reason: canRun ? "explicit_run_now_request" : "agent_not_active",
      reply:
        canRun
          ? "Queued a run now. I'll add the result to this thread when it finishes."
          : "I can't run while this agent is paused or in an error state.",
      patch: {}
    };
  }

  const hasUpdateIntent = isUpdateRequest(agent, lower);
  const scheduleCron = scheduleOverrideFromText(trimmed);
  const actionInstruction = actionInstructionFromText(agent, trimmed, {
    hasUpdateIntent,
    hasScheduleChange: scheduleCron !== null
  });

  if (hasUpdateIntent || scheduleCron !== null) {
    if (!actionInstruction && scheduleCron === null) {
      return clarificationDecision(
        "ambiguous_update_request",
        "What should I change? Send the exact task to add, or a schedule like \"every day at 8 PM\"."
      );
    }

    if (isVagueInstruction(actionInstruction)) {
      return clarificationDecision(
        "vague_update_request",
        "I need a more specific update before I change this agent. Tell me the new task, schedule, or constraint."
      );
    }

    const nextParsedIntent = {
      ...agent.parsed_intent,
      action: actionInstruction
        ? mergeAction(agent.parsed_intent, actionInstruction)
        : agent.parsed_intent.action,
      schedule_cron: scheduleCron ?? agent.schedule_cron
    };
    const nextPrompt = [agent.prompt, `User update: ${trimmed}`].join("\n\n");

    return {
      kind: "update_agent",
      status: "applied",
      confidence: scheduleCron && !actionInstruction ? 0.9 : 0.86,
      reason: scheduleCron && !actionInstruction ? "schedule_update" : "instruction_update",
      reply: updateReply(agent, actionInstruction, scheduleCron ?? agent.schedule_cron),
      patch: {
        ...(actionInstruction ? { action: nextParsedIntent.action } : {}),
        ...(scheduleCron !== null ? { schedule_cron: scheduleCron } : {})
      },
      nextPrompt,
      nextParsedIntent,
      nextScheduleCron: scheduleCron ?? agent.schedule_cron
    };
  }

  if (looksLikeQuestion(lower) || isConversational(lower)) {
    return {
      kind: "chat",
      status: "recorded",
      confidence: 0.84,
      reason: "conversational_message",
      reply: chatReply(agent, lower),
      patch: {}
    };
  }

  return clarificationDecision(
    "message_not_clearly_chat_or_update",
    "I did not change this agent. If you want to update it, say exactly what to add or change."
  );
}

function clarificationDecision(
  reason: string,
  reply: string
): AgentInstructionDecision {
  return {
    kind: "clarification_needed",
    status: "clarification_needed",
    confidence: 0.72,
    reason,
    reply,
    patch: {}
  };
}

function isRunNowRequest(lower: string): boolean {
  return (
    /\b(run|execute|start)\s+(it|this|agent|now)\b/.test(lower) ||
    /\b(run|execute|start|check|send)\b.*\b(now|right now|immediately)\b/.test(
      lower
    )
  );
}

function isUpdateRequest(
  agent: AgentInstructionContext,
  lower: string
): boolean {
  if (
    /^(also|and|plus|along with|add|include|update|change|set|make it|have it)\b/.test(
      lower
    )
  ) {
    return true;
  }

  if (/\b(change|update|set|move)\b.*\b(schedule|time|cron|daily|weekly|monthly)\b/.test(lower)) {
    return true;
  }

  if (/\b(remind me to|send me|include|add)\b/.test(lower)) {
    return agent.parsed_intent.intent === "scheduled_reminder";
  }

  return false;
}

function looksLikeQuestion(lower: string): boolean {
  return (
    lower.endsWith("?") ||
    /^(what|why|how|when|where|who|can you|could you|do you|are you|will you)\b/.test(
      lower
    )
  );
}

function isConversational(lower: string): boolean {
  return /^(ok|okay|cool|thanks|thank you|got it|nice|great|perfect)\b/.test(lower);
}

function actionInstructionFromText(
  agent: AgentInstructionContext,
  text: string,
  context: { hasUpdateIntent: boolean; hasScheduleChange: boolean }
): string {
  if (!context.hasUpdateIntent) {
    return "";
  }

  const normalized = restoreAcronyms(
    text
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^along with (?:the )?(?:reminders?|agent),?\s*/i, "")
      .replace(/^(?:also|and|plus),?\s*/i, "")
      .replace(/^(?:please\s+)?(?:add|include)\s+/i, "")
      .replace(/^(?:change|update|set|move)\s+(?:the\s+)?(?:schedule|time)\s*(?:to)?\s*/i, "")
      .trim()
  );

  if (context.hasScheduleChange && isScheduleOnlyText(normalized)) {
    return "";
  }

  if (
    agent.parsed_intent.intent === "scheduled_reminder" &&
    /^send me\b/i.test(normalized)
  ) {
    return normalized;
  }

  return normalized;
}

function isScheduleOnlyText(value: string): boolean {
  const stripped = value
    .replace(/\b(?:at|to)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
    .replace(/\b(?:daily|every day|weekly|every week|monthly|every month|friday|morning|evening)\b/gi, "")
    .replace(/\b(?:to|at|on|schedule|time)\b/gi, "")
    .trim();

  return stripped.length === 0;
}

function isVagueInstruction(instruction: string): boolean {
  if (!instruction) return false;
  const lower = instruction.toLowerCase();
  return (
    lower.length < 4 ||
    /^(change it|update it|make it better|do more|handle more|something else)$/.test(
      lower
    )
  );
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
      .trim();
    const schedule = scheduleCron ? ` on this schedule: ${describeSchedule(scheduleCron)}` : "";

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

function chatReply(agent: AgentInstructionContext, lower: string): string {
  if (lower.includes("what") && lower.includes("do")) {
    return `I'm set up to: ${agent.parsed_intent.action}`;
  }

  if (lower.includes("schedule") || lower.includes("when")) {
    return agent.schedule_cron
      ? `Current schedule: ${describeSchedule(agent.schedule_cron)}.`
      : "This agent does not have a schedule yet.";
  }

  if (isConversational(lower)) {
    return "Got it.";
  }

  return `I did not change this agent. Current setup: ${agent.parsed_intent.action}`;
}

function scheduleOverrideFromText(text: string): string | null {
  const lower = text.toLowerCase();
  const explicitTime = lower.match(/\b(?:at|to)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
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

export function describeSchedule(cron: string): string {
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

function restoreAcronyms(value: string): string {
  return value.replace(/\bdsa\b/gi, "DSA");
}

function sentenceCase(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function formatTime(hour24: number, minute: number): string {
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

function weekdayName(day: number): string {
  return (
    [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ][day] ?? "Monday"
  );
}

function to24Hour(
  rawHour: string | undefined,
  meridiem: string | undefined
): number {
  const hour = Number(rawHour);
  if (meridiem === "am") return hour === 12 ? 0 : hour;
  if (meridiem === "pm") return hour === 12 ? 12 : hour + 12;
  return hour;
}

import type { ParsedIntent } from "./parser.js";

export type AgentMessageRouteIntent =
  | "chat"
  | "run_now"
  | "ask_capability"
  | "ask_schedule"
  | "update_instructions"
  | "change_schedule"
  | "pause_agent"
  | "resume_agent"
  | "delete_agent"
  | "connector_help"
  | "clarification_needed"
  | "unsupported";

export type AgentMessageRoute = {
  intent: AgentMessageRouteIntent;
  confidence: number;
  reason: string;
  slots: {
    instruction?: string;
    scheduleCron?: string | null;
    connectorId?: string;
    status?: "active" | "paused";
    timeRange?: "today" | "latest" | "current";
  };
  patch: {
    instruction?: string;
    schedule_cron?: string | null;
    status?: "active" | "paused";
  };
  reply?: string;
  clarification?: string;
};

export type AgentMessageRouterContext = {
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

const connectorNames = ["gmail", "email", "mail", "mailbox", "inbox", "drive", "slack"];

const runCommandWords = new Set([
  "brief",
  "check",
  "deliver",
  "do",
  "execute",
  "fetch",
  "find",
  "get",
  "give",
  "prepare",
  "read",
  "recap",
  "run",
  "scan",
  "send",
  "show",
  "start",
  "summarise",
  "summarize"
]);

const runTargetFillerWords = new Set([
  "agent",
  "again",
  "current",
  "immediate",
  "immediately",
  "latest",
  "morning",
  "now",
  "please",
  "right",
  "today",
  "tonight"
]);

const knownOutputNouns = new Set([
  "brief",
  "checklist",
  "digest",
  "email",
  "inbox",
  "item",
  "mail",
  "message",
  "news",
  "plan",
  "prompt",
  "question",
  "recap",
  "reminder",
  "report",
  "result",
  "summary",
  "task",
  "tip",
  "update",
  "word"
]);

export function routeAgentMessage(
  agent: AgentMessageRouterContext,
  text: string
): AgentMessageRoute {
  const normalized = normalizeText(text);
  const lower = normalized.toLowerCase();
  const unsupported = unsupportedConnectors.find((connector) =>
    lower.includes(connector)
  );

  if (unsupported) {
    return {
      intent: "unsupported",
      confidence: 0.98,
      reason: "requested_unsupported_connector",
      slots: { connectorId: unsupported },
      patch: {},
      reply: `I can't add ${unsupported} access yet. I can work with the current setup, or you can use Gmail, Calendar, Drive, GitHub, Slack, web search, reminders, and study-plan style agents as they become available.`
    };
  }

  const scheduleCron = scheduleOverrideFromText(normalized);

  if (asksCapability(lower)) {
    return {
      intent: "ask_capability",
      confidence: 0.94,
      reason: "asked_agent_capability",
      slots: {},
      patch: {}
    };
  }

  if (asksSchedule(lower)) {
    return {
      intent: "ask_schedule",
      confidence: 0.94,
      reason: "asked_agent_schedule",
      slots: {},
      patch: {}
    };
  }

  if (asksConnectorHelp(lower)) {
    return {
      intent: "connector_help",
      confidence: 0.88,
      reason: "asked_connector_help",
      slots: { connectorId: connectorFromText(lower) },
      patch: {}
    };
  }

  if (isPauseRequest(lower)) {
    return {
      intent: "pause_agent",
      confidence: 0.94,
      reason: "explicit_pause_request",
      slots: { status: "paused" },
      patch: { status: "paused" }
    };
  }

  if (isResumeRequest(lower)) {
    return {
      intent: "resume_agent",
      confidence: 0.94,
      reason: "explicit_resume_request",
      slots: { status: "active" },
      patch: { status: "active" }
    };
  }

  if (isDeleteRequest(lower)) {
    return {
      intent: "delete_agent",
      confidence: 0.9,
      reason: "destructive_delete_request",
      slots: {},
      patch: {},
      clarification:
        "Deleting an agent is permanent. Use the agent settings delete action so I do not remove it by accident."
    };
  }

  const explicitUpdate = isExplicitUpdateRequest(lower);
  const instruction = explicitUpdate
    ? normalizeInstruction(agent, normalized, {
        hasScheduleChange: scheduleCron !== null
      })
    : "";

  if (scheduleCron !== null && !instruction) {
    return {
      intent: "change_schedule",
      confidence: 0.9,
      reason: "schedule_update",
      slots: { scheduleCron },
      patch: { schedule_cron: scheduleCron }
    };
  }

  if (explicitUpdate) {
    if (!instruction) {
      return {
        intent: "clarification_needed",
        confidence: 0.62,
        reason: "ambiguous_update_request",
        slots: {},
        patch: {},
        clarification:
          'What should I change? Send the exact task to add, or a schedule like "every day at 8 PM".'
      };
    }

    if (isVagueInstruction(instruction)) {
      return {
        intent: "clarification_needed",
        confidence: 0.64,
        reason: "vague_update_request",
        slots: { instruction },
        patch: {},
        clarification:
          "I need a more specific update before I change this agent. Tell me the new task, schedule, or constraint."
      };
    }

    return {
      intent: "update_instructions",
      confidence: scheduleCron ? 0.9 : 0.65,
      reason: scheduleCron ? "instruction_and_schedule_update" : "instruction_update",
      slots: {
        instruction,
        ...(scheduleCron !== null ? { scheduleCron } : {})
      },
      patch: {
        instruction,
        ...(scheduleCron !== null ? { schedule_cron: scheduleCron } : {})
      }
    };
  }

  const runScore = scoreRunNow(agent, lower);
  if (runScore.confidence >= 0.82) {
    return {
      intent: "run_now",
      confidence: runScore.confidence,
      reason: runScore.reason,
      slots: { timeRange: runScore.timeRange },
      patch: {}
    };
  }

  if (runScore.confidence >= 0.6) {
    return {
      intent: "clarification_needed",
      confidence: runScore.confidence,
      reason: "ambiguous_run_or_chat",
      slots: { timeRange: runScore.timeRange },
      patch: {},
      clarification:
        "Do you want me to run this agent once now, or were you just chatting?"
    };
  }

  if (isConversational(lower) || looksLikeQuestion(lower) || !hasCommandVerb(lower)) {
    return {
      intent: "chat",
      confidence: 0.78,
      reason: "conversational_message",
      slots: {},
      patch: {}
    };
  }

  return {
    intent: "clarification_needed",
    confidence: 0.55,
    reason: "command_without_clear_target",
    slots: {},
    patch: {},
    clarification:
      "I can run this agent, update its instructions, change its schedule, or answer questions about it. Which one did you mean?"
  };
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function asksCapability(lower: string): boolean {
  return (
    /\bwhat\b.*\b(?:do|does|doing|for)\b/.test(lower) ||
    /\bwhat(?:'s| is)\s+(?:your|this agent'?s?)\s+(?:job|purpose|setup|role)\b/.test(lower) ||
    /\bwhat\s+this\s+agent\s+do\b/.test(lower)
  );
}

function asksSchedule(lower: string): boolean {
  return (
    /\bwhen\b.*\b(?:run|send|deliver|message)\b/.test(lower) ||
    /\b(?:what|which)\b.*\b(?:schedule|time)\b/.test(lower) ||
    /\bcurrent schedule\b/.test(lower)
  );
}

function asksConnectorHelp(lower: string): boolean {
  return (
    /\b(?:connect|reconnect|disconnect|authorize|authorise|link)\b/.test(lower) &&
    connectorNames.some((connector) => lower.includes(connector))
  );
}

function connectorFromText(lower: string): string | undefined {
  if (/\b(?:gmail|email|mail|inbox)\b/.test(lower)) return "gmail";
  if (/\bdrive\b/.test(lower)) return "drive";
  if (/\bslack\b/.test(lower)) return "slack";
  return undefined;
}

function isPauseRequest(lower: string): boolean {
  return (
    /\b(?:pause|disable|turn off)\b(?:\s+(?:this|the|my))?\s*(?:agent|schedule|messages?)?\b/.test(
      lower
    ) ||
    /\bstop\s+(?:this\s+)?(?:agent|running|schedule|scheduled messages?|messages?)\b/.test(
      lower
    )
  );
}

function isResumeRequest(lower: string): boolean {
  return /\b(?:resume|enable|restart|turn on|unpause)\b.*\b(?:agent|this|it|schedule|messages?)?\b/.test(
    lower
  );
}

function isDeleteRequest(lower: string): boolean {
  return /\b(?:delete|remove|destroy)\b.*\b(?:agent|this|it)\b/.test(lower);
}

function isExplicitUpdateRequest(lower: string): boolean {
  return (
    /^(also|and|plus|along with|add|include|update|change|set|make it|have it)\b/.test(
      lower
    ) ||
    /\b(change|update|set|move)\b.*\b(schedule|time|cron|daily|weekly|monthly)\b/.test(
      lower
    )
  );
}

function normalizeInstruction(
  agent: AgentMessageRouterContext,
  text: string,
  context: { hasScheduleChange: boolean }
): string {
  const normalized = restoreAcronyms(
    text
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^along with (?:the )?(?:reminders?|agent),?\s*/i, "")
      .replace(/^(?:also|and|plus),?\s*/i, "")
      .replace(/^(?:please\s+)?(?:add|include)\s+/i, "")
      .replace(
        /^(?:change|update|set|move)\s+(?:the\s+)?(?:schedule|time)\s*(?:to)?\s*/i,
        ""
      )
      .replace(/\s+going forward\.?$/i, "")
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

function scoreRunNow(
  agent: AgentMessageRouterContext,
  lower: string
): {
  confidence: number;
  reason: string;
  timeRange?: "today" | "latest" | "current";
} {
  if (isExplicitRunNowRequest(lower)) {
    return {
      confidence: 0.95,
      reason: "explicit_run_now_request",
      timeRange: timeRangeFromText(lower)
    };
  }

  if (asksForFreshAgentData(agent, lower)) {
    return {
      confidence: 0.88,
      reason: "fresh_agent_data_request",
      timeRange: timeRangeFromText(lower) ?? "latest"
    };
  }

  if (!hasRunCommand(lower)) {
    return { confidence: 0, reason: "no_run_command" };
  }

  let score = 0.35;
  if (hasImmediateContext(lower)) score += 0.32;
  if (hasKnownOutputNoun(lower) || hasRunTarget(lower)) score += 0.18;
  if (sharesAgentVocabulary(agent, lower)) score += 0.14;

  return {
    confidence: Math.min(score, 0.92),
    reason: score >= 0.82 ? "on_demand_agent_request" : "possible_run_request",
    timeRange: timeRangeFromText(lower)
  };
}

function isExplicitRunNowRequest(lower: string): boolean {
  return (
    /^(?:please\s+)?(?:run|execute|start)(?:\s+please)?[.!?]?$/.test(lower) ||
    /\b(?:run|execute|start)\s+(?:(?:the|this|that|my|current)\s+){0,2}(?:agent|automation|workflow|job|it)\b/.test(
      lower
    ) ||
    /\b(run|execute|start|check|send)\b.*\b(now|right now|immediately)\b/.test(
      lower
    )
  );
}

function hasRunCommand(lower: string): boolean {
  return /\b(send|show|give|fetch|get|prepare|deliver|summari[sz]e|recap|brief|check|scan|find|read|run|do)\b/.test(
    lower
  );
}

function asksForFreshAgentData(
  agent: AgentMessageRouterContext,
  lower: string
): boolean {
  if (!looksLikeQuestion(lower)) return false;

  const asksFreshness =
    /\b(?:anything|what(?:'s| is)?|any|latest|current|recent|new)\b/.test(lower) &&
    /\b(?:new|latest|current|recent|today|today's|now|unread|updates?|changed?)\b/.test(lower);
  if (!asksFreshness) return false;

  const hasDataBackedAgent =
    agent.parsed_intent.connector_ids.length > 0 ||
    Boolean(agent.parsed_intent.connector) ||
    ["data_summary", "urgency_list", "comparison", "checklist"].includes(
      agent.parsed_intent.output_template
    );
  if (!hasDataBackedAgent) return false;

  return (
    mentionsAgentConnector(lower) ||
    hasKnownOutputNoun(lower) ||
    sharesAgentVocabulary(agent, lower)
  );
}

function mentionsAgentConnector(lower: string): boolean {
  return connectorNames.some((connector) => lower.includes(connector));
}

function hasCommandVerb(lower: string): boolean {
  return /\b(send|show|give|fetch|get|prepare|deliver|summari[sz]e|recap|brief|check|scan|find|read|run|do|add|include|update|change|set|pause|resume|delete|remove|stop|connect)\b/.test(
    lower
  );
}

function hasImmediateContext(lower: string): boolean {
  return /\b(today|today's|now|right now|latest|current|this morning|this afternoon|this evening|this week|this month|for today|for now)\b/.test(
    lower
  );
}

function hasKnownOutputNoun(lower: string): boolean {
  return meaningfulTokens(lower).some((token) => knownOutputNouns.has(token));
}

function hasRunTarget(lower: string): boolean {
  return meaningfulTokens(lower).some(
    (token) =>
      !runCommandWords.has(token) && !runTargetFillerWords.has(token)
  );
}

function sharesAgentVocabulary(
  agent: AgentMessageRouterContext,
  lower: string
): boolean {
  const textTokens = meaningfulTokens(lower);
  const agentTokens = new Set(
    meaningfulTokens(
      [
        agent.name,
        agent.prompt,
        agent.parsed_intent.intent.replace(/_/g, " "),
        agent.parsed_intent.action,
        agent.parsed_intent.output_template
      ].join(" ")
    )
  );

  return textTokens.some((token) => agentTokens.has(token));
}

function meaningfulTokens(value: string): string[] {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "do",
    "does",
    "for",
    "from",
    "i",
    "it",
    "me",
    "my",
    "of",
    "on",
    "or",
    "send",
    "show",
    "summarise",
    "summarize",
    "the",
    "this",
    "to",
    "today",
    "today's",
    "what",
    "you"
  ]);

  return value
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .map(normalizeToken)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function normalizeToken(token: string): string {
  const invariantPlural = new Set(["analysis", "business", "news", "progress"]);
  if (invariantPlural.has(token)) return token;
  if (token.length > 4 && token.endsWith("ies")) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function timeRangeFromText(
  lower: string
): "today" | "latest" | "current" | undefined {
  if (/\btoday|today's|this morning|this afternoon|this evening|for today\b/.test(lower)) {
    return "today";
  }
  if (/\blatest\b/.test(lower)) return "latest";
  if (/\bcurrent|for now|right now|now\b/.test(lower)) return "current";
  return undefined;
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
  return /^(ok|okay|cool|thanks|thank you|got it|nice|great|perfect|hmm|yeah|yes|no)\b/.test(
    lower
  );
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

function scheduleOverrideFromText(text: string): string | null {
  const lower = text.toLowerCase();
  const explicitTime = lower.match(
    /\b(?:at|to)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/
  );
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

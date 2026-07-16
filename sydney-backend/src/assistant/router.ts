export type AssistantRoute =
  | { kind: "confirm"; decision: "confirm" | "cancel" }
  | { kind: "memory_list" }
  | { kind: "memory_forget"; target: string; all: boolean }
  | { kind: "agent_list"; target?: string; countOnly?: boolean }
  | {
      kind: "agent_manage";
      operation: "pause" | "resume" | "run" | "delete";
      target: string;
    }
  | { kind: "agent_rename"; target: string; name: string }
  | { kind: "agent_update"; target: string; description: string }
  | { kind: "create_agent" }
  | {
      kind: "connector_query";
      connectors: Array<"gmail" | "calendar" | "drive" | "github" | "slack" | "notion">;
    }
  | { kind: "clarify"; subject: "agent" | "memory" | "connector" }
  | {
      kind: "agent_selection";
      pendingActionId: string;
      selectedAgentId: string;
    }
  | { kind: "chat" };

export function routeAssistantMessage(
  text: string,
  options: { hasPendingAction?: boolean } = {}
): AssistantRoute {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Pending confirmation always wins over every other interpretation.
  if (options.hasPendingAction) {
    if (/^(?:confirm|yes|yep|ok|okay|do it|go ahead)$/i.test(trimmed)) {
      return { kind: "confirm", decision: "confirm" };
    }
    if (/^(?:cancel|no|nope|never mind|nevermind|stop)$/i.test(trimmed)) {
      return { kind: "confirm", decision: "cancel" };
    }
  }

  if (/\bwhat do you remember(?: about me)?\b|\bshow (?:me )?(?:your )?memories\b/i.test(trimmed)) {
    return { kind: "memory_list" };
  }
  const forget = trimmed.match(/^forget\s+(.+?)[.!]?$/i);
  if (forget) {
    const target = forget[1]!.trim();
    return {
      kind: "memory_forget",
      target,
      all: /^(?:everything|all|all memories|everything about me)$/i.test(target)
    };
  }

  const statusTarget = trimmed.match(/^status\s+(?:of\s+)?(?:agent\s+)?(.+?)[.!]?$/i);
  if (statusTarget && !/^agents?$/i.test(statusTarget[1]!.trim())) {
    return { kind: "agent_list", target: statusTarget[1]!.trim() };
  }
  if (/^(?:(?:list|show)\s+(?:my\s+)?agents|(?:agent\s+)?status)$/i.test(trimmed)) {
    return { kind: "agent_list" };
  }
  if (
    /^(?:how many\s+(?:specialist\s+)?agents?\s+(?:do i have|have i (?:created|made)|did i (?:create|make))|(?:what(?:'s| is)\s+)?my\s+(?:agent count|number of agents)|count\s+my\s+agents?)[?.!]*$/i.test(
      trimmed
    )
  ) {
    return { kind: "agent_list", countOnly: true };
  }
  const management = trimmed.match(
    /^(pause|resume|run|delete)\s+(?:agent\s+)?(.+?)[.!]?$/i
  );
  if (management) {
    return {
      kind: "agent_manage",
      operation: management[1]!.toLowerCase() as "pause" | "resume" | "run" | "delete",
      target: management[2]!.trim().replace(/\s+now$/i, "")
    };
  }
  const rename = trimmed.match(
    /^rename\s+(?:agent\s+)?(.+?)\s+to\s+(.+?)[.!]?$/i
  );
  if (rename) {
    return { kind: "agent_rename", target: rename[1]!.trim(), name: rename[2]!.trim() };
  }
  const update = trimmed.match(
    /^(?:update|change)\s+agent\s+(.+?)(?::|\s+(?:to|so that|functionality to|description to))\s+(.+?)$/i
  );
  if (update) {
    return {
      kind: "agent_update",
      target: update[1]!.trim(),
      description: update[2]!.trim()
    };
  }

  if (
    /\b(?:create|make|build)\b.*\bagent\b/.test(lower) ||
    /\bset\s+up\b.*\bagent\b/.test(lower)
  ) {
    return { kind: "create_agent" };
  }

  const connectors = connectorMentions(lower);
  if (connectors.length > 0 && looksLikeConnectorQuestion(lower)) {
    return { kind: "connector_query", connectors: connectors.slice(0, 3) };
  }
  return { kind: "chat" };
}

function connectorMentions(
  lower: string
): Array<"gmail" | "calendar" | "drive" | "github" | "slack" | "notion"> {
  const found: Array<"gmail" | "calendar" | "drive" | "github" | "slack" | "notion"> = [];
  if (/\b(?:gmail|email|emails|inbox|mail)\b/.test(lower)) found.push("gmail");
  if (/\b(?:calendar|meeting|meetings|agenda|event|events)\b/.test(lower)) found.push("calendar");
  if (/\b(?:google drive|drive file|drive files|document|documents)\b/.test(lower)) found.push("drive");
  if (/\b(?:github|repo|repository|pull request|issues?|commits?)\b/.test(lower)) found.push("github");
  if (/\b(?:slack|channel|channels)\b/.test(lower)) found.push("slack");
  if (/\b(?:notion|shared page|workspace page)\b/.test(lower)) found.push("notion");
  return [...new Set(found)];
}

function looksLikeConnectorQuestion(lower: string): boolean {
  return (
    /\b(?:what|which|show|find|search|summari[sz]e|recent|latest|today|tomorrow|this week|do i have|are there|activity|agenda)\b/.test(lower) ||
    lower.endsWith("?")
  );
}

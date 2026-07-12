export type AgentRow = {
  id: string;
  user_id: string;
  name: string;
  prompt: string;
  parsed_intent: Record<string, unknown>;
  connector_ids: string[];
  schedule_cron: string | null;
  is_assistant: boolean;
  status: "active" | "paused" | "error";
  safety_level: "read" | "suggest" | "act";
};

export function parseAgentIntent(
  agent: AgentRow
): Record<string, unknown> {
  const raw = agent.parsed_intent;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw || {};
}

export function intentName(agent: AgentRow): string {
  return String(parseAgentIntent(agent).intent ?? "");
}

export function actionText(agent: AgentRow): string {
  return String(parseAgentIntent(agent).action ?? agent.prompt).trim();
}

export function outputTemplate(agent: AgentRow): string {
  return String(parseAgentIntent(agent).output_template ?? "plain_text");
}

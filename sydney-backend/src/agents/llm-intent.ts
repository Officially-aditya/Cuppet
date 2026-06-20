import {
  anthropicConfigured,
  createAnthropicMessage,
  extractAnthropicText
} from "./anthropic.js";
import { parseIntent, type ParsedIntent } from "./parser.js";
import { validateAgentPlan, type AgentPlanProposal } from "./plan-validator.js";

export async function parseIntentHybrid(prompt: string): Promise<ParsedIntent> {
  const deterministic = parseIntent(prompt);
  if (!shouldRefineIntent(prompt, deterministic) || !anthropicConfigured()) {
    return deterministic;
  }

  try {
    const response = await createAnthropicMessage({
      system: [
        "You classify Sydney agent creation requests.",
        "Return only compact JSON.",
        "Prefer supported intents only.",
        "Do not invent connector capabilities.",
        "Supported connectors: gmail, drive, calendar, web_search, or null.",
        "Supported output_template: plain_text, data_summary, checklist, urgency_list, daily_task, progress_tracker."
      ].join(" "),
      maxTokens: 500,
      messages: [
        {
          role: "user",
          content: [
            `User request: ${prompt}`,
            `Current deterministic parse: ${JSON.stringify(deterministic)}`,
            "Return JSON with optional fields: name, intent, connector, connectors, action, schedule_cron, output_template, trigger.",
            "Use trigger.type = event only when the user asks for event-based alerts like price movement or new item changes.",
            "Only override when the deterministic parse is too generic or clearly wrong."
          ].join("\n")
        }
      ]
    });

    const parsed = parseJsonObject(extractAnthropicText(response.content));
    return validateAgentPlan(deterministic, parsed).intent;
  } catch {
    return deterministic;
  }
}

function shouldRefineIntent(prompt: string, parsed: ParsedIntent): boolean {
  const lower = prompt.toLowerCase();
  if (parsed.connector === "gmail") {
    return false;
  }
  const explicitlyCreatesAgent =
    /\b(?:create|make|build|setup)\b.*\bagent\b/.test(lower) ||
    /\bset\s+up\b.*\bagent\b/.test(lower);

  if (explicitlyCreatesAgent) {
    return true;
  }

  return (
    parsed.intent === "custom_read_agent" ||
    parsed.name === "Custom Agent" ||
    /\b(?:summari[sz]e|digest|report|watch|monitor|track|analy[sz]e|remind|teach|learn|send|practice)\b/.test(lower)
  );
}

function parseJsonObject(text: string): AgentPlanProposal {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  const value = JSON.parse(match[0]) as unknown;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AgentPlanProposal)
    : {};
}

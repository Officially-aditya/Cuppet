import type { ParsedIntent } from "./parser.js";

export type AgentPlanProposal = {
  name?: string;
  intent?: string;
  connector?: string | null;
  connectors?: string[];
  action?: string;
  schedule_cron?: string | null;
  output_template?: string;
  trigger?: {
    type?: string;
    event?: string;
    schedule_cron?: string | null;
    config?: Record<string, unknown>;
  };
  safety_level?: string;
};

export type ValidatedAgentPlan = {
  intent: ParsedIntent;
  trigger: {
    type: "schedule" | "manual";
    schedule_cron: string | null;
    event: string | null;
    config: Record<string, unknown>;
  };
  unsupported_requirements: string[];
  warnings: string[];
};

const supportedConnectors = new Set([
  "gmail",
  "drive",
  "calendar",
  "github",
  "web_search"
]);
const supportedTemplates = new Set([
  "plain_text",
  "data_summary",
  "checklist",
  "urgency_list",
  "daily_task",
  "progress_tracker",
  "streak_counter",
  "comparison",
  "system"
]);
const supportedSafetyLevels = new Set(["read", "suggest", "act"]);

export function validateAgentPlan(
  base: ParsedIntent,
  proposal: AgentPlanProposal
): ValidatedAgentPlan {
  const unsupported = new Set<string>();
  const warnings: string[] = [];
  const connectors = normalizeConnectors(proposal, base, unsupported);
  const connector = connectors[0] ?? null;
  const outputTemplate = normalizeOutputTemplate(
    proposal.output_template,
    base.output_template,
    warnings
  );
  const trigger = normalizeTrigger(proposal, base, unsupported, warnings);
  const safetyLevel = normalizeSafetyLevel(
    proposal.safety_level,
    base.safety_level,
    warnings
  );

  const intent: ParsedIntent = {
    ...base,
    name: cleanShortText(proposal.name) ?? base.name,
    intent: cleanIntent(proposal.intent) ?? base.intent,
    connector,
    connector_ids: connectors,
    action: cleanLongText(proposal.action) ?? base.action,
    schedule_cron: trigger.type === "schedule" ? trigger.schedule_cron : null,
    output_template: outputTemplate,
    template_config: templateConfig(outputTemplate),
    safety_level: safetyLevel,
    permissions_needed: connectorPermissions(connectors, base.permissions_needed)
  };

  return {
    intent,
    trigger,
    unsupported_requirements: [...unsupported],
    warnings
  };
}

function normalizeConnectors(
  proposal: AgentPlanProposal,
  base: ParsedIntent,
  unsupported: Set<string>
): string[] {
  const proposed = [
    ...(proposal.connectors ?? []),
    ...(proposal.connector === undefined || proposal.connector === null
      ? []
      : [proposal.connector])
  ]
    .map((connector) => connector.trim().toLowerCase())
    .filter(Boolean);
  const fallback = base.connector_ids.length > 0
    ? base.connector_ids
    : base.connector
      ? [base.connector]
      : [];
  const candidates = proposed.length > 0 ? proposed : fallback;
  const normalized: string[] = [];

  for (const connector of candidates) {
    if (supportedConnectors.has(connector)) {
      if (!normalized.includes(connector)) normalized.push(connector);
    } else {
      unsupported.add(`connector:${connector}`);
    }
  }

  return normalized;
}

function normalizeTrigger(
  proposal: AgentPlanProposal,
  base: ParsedIntent,
  unsupported: Set<string>,
  warnings: string[]
): ValidatedAgentPlan["trigger"] {
  const triggerType = proposal.trigger?.type?.trim().toLowerCase();
  if (triggerType === "event") {
    unsupported.add(`trigger:event:${proposal.trigger?.event ?? "unknown"}`);
    warnings.push("Event-based triggers are not supported yet; using manual runs until a connector watcher exists.");
    return {
      type: "manual",
      schedule_cron: null,
      event: proposal.trigger?.event ?? null,
      config: proposal.trigger?.config ?? {}
    };
  }

  if (triggerType === "manual") {
    return {
      type: "manual",
      schedule_cron: null,
      event: null,
      config: proposal.trigger?.config ?? {}
    };
  }

  const scheduleCron =
    proposal.trigger?.schedule_cron ??
    proposal.schedule_cron ??
    base.schedule_cron;
  if (scheduleCron && !validCron(scheduleCron)) {
    unsupported.add(`schedule:${scheduleCron}`);
    warnings.push("Rejected invalid schedule from plan.");
    return {
      type: "manual",
      schedule_cron: null,
      event: null,
      config: {}
    };
  }

  return {
    type: scheduleCron ? "schedule" : "manual",
    schedule_cron: scheduleCron ?? null,
    event: null,
    config: proposal.trigger?.config ?? {}
  };
}

function normalizeOutputTemplate(
  value: string | undefined,
  fallback: string,
  warnings: string[]
): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (supportedTemplates.has(normalized)) return normalized;
  warnings.push(`Rejected unsupported output template: ${normalized}`);
  return fallback;
}

function normalizeSafetyLevel(
  value: string | undefined,
  fallback: ParsedIntent["safety_level"],
  warnings: string[]
): ParsedIntent["safety_level"] {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (supportedSafetyLevels.has(normalized)) {
    return normalized as ParsedIntent["safety_level"];
  }
  warnings.push(`Rejected unsupported safety level: ${normalized}`);
  return fallback;
}

function connectorPermissions(
  connectors: string[],
  fallback: string[]
): string[] {
  if (connectors.includes("gmail")) return ["Gmail read access"];
  if (connectors.includes("drive")) return ["Google Drive read access"];
  if (connectors.includes("calendar")) return ["Google Calendar event read access"];
  if (connectors.includes("github")) return ["GitHub profile and repository read access"];
  if (connectors.includes("web_search")) return ["Web search (no login needed)"];
  return fallback;
}

function templateConfig(template: string): Record<string, boolean> {
  return {
    has_progress_bars: template === "progress_tracker",
    has_countdown: template === "progress_tracker",
    has_streak: template === "progress_tracker" || template === "streak_counter",
    has_action_buttons: [
      "progress_tracker",
      "checklist",
      "daily_task",
      "streak_counter"
    ].includes(template),
    has_checklist: template === "checklist"
  };
}

function cleanIntent(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text && /^[a-z0-9_]{3,80}$/.test(text) ? text : undefined;
}

function cleanShortText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text && text.length <= 80 ? text : undefined;
}

function cleanLongText(value: string | undefined): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim();
  return text && text.length <= 500 ? text : undefined;
}

function validCron(value: string): boolean {
  return /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(value);
}

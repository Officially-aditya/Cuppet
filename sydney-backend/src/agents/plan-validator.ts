import type { ParsedIntent } from "./parser.js";
import {
  hasForbiddenTextControls,
  isPromptInjectionAttempt,
  normalizeSecurityText
} from "../security/prompt-guard.js";

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
    type: "event" | "schedule" | "manual";
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
  "slack",
  "notion",
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
  "system",
  "study_guide",
  "dsa_question",
  "briefing_card"
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
    intent: cleanIntent(proposal.intent, base.intent) ?? base.intent,
    connector,
    connector_ids: connectors,
    action: cleanLongText(proposal.action) ?? base.action,
    schedule_cron: trigger.type === "schedule" ? trigger.schedule_cron : null,
    realtime_enabled:
      trigger.type === "event"
        ? true
        : trigger.type === "schedule"
          ? false
          : base.realtime_enabled ?? false,
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
    if (supportsEventTrigger(base.intent)) {
      return {
        type: "event",
        schedule_cron: null,
        event: proposal.trigger?.event ?? defaultEventForIntent(base.intent),
        config: proposal.trigger?.config ?? {}
      };
    }
    unsupported.add(`trigger:event:${proposal.trigger?.event ?? "unknown"}`);
    warnings.push("Event-based triggers are not supported yet; using manual runs until a connector watcher exists.");
    if (base.schedule_cron) {
      return {
        type: "schedule",
        schedule_cron: base.schedule_cron,
        event: proposal.trigger?.event ?? null,
        config: proposal.trigger?.config ?? {}
      };
    }
    return {
      type: "manual",
      schedule_cron: null,
      event: proposal.trigger?.event ?? null,
      config: proposal.trigger?.config ?? {}
    };
  }

  if (base.realtime_enabled && triggerType !== "schedule") {
    return {
      type: "event",
      schedule_cron: null,
      event: proposal.trigger?.event ?? defaultEventForIntent(base.intent),
      config: proposal.trigger?.config ?? {}
    };
  }

  if (triggerType === "manual") {
    if (base.schedule_cron) {
      return {
        type: "schedule",
        schedule_cron: base.schedule_cron,
        event: null,
        config: proposal.trigger?.config ?? {}
      };
    }
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

const EVENT_TRIGGER_INTENTS = new Set([
  "github_activity_digest",
  "slack_urgent_watcher",
  "lead_response_monitor",
  "calendar_agenda",
  "drive_summary",
  "pdf_summary",
  "meeting_recap",
  "portfolio_watch"
]);

function supportsEventTrigger(intent: string): boolean {
  return EVENT_TRIGGER_INTENTS.has(intent);
}

function defaultEventForIntent(intent: string): string {
  const events: Record<string, string> = {
    github_activity_digest: "github.repository_activity",
    slack_urgent_watcher: "slack.urgent_message",
    lead_response_monitor: "gmail.new_message",
    calendar_agenda: "calendar.changed",
    drive_summary: "drive.changed",
    pdf_summary: "drive.changed",
    meeting_recap: "drive.changed",
    portfolio_watch: "stock.threshold_crossed"
  };
  return events[intent] ?? "connector.changed";
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
  const labels: Record<string, string> = {
    gmail: "Gmail read access",
    drive: "Google Drive read access",
    calendar: "Google Calendar event read access",
    github: "GitHub profile and repository read access",
    slack: "Slack message history access",
    notion: "Read selected Notion pages",
    web_search: "Web search (no login needed)"
  };
  const permissions = connectors
    .map((connector) => labels[connector])
    .filter((value): value is string => Boolean(value));
  return permissions.length > 0 ? [...new Set(permissions)] : fallback;
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
      "streak_counter",
      "study_guide",
      "dsa_question"
    ].includes(template),
    has_checklist: template === "checklist"
  };
}

const SUPPORTED_INTENTS = new Set([
  "daily_executive_briefing",
  "project_pulse",
  "meeting_intelligence",
  "weekly_accomplishment_report",
  "tech_news_brief",
  "news_brief",
  "job_market_radar",
  "web_search_agent",
  "scheduled_reminder",
  "study_plan",
  "dsa_question",
  "interview_prep",
  "procrastination_breaker",
  "daily_task",
  "habit_tracker",
  "language_word",
  "coding_tip",
  "book_companion",
  "parenting_milestones",
  "relationship_nudge",
  "gratitude_prompt",
  "portfolio_watch",
  "competitor_watch",
  "content_extractor"
]);

const CONNECTOR_BACKED_INTENTS = new Set([
  "daily_executive_briefing",
  "project_pulse",
  "meeting_intelligence",
  "weekly_accomplishment_report",
  "email_digest",
  "invoice_tracker",
  "subscription_auditor",
  "email_followup_watcher",
  "lead_response_monitor",
  "travel_sentinel",
  "drive_summary",
  "pdf_summary",
  "meeting_recap",
  "project_deadline_watcher",
  "calendar_agenda",
  "github_activity_digest",
  "notion_workspace_digest"
]);

function cleanIntent(value: string | undefined, baseIntent: string): string | undefined {
  // Connector dispatch is deterministic. An LLM refinement may improve labels,
  // actions, and schedules, but must not route a known connector agent elsewhere.
  if (CONNECTOR_BACKED_INTENTS.has(baseIntent)) {
    return baseIntent;
  }
  const text = value?.trim();
  if (text && SUPPORTED_INTENTS.has(text)) {
    return text;
  }
  if (
    text === "market_watch" ||
    text === "market_monitoring" ||
    text === "stock_monitor" ||
    text === "stock_watch"
  ) {
    return "portfolio_watch";
  }
  if (SUPPORTED_INTENTS.has(baseIntent)) {
    return baseIntent;
  }
  return text && /^[a-z0-9_]{3,80}$/.test(text) ? text : undefined;
}

function cleanShortText(value: string | undefined): string | undefined {
  const text = value ? normalizeSecurityText(value) : undefined;
  return text &&
    text.length <= 80 &&
    !hasForbiddenTextControls(text) &&
    !isPromptInjectionAttempt(text)
    ? text
    : undefined;
}

function cleanLongText(value: string | undefined): string | undefined {
  const text = value
    ? normalizeSecurityText(value).replace(/\s+/g, " ")
    : undefined;
  return text &&
    text.length <= 500 &&
    !hasForbiddenTextControls(text) &&
    !isPromptInjectionAttempt(text)
    ? text
    : undefined;
}

function validCron(value: string): boolean {
  return /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(value);
}

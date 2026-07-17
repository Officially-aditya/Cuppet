import type { ParsedIntent } from "../parser.js";
import {
  agentDefinitionV1Schema,
  type AgentDefinitionV1
} from "./definition.js";
import {
  getCapabilityDefinition,
  type CapabilityId,
  validateCapabilityStep
} from "./capability-registry.js";
import {
  getOutputContract,
  isScheduledOutputContract,
  type ScheduledOutputContractId
} from "./output-registry.js";

const BRIEFING_RECIPES = new Set([
  "daily_executive_briefing",
  "project_pulse",
  "meeting_intelligence",
  "weekly_accomplishment_report"
]);

const CONNECTOR_RECIPES = new Set([
  "email_digest",
  "invoice_tracker",
  "subscription_auditor",
  "email_followup_watcher",
  "lead_response_monitor",
  "travel_sentinel",
  "slack_digest",
  "slack_urgent_watcher",
  "eod_task_report",
  "drive_summary",
  "pdf_summary",
  "meeting_recap",
  "weekly_progress_report",
  "project_deadline_watcher",
  "calendar_agenda",
  "github_activity_digest",
  "notion_workspace_digest"
]);

const NEWS_RECIPES = new Set([
  "tech_news_brief",
  "news_brief",
  "job_market_radar",
  "web_search_agent"
]);

const DETERMINISTIC_RECIPES = new Set([
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
  "competitor_watch"
]);

export function compileAgentDefinition(
  parsedIntent: ParsedIntent,
  prompt: string
): AgentDefinitionV1 {
  if (parsedIntent.unsupported_connector) {
    throw new Error(
      `Cannot compile unsupported connector: ${parsedIntent.unsupported_connector}`
    );
  }

  const contract = outputContract(parsedIntent.output_template);
  const capability = capabilityForRecipe(parsedIntent.intent);
  const stepId = "deliver";
  const definition = agentDefinitionV1Schema.parse({
    schema_version: 1,
    goal: prompt.trim(),
    instructions: [parsedIntent.action],
    trigger: triggerForIntent(parsedIntent),
    steps: [
      {
        id: stepId,
        capability,
        capability_version: "1.0",
        depends_on: [],
        config: {
          recipe_id: parsedIntent.intent,
          prompt: prompt.trim(),
          action: parsedIntent.action,
          connector_ids: parsedIntent.connector_ids,
          output_contract: contract,
          ...(parsedIntent.response_limit
            ? { response_limit: parsedIntent.response_limit }
            : {}),
          ...(parsedIntent.github_repository
            ? { github_repository: parsedIntent.github_repository }
            : {}),
          ...(draftPlatform(prompt, parsedIntent.intent)
            ? { platform: draftPlatform(prompt, parsedIntent.intent) }
            : {})
        }
      }
    ],
    output: {
      contract,
      contract_version: "1.0",
      from_step: stepId,
      options: {}
    },
    interaction: {
      follow_up_mode: "grounded",
      ...(draftPlatform(prompt, parsedIntent.intent)
        ? { draft_platform: draftPlatform(prompt, parsedIntent.intent) }
        : {}),
      allowed_message_actions: allowedActions(contract)
    },
    policy: {
      safety_level: parsedIntent.safety_level,
      response_limit: parsedIntent.response_limit ?? "balanced",
      notifications_muted:
        (parsedIntent as ParsedIntent & { notifications_muted?: boolean })
          .notifications_muted === true,
      active_until: parsedIntent.active_until ?? null
    },
    metadata: {
      recipe_id: parsedIntent.intent
    }
  });

  validateCompiledDefinition(definition);
  return definition;
}

export function validateCompiledDefinition(
  value: unknown
): AgentDefinitionV1 {
  const definition = agentDefinitionV1Schema.parse(value);
  getOutputContract(definition.output.contract);
  for (const step of definition.steps) {
    validateCapabilityStep({
      step,
      trigger: definition.trigger,
      safetyLevel: definition.policy.safety_level
    });
  }
  const outputStep = definition.steps.find(
    (step) => step.id === definition.output.from_step
  )!;
  const outputCapability = getCapabilityDefinition(outputStep.capability);
  if (
    outputCapability.requiredConnectors(outputStep.config).some(
      (connector) =>
        ![
          "gmail",
          "drive",
          "calendar",
          "github",
          "slack",
          "notion",
          "web_search"
        ].includes(connector)
    )
  ) {
    throw new Error("A capability requested an unregistered connector.");
  }
  return definition;
}

export function definitionToParsedIntent(
  definition: AgentDefinitionV1,
  input: {
    name: string;
    avatar: string;
    runtimeState?: Record<string, unknown>;
  }
): ParsedIntent & Record<string, unknown> {
  const step = definition.steps.find(
    (candidate) => candidate.id === definition.output.from_step
  )!;
  const config = step.config;
  const capability = getCapabilityDefinition(step.capability);
  const connectors = Array.isArray(config.connector_ids)
    ? config.connector_ids.filter(
        (connector): connector is string => typeof connector === "string"
      )
    : [];
  return {
    name: input.name,
    avatar: input.avatar,
    intent:
      definition.metadata.recipe_id ??
      String(config.recipe_id ?? "custom_read_agent"),
    connector: connectors[0] ?? null,
    connector_ids: connectors,
    unsupported_connector: null,
    action: definition.instructions[0] ?? definition.goal,
    schedule_cron:
      definition.trigger.type === "schedule"
        ? definition.trigger.cron
        : null,
    output_template: definition.output.contract,
    template_config: templateConfiguration(definition.output.contract),
    safety_level: definition.policy.safety_level,
    risk_level:
      definition.policy.safety_level === "read"
        ? "low"
        : definition.policy.safety_level === "suggest"
          ? "medium"
          : "high",
    permissions_needed: connectorPermissions(connectors),
    realtime_enabled: definition.trigger.type === "event",
    response_limit: definition.policy.response_limit,
    ...(definition.policy.active_until
      ? { active_until: definition.policy.active_until }
      : {}),
    ...(typeof config.github_repository === "string"
      ? { github_repository: config.github_repository }
      : {}),
    notifications_muted: definition.policy.notifications_muted,
    follow_up_mode: definition.interaction.follow_up_mode,
    ...(definition.interaction.draft_platform
      ? { draft_platform: definition.interaction.draft_platform }
      : {}),
    ...(capability.chatProfile
      ? { chat_profile: { ...capability.chatProfile } }
      : {}),
    ...(definition.trigger.type === "event"
      ? {
          event_cooldown_seconds: definition.trigger.cooldown_seconds,
          event_filter: definition.trigger.filter
        }
      : {}),
    ...(input.runtimeState ?? {})
  };
}

export function agentConfigurationView(
  definition: AgentDefinitionV1,
  input: { name?: string; avatar?: string } = {}
): Record<string, unknown> {
  const outputStep = definition.steps.find(
    (step) => step.id === definition.output.from_step
  )!;
  const connectors = getCapabilityDefinition(
    outputStep.capability
  ).requiredConnectors(outputStep.config);
  return {
    schema_version: definition.schema_version,
    name: input.name,
    avatar: input.avatar,
    goal: definition.goal,
    instructions: definition.instructions,
    trigger: definition.trigger,
    capabilities: definition.steps.map((step) => ({
      id: step.capability,
      version: step.capability_version,
      required_connectors:
        getCapabilityDefinition(step.capability).requiredConnectors(step.config)
    })),
    output: definition.output,
    interaction: definition.interaction,
    policy: definition.policy,
    recipe_id: definition.metadata.recipe_id,
    permissions_needed: connectorPermissions(connectors)
  };
}

function capabilityForRecipe(recipe: string): CapabilityId {
  if (BRIEFING_RECIPES.has(recipe)) return "briefing.compose";
  if (CONNECTOR_RECIPES.has(recipe)) return "connector.digest";
  if (NEWS_RECIPES.has(recipe)) return "news.research";
  if (recipe === "content_extractor") return "content.ideas";
  if (recipe === "dsa_question") return "dsa.generate";
  if (recipe === "study_plan") return "study.guide";
  if (recipe === "portfolio_watch") return "portfolio.watch";
  if (recipe === "scheduled_reminder") return "reminder.deliver";
  if (DETERMINISTIC_RECIPES.has(recipe)) return "deterministic.report";
  return "custom.report";
}

function triggerForIntent(parsedIntent: ParsedIntent): AgentDefinitionV1["trigger"] {
  if (parsedIntent.realtime_enabled) {
    const source = eventSource(parsedIntent);
    return {
      type: "event",
      source,
      filter: parsedIntent.github_repository
        ? { repository: parsedIntent.github_repository }
        : {},
      cooldown_seconds: eventCooldown(parsedIntent, source)
    };
  }
  if (parsedIntent.schedule_cron) {
    return { type: "schedule", cron: parsedIntent.schedule_cron };
  }
  return { type: "manual" };
}

function eventSource(
  parsedIntent: ParsedIntent
): Extract<AgentDefinitionV1["trigger"], { type: "event" }>["source"] {
  const connector = parsedIntent.connector_ids[0] ?? parsedIntent.connector;
  if (
    connector === "slack" ||
    connector === "github" ||
    connector === "gmail" ||
    connector === "calendar" ||
    connector === "drive"
  ) {
    return connector;
  }
  return parsedIntent.intent === "portfolio_watch" ? "stock" : "drive";
}

function eventCooldown(parsedIntent: ParsedIntent, source: string): number {
  const configured = Number(
    (parsedIntent as ParsedIntent & { event_cooldown_seconds?: number })
      .event_cooldown_seconds
  );
  if (Number.isFinite(configured)) {
    return Math.min(Math.max(Math.round(configured), 30), 86_400);
  }
  if (source === "slack") return 120;
  if (source === "github") return 60;
  return 300;
}

function outputContract(value: string): ScheduledOutputContractId {
  // Old unsupported-connector parses used "system"; those are rejected before
  // compilation. A generic agent otherwise keeps the existing plain-text wire shape.
  return isScheduledOutputContract(value) ? value : "plain_text";
}

function allowedActions(
  contract: ScheduledOutputContractId
): Array<"done" | "snooze" | "skip" | "draft" | "open_in_assistant"> {
  if (["daily_task", "study_guide", "dsa_question"].includes(contract)) {
    return ["done", "snooze", "skip"];
  }
  if (contract === "content_extractor") return ["draft"];
  if (contract === "briefing_card") return ["open_in_assistant"];
  return [];
}

function draftPlatform(
  prompt: string,
  recipe: string
): "twitter" | "linkedin" | "reddit" | "generic" | undefined {
  if (recipe !== "content_extractor") return undefined;
  if (/\b(?:twitter|tweet|x post)\b/i.test(prompt)) return "twitter";
  if (/\blinkedin\b/i.test(prompt)) return "linkedin";
  if (/\breddit\b/i.test(prompt)) return "reddit";
  return "generic";
}

function connectorPermissions(connectors: string[]): string[] {
  const permissions: Record<string, string> = {
    gmail: "Gmail read access",
    drive: "Google Drive read access",
    calendar: "Google Calendar event read access",
    github: "GitHub profile and repository read access",
    slack: "Slack message history access",
    notion: "Read selected Notion pages",
    web_search: "Web search (no login needed)"
  };
  return [
    ...new Set(
      connectors
        .map((connector) => permissions[connector])
        .filter((permission): permission is string => Boolean(permission))
    )
  ];
}

function templateConfiguration(contract: string): Record<string, boolean> {
  return {
    has_progress_bars: contract === "progress_tracker",
    has_countdown: contract === "progress_tracker",
    has_streak:
      contract === "progress_tracker" || contract === "streak_counter",
    has_action_buttons: [
      "progress_tracker",
      "checklist",
      "daily_task",
      "streak_counter",
      "study_guide",
      "dsa_question"
    ].includes(contract),
    has_checklist: contract === "checklist"
  };
}

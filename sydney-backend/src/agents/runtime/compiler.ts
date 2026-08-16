import type { ParsedIntent } from "../parser.js";
import {
  agentDefinitionV2Schema,
  agentDefinitionV1Schema,
  safetyLevelRank,
  type AgentDefinition,
  type AgentDefinitionV1,
  type AgentDefinitionV2
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
import {
  getAgentRecipeProfile,
  hasAgentRecipeProfile,
  recipePromptProfile,
  validateRecipeInputs,
  type AgentRecipeProfileV1
} from "./recipe-registry.js";
import { supportsRealtimeAgentIntent } from "./trigger-support.js";

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
  if (
    parsedIntent.realtime_enabled &&
    !supportsRealtimeAgentIntent(parsedIntent.intent)
  ) {
    throw new Error(
      `Realtime triggers are not supported for ${parsedIntent.intent}.`
    );
  }

  const profile = hasAgentRecipeProfile(parsedIntent.intent)
    ? getAgentRecipeProfile(
        parsedIntent.intent,
        parsedIntent.recipe_version
      )
    : getAgentRecipeProfile("custom_read_agent");
  const recipeInputs = validateRecipeInputs(
    profile,
    parsedIntent.recipe_inputs ?? inferredRecipeInputs(profile, parsedIntent)
  );
  const configuredDraftPlatform = draftPlatformForRecipe(
    profile.id,
    recipeInputs
  );
  const contract = profile.output_contract;
  const capability = profile.capability;
  const configuredConnectors =
    profile.id === "custom_read_agent" && parsedIntent.connector_ids.length > 0
      ? parsedIntent.connector_ids
      : profile.required_connectors;
  const stepId = "deliver";
  const definition = agentDefinitionV1Schema.parse({
    schema_version: 1,
    goal: prompt.trim(),
    instructions: [profile.action],
    trigger: triggerForIntent(parsedIntent),
    steps: [
      {
        id: stepId,
        capability,
        capability_version: "1.0",
        depends_on: [],
        config: {
          recipe_id: profile.id,
          recipe_version: profile.version,
          prompt_profile_version: profile.prompt_profile_version,
          recipe_inputs: recipeInputs,
          prompt: prompt.trim(),
          action: profile.action,
          connector_ids: [...configuredConnectors],
          ...(parsedIntent.required_access
            ? { access_refs: parsedIntent.required_access }
            : {}),
          output_contract: contract,
          ...(parsedIntent.response_limit
            ? { response_limit: parsedIntent.response_limit }
            : {}),
          ...(parsedIntent.github_repository
            ? { github_repository: parsedIntent.github_repository }
            : {}),
          ...(configuredDraftPlatform
            ? { platform: configuredDraftPlatform }
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
      ...(configuredDraftPlatform
        ? { draft_platform: configuredDraftPlatform }
        : {}),
      allowed_message_actions: allowedActions(contract)
    },
    policy: {
      safety_level: profile.safety_level,
      response_limit: parsedIntent.response_limit ?? "balanced",
      notifications_muted:
        (parsedIntent as ParsedIntent & { notifications_muted?: boolean })
          .notifications_muted === true,
      active_until: parsedIntent.active_until ?? null
    },
    metadata: {
      recipe_id: profile.id,
      recipe_version: profile.version,
      prompt_profile_version: profile.prompt_profile_version,
      recipe_inputs: recipeInputs
    }
  });

  validateCompiledDefinition(definition);
  return definition;
}

export function parsedIntentForRecipe(input: {
  recipeId: string;
  recipeVersion?: number;
  recipeInputs?: Record<string, unknown>;
  prompt?: string;
}): ParsedIntent {
  const profile = getAgentRecipeProfile(input.recipeId, input.recipeVersion);
  const baseInputs = validateRecipeInputs(profile, input.recipeInputs);
  const recipeInputs = validateRecipeInputs(
    profile,
    customizeRecipeInputsFromPrompt(profile, baseInputs, input.prompt)
  );
  const schedule =
    typeof recipeInputs.schedule === "string"
      ? recipeInputs.schedule
      : profile.default_trigger.type === "schedule"
        ? profile.default_trigger.cron
        : null;
  const githubRepositories = Array.isArray(recipeInputs.repository_filters)
    ? recipeInputs.repository_filters.filter(
        (value): value is string => typeof value === "string"
      )
    : [];
  const draftPlatform =
    profile.id === "content_extractor" &&
    typeof recipeInputs.platform === "string"
      ? recipeInputs.platform
      : undefined;
  return {
    name: profile.display.name,
    avatar: profile.display.icon,
    intent: profile.id,
    connector: profile.required_connectors[0] ?? null,
    connector_ids: [...profile.required_connectors],
    unsupported_connector: null,
    action: recipeAction(profile, recipeInputs),
    schedule_cron: schedule,
    output_template: profile.output_contract,
    template_config: templateConfiguration(profile.output_contract),
    safety_level: profile.safety_level,
    risk_level: "low",
    permissions_needed: connectorPermissions(profile.required_connectors),
    realtime_enabled: false,
    response_limit: profile.response_limit,
    recipe_version: profile.version,
    prompt_profile_version: profile.prompt_profile_version,
    recipe_inputs: recipeInputs,
    ...(githubRepositories[0]
      ? { github_repository: githubRepositories[0] }
      : {}),
    ...(draftPlatform === "twitter" ||
    draftPlatform === "linkedin" ||
    draftPlatform === "reddit" ||
    draftPlatform === "generic"
      ? { draft_platform: draftPlatform }
      : {})
  } as ParsedIntent;
}

function customizeRecipeInputsFromPrompt(
  profile: AgentRecipeProfileV1,
  inputs: Record<string, unknown>,
  prompt?: string
): Record<string, unknown> {
  if (!prompt?.trim() || !NEWS_RECIPES.has(profile.id)) return inputs;
  if (prompt.trim() === profile.display.example_prompt.trim()) return inputs;

  const topics = newsTopicsFromPrompt(prompt);
  if (topics.length === 0) return inputs;

  const lowerTopics = topics.join(" ").toLowerCase();
  const categories = /\b(?:fifa|football|soccer|sport|sports)\b/.test(lowerTopics)
    ? ["sports"]
    : /\b(?:ai|artificial intelligence|machine learning|technology|tech)\b/.test(
          lowerTopics
        )
      ? ["technology"]
      : inputs.categories;
  const lowerPrompt = prompt.toLowerCase();
  const hasLocal = /\blocal\s+news\b/.test(lowerPrompt);
  const removesGlobal =
    /\b(?:replace|remove)\s+(?:the\s+)?global\s+news\b/.test(lowerPrompt) ||
    /\binstead\s+of\s+(?:the\s+)?global\s+news\b/.test(lowerPrompt);
  const hasGlobal =
    /\bglobal\s+news\b/.test(lowerPrompt) && !removesGlobal;
  const geography = hasLocal && hasGlobal
    ? "local and global"
    : hasLocal
      ? "local plus topic-relevant coverage"
      : hasGlobal
        ? "global"
        : "topic-relevant";

  return {
    ...inputs,
    topics,
    ...(categories ? { categories } : {}),
    geography
  };
}

export function newsTopicsFromPrompt(prompt: string): string[] {
  const topics: string[] = [];
  const generic = new Set([
    "agent",
    "brief",
    "briefing",
    "breaking",
    "current",
    "daily",
    "digest",
    "general",
    "global",
    "headline",
    "headlines",
    "latest",
    "local",
    "news",
    "rank",
    "ranks",
    "research",
    "researches",
    "summarize",
    "summarizes",
    "top",
    "update",
    "updates",
    "world"
  ]);
  const add = (raw: string): void => {
    let candidate = raw
      .split(/\band\b/i)
      .at(-1)!
      .replace(
        /^(?:please\s+)?(?:build|create|deliver|give|make|send|set\s+up)\s+(?:me\s+)?(?:(?:a|an|the)\s+)?/i,
        ""
      )
      .replace(
        /^i\s+(?:need|want|would\s+like)\s+(?:(?:a|an|the)\s+)?/i,
        ""
      )
      .replace(
        /^(?:(?:a|an|about|breaking|current|daily|latest|the|top|with)\s+)+/i,
        ""
      )
      .replace(
        /(?:\s+(?:every|daily|at\b|\d{1,2}(?::\d{2})?\s*(?:am|pm)?|morning|evening|weekly|each\s+day|each\s+morning|every\s+day).*)*$/i,
        ""
      )
      .trim();
    if (candidate.split(/\s+/).length > 4) return;
    const lastWord = candidate.split(/\s+/).at(-1)?.toLowerCase() ?? "";
    if (
      !candidate ||
      generic.has(candidate.toLowerCase()) ||
      generic.has(lastWord)
    ) {
      return;
    }
    candidate = candidate.replace(/\bai\b/gi, "AI");
    if (
      !topics.some(
        (topic) => topic.toLowerCase() === candidate.toLowerCase()
      )
    ) {
      topics.push(candidate);
    }
  };

  for (const match of prompt.matchAll(
    /\b([a-z][a-z0-9+.#/-]*(?:\s+[a-z][a-z0-9+.#/-]*){0,2})\s+(?:news|headlines?|briefing|updates?|digest)\b/gi
  )) {
    if (match[1]) add(match[1]);
  }
  const about = prompt.match(
    /\b(?:news|headlines?|briefing|updates?|digest)\s+(?:about|on|covering|focused\s+on|for|regarding|in|related\s+to)\s+([^.,;\n]{1,80})/i
  );
  if (about?.[1]) add(about[1]);

  const directAbout = prompt.match(
    /\b(?:about|on|covering|focused\s+on|regarding)\s+([^.,;\n]{1,80})/i
  );
  if (topics.length === 0 && directAbout?.[1]) add(directAbout[1]);

  return topics.slice(0, 6);
}

function recipeAction(
  profile: AgentRecipeProfileV1,
  recipeInputs: Record<string, unknown>
): string {
  if (NEWS_RECIPES.has(profile.id) && Array.isArray(recipeInputs.topics)) {
    const topics = recipeInputs.topics.filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    );
    if (
      topics.length > 0 &&
      !(topics.length === 1 && topics[0]!.toLowerCase() === "top stories")
    ) {
      return `Researches and ranks a current-news briefing focused on ${topics.join(", ")}.`;
    }
  }
  return profile.action;
}

export function compileAgentRecipe(input: {
  recipeId: string;
  recipeVersion?: number;
  recipeInputs?: Record<string, unknown>;
  prompt?: string;
}): {
  parsedIntent: ParsedIntent;
  definition: AgentDefinitionV1;
  prompt: string;
} {
  const parsedIntent = parsedIntentForRecipe(input);
  const prompt = input.prompt?.trim() || getAgentRecipeProfile(
    input.recipeId,
    input.recipeVersion
  ).display.example_prompt;
  return {
    parsedIntent,
    definition: compileAgentDefinition(parsedIntent, prompt),
    prompt
  };
}

export function validateCompiledDefinition(
  value: unknown
): AgentDefinition {
  const definition = isV2Definition(value)
    ? agentDefinitionV2Schema.parse(value)
    : agentDefinitionV1Schema.parse(value);
  const runtime = runtimeDefinition(definition);
  getOutputContract(runtime.output.contract);
  for (const step of runtime.steps) {
    validateCapabilityStep({
      step,
      trigger: runtime.trigger,
      safetyLevel: runtime.policy.safety_level
    });
  }
  const outputStep = runtime.steps.find(
    (step) => step.id === runtime.output.from_step
  )!;
  const outputCapability = getCapabilityDefinition(outputStep.capability);
  if (
    runtime.metadata.recipe_id &&
    runtime.metadata.recipe_version &&
    runtime.metadata.prompt_profile_version
  ) {
    const profile = getAgentRecipeProfile(
      runtime.metadata.recipe_id,
      runtime.metadata.recipe_version
    );
    recipePromptProfile(
      profile,
      runtime.metadata.prompt_profile_version
    );
    if (profile.capability !== outputStep.capability) {
      throw new Error("The recipe cannot change its registered capability.");
    }
    if (profile.output_contract !== runtime.output.contract) {
      throw new Error("The recipe cannot change its output contract.");
    }
    if (
      safetyLevelRank(runtime.policy.safety_level) >
      safetyLevelRank(profile.safety_level)
    ) {
      throw new Error("The recipe cannot increase its registered safety level.");
    }
    validateRecipeInputs(profile, runtime.metadata.recipe_inputs);
  }
  if (
    outputCapability.requiredConnectors(outputStep.config).some(
      (connector) =>
        !isRegisteredConnectorId(connector)
    )
  ) {
    throw new Error("A capability requested an unregistered connector.");
  }
  return definition;
}

export function definitionToParsedIntent(
  definition: AgentDefinition,
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
  const requiredAccess = definition.schema_version === 2
    ? definition.required_access
    : capability.requiredAccess(config);
  const connectors = Array.isArray(config.connector_ids)
    ? config.connector_ids.filter(
        (connector): connector is string => typeof connector === "string"
      )
    : [];
  const recipeId =
    definition.metadata.recipe_id ??
    String(config.recipe_id ?? "custom_read_agent");
  return {
    name: input.name,
    avatar: input.avatar,
    intent: recipeId,
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
    required_access: requiredAccess,
    realtime_enabled: definition.trigger.type === "event",
    supports_realtime: supportsRealtimeAgentIntent(recipeId),
    response_limit: definition.policy.response_limit,
    ...(definition.policy.active_until
      ? { active_until: definition.policy.active_until }
      : {}),
    ...(typeof config.github_repository === "string"
      ? { github_repository: config.github_repository }
      : {}),
    ...(definition.metadata.recipe_version
      ? { recipe_version: definition.metadata.recipe_version }
      : {}),
    ...(definition.metadata.prompt_profile_version
      ? { prompt_profile_version: definition.metadata.prompt_profile_version }
      : {}),
    ...(definition.metadata.recipe_inputs
      ? { recipe_inputs: definition.metadata.recipe_inputs }
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
  definition: AgentDefinition,
  input: { name?: string; avatar?: string } = {}
): Record<string, unknown> {
  const outputStep = definition.steps.find(
    (step) => step.id === definition.output.from_step
  )!;
  const connectors = getCapabilityDefinition(
    outputStep.capability
  ).requiredConnectors(outputStep.config);
  const requiredAccess = definition.schema_version === 2
    ? definition.required_access
    : getCapabilityDefinition(outputStep.capability).requiredAccess(outputStep.config);
  const recipeId =
    definition.metadata.recipe_id ??
    String(outputStep.config.recipe_id ?? "custom_read_agent");
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
        getCapabilityDefinition(step.capability).requiredConnectors(step.config),
      required_access:
        getCapabilityDefinition(step.capability).requiredAccess(step.config)
    })),
    output: definition.output,
    interaction: definition.interaction,
    policy: definition.policy,
    recipe_id: definition.metadata.recipe_id,
    supports_realtime: supportsRealtimeAgentIntent(recipeId),
    supported_trigger_types: supportsRealtimeAgentIntent(recipeId)
      ? ["manual", "schedule", "event"]
      : ["manual", "schedule"],
    recipe_version: definition.metadata.recipe_version,
    prompt_profile_version: definition.metadata.prompt_profile_version,
    recipe_inputs: definition.metadata.recipe_inputs,
    permissions_needed: connectorPermissions(connectors),
    required_access: requiredAccess
  };
}

function isV2Definition(value: unknown): value is AgentDefinitionV2 {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as Record<string, unknown>).schema_version === 2
  );
}

function runtimeDefinition(definition: AgentDefinition): AgentDefinitionV1 {
  return definition.schema_version === 2
    ? { ...definition, schema_version: 1 } as AgentDefinitionV1
    : definition;
}

function capabilityForRecipe(recipe: string): CapabilityId {
  if (hasAgentRecipeProfile(recipe)) {
    return getAgentRecipeProfile(recipe).capability;
  }
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

function inferredRecipeInputs(
  profile: AgentRecipeProfileV1,
  parsedIntent: ParsedIntent
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const field of profile.fields) {
    if (field.id === "schedule" && parsedIntent.schedule_cron) {
      inputs.schedule = parsedIntent.schedule_cron;
    }
  }
  return inputs;
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

function draftPlatformForRecipe(
  recipe: string,
  recipeInputs: Record<string, unknown>
): "twitter" | "linkedin" | "reddit" | "generic" | undefined {
  if (recipe !== "content_extractor") return undefined;
  const platform = recipeInputs.platform;
  return platform === "twitter" ||
    platform === "linkedin" ||
    platform === "reddit" ||
    platform === "generic"
    ? platform
    : undefined;
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
        .map(
          (connector) =>
            permissions[connector] ??
            (isRegisteredMcpConnectorId(connector)
              ? "Connected MCP provider read access"
              : undefined)
        )
        .filter((permission): permission is string => Boolean(permission))
    )
  ];
}

function isRegisteredConnectorId(connector: string): boolean {
  return new Set([
    "gmail",
    "drive",
    "calendar",
    "github",
    "slack",
    "notion",
    "web_search"
  ]).has(connector) || isRegisteredMcpConnectorId(connector);
}

function isRegisteredMcpConnectorId(connector: string): boolean {
  return /^mcp\.[a-z][a-z0-9_.:-]{1,119}$/i.test(connector);
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

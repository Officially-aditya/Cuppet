import { z } from "zod";
import type {
  AgentDefinitionStep,
  AgentSafetyLevel,
  AgentTrigger
} from "./definition.js";
import { safetyLevelRank } from "./definition.js";
import {
  githubRepositoryMatches,
  githubRepositoryScope
} from "../github-scope.js";

export type CapabilityId =
  | "briefing.compose"
  | "connector.digest"
  | "content.ideas"
  | "deterministic.report"
  | "dsa.generate"
  | "news.research"
  | "portfolio.watch"
  | "reminder.deliver"
  | "study.guide"
  | "custom.report";

export type CapabilityResult = {
  content: unknown;
  sourceRefs: unknown[];
  tokensUsed: number;
  additionalTopicsCovered?: string[];
  stateEvents?: Array<{
    type: "history.set" | "topics.add" | "topics.remove" | "current_chunk.set";
    key?: string;
    value?: unknown;
  }>;
};

export type CapabilityExecutionContext = {
  step: AgentDefinitionStep;
  invokeAdapter: (capability: CapabilityId) => Promise<CapabilityResult>;
};

export type CapabilityDefinition = {
  id: CapabilityId;
  version: "1.0";
  configSchema: z.ZodTypeAny;
  resultSchema: z.ZodTypeAny;
  requiredConnectors: (config: Record<string, unknown>) => string[];
  allowedTriggerTypes: Array<AgentTrigger["type"]>;
  maximumSafetyLevel: AgentSafetyLevel;
  allowedRecipeIds: readonly string[] | null;
  handler: (context: CapabilityExecutionContext) => Promise<CapabilityResult>;
  eventMatcher?: (
    config: Record<string, unknown>,
    event: { source: string; eventType: string; payload: Record<string, unknown> }
  ) => boolean;
  stateReducer?: (
    state: Record<string, unknown>,
    events: NonNullable<CapabilityResult["stateEvents"]>
  ) => Record<string, unknown>;
  chatProfile?: {
    grounded: boolean;
    scheduledFreshResearch: boolean;
    explicitSearchOnly: boolean;
  };
};

const adapterConfigSchema = z
  .object({
    recipe_id: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
    prompt: z.string().min(1).max(4000),
    action: z.string().min(1).max(4000),
    connector_ids: z.array(z.string()).max(8).default([]),
    output_contract: z.string(),
    response_limit: z.enum(["concise", "balanced", "detailed"]).optional(),
    github_repository: z.string().optional(),
    platform: z.enum(["twitter", "linkedin", "reddit", "generic"]).optional()
  })
  .strict();

const capabilityResultSchema = z
  .object({
    content: z.unknown(),
    sourceRefs: z.array(z.unknown()),
    tokensUsed: z.number().int().nonnegative(),
    additionalTopicsCovered: z.array(z.string()).optional(),
    stateEvents: z
      .array(
        z
          .object({
            type: z.enum([
              "history.set",
              "topics.add",
              "topics.remove",
              "current_chunk.set"
            ]),
            key: z.string().optional(),
            value: z.unknown().optional()
          })
          .strict()
      )
      .optional()
  })
  .strict();

function adapterCapability(
  input: Omit<CapabilityDefinition, "version" | "configSchema" | "resultSchema" | "handler">
): CapabilityDefinition {
  return {
    ...input,
    version: "1.0",
    configSchema: adapterConfigSchema,
    resultSchema: capabilityResultSchema,
    handler: (context) => context.invokeAdapter(input.id)
  };
}

const capabilities: CapabilityDefinition[] = [
  adapterCapability({
    id: "briefing.compose",
    requiredConnectors: connectorIds,
    allowedTriggerTypes: ["manual", "schedule"],
    maximumSafetyLevel: "read",
    allowedRecipeIds: [
      "daily_executive_briefing",
      "project_pulse",
      "meeting_intelligence",
      "weekly_accomplishment_report"
    ],
    chatProfile: {
      grounded: true,
      scheduledFreshResearch: false,
      explicitSearchOnly: true
    }
  }),
  adapterCapability({
    id: "connector.digest",
    requiredConnectors: connectorIds,
    allowedTriggerTypes: ["manual", "schedule", "event"],
    maximumSafetyLevel: "read",
    allowedRecipeIds: [
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
    ],
    chatProfile: {
      grounded: true,
      scheduledFreshResearch: false,
      explicitSearchOnly: true
    },
    eventMatcher: connectorEventMatcher
  }),
  adapterCapability({
    id: "content.ideas",
    requiredConnectors: connectorIds,
    allowedTriggerTypes: ["manual", "schedule"],
    maximumSafetyLevel: "read",
    allowedRecipeIds: ["content_extractor"],
    chatProfile: {
      grounded: true,
      scheduledFreshResearch: true,
      explicitSearchOnly: true
    }
  }),
  adapterCapability({
    id: "deterministic.report",
    requiredConnectors: connectorIds,
    allowedTriggerTypes: ["manual", "schedule"],
    maximumSafetyLevel: "read",
    allowedRecipeIds: [
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
    ],
    chatProfile: {
      grounded: true,
      scheduledFreshResearch: false,
      explicitSearchOnly: true
    }
  }),
  adapterCapability({
    id: "dsa.generate",
    requiredConnectors: connectorIds,
    allowedTriggerTypes: ["manual", "schedule"],
    maximumSafetyLevel: "read",
    allowedRecipeIds: ["dsa_question"],
    chatProfile: {
      grounded: true,
      scheduledFreshResearch: false,
      explicitSearchOnly: true
    }
  }),
  adapterCapability({
    id: "news.research",
    requiredConnectors: connectorIds,
    allowedTriggerTypes: ["manual", "schedule"],
    maximumSafetyLevel: "read",
    allowedRecipeIds: [
      "tech_news_brief",
      "news_brief",
      "job_market_radar",
      "web_search_agent"
    ],
    chatProfile: {
      grounded: true,
      scheduledFreshResearch: true,
      explicitSearchOnly: true
    }
  }),
  adapterCapability({
    id: "portfolio.watch",
    requiredConnectors: connectorIds,
    allowedTriggerTypes: ["manual", "schedule", "event"],
    maximumSafetyLevel: "read",
    allowedRecipeIds: ["portfolio_watch"],
    chatProfile: {
      grounded: true,
      scheduledFreshResearch: true,
      explicitSearchOnly: true
    },
    eventMatcher: (_config, event) =>
      event.source === "stock" &&
      event.payload.threshold_crossed === true
  }),
  adapterCapability({
    id: "reminder.deliver",
    requiredConnectors: connectorIds,
    allowedTriggerTypes: ["manual", "schedule"],
    maximumSafetyLevel: "read",
    allowedRecipeIds: ["scheduled_reminder"],
    chatProfile: {
      grounded: true,
      scheduledFreshResearch: true,
      explicitSearchOnly: true
    }
  }),
  adapterCapability({
    id: "study.guide",
    requiredConnectors: connectorIds,
    allowedTriggerTypes: ["manual", "schedule"],
    maximumSafetyLevel: "read",
    allowedRecipeIds: ["study_plan"],
    chatProfile: {
      grounded: true,
      scheduledFreshResearch: false,
      explicitSearchOnly: true
    }
  }),
  adapterCapability({
    id: "custom.report",
    requiredConnectors: connectorIds,
    allowedTriggerTypes: ["manual", "schedule"],
    maximumSafetyLevel: "read",
    allowedRecipeIds: null,
    chatProfile: {
      grounded: true,
      scheduledFreshResearch: true,
      explicitSearchOnly: true
    }
  })
];

const capabilityRegistry = new Map(
  capabilities.map((capability) => [capability.id, capability])
);

export function getCapabilityDefinition(id: string): CapabilityDefinition {
  const capability = capabilityRegistry.get(id as CapabilityId);
  if (!capability) {
    throw new Error(`Unsupported capability: ${id}`);
  }
  return capability;
}

export function listCapabilityDefinitions(): readonly CapabilityDefinition[] {
  return capabilities;
}

export function validateCapabilityStep(input: {
  step: AgentDefinitionStep;
  trigger: AgentTrigger;
  safetyLevel: AgentSafetyLevel;
}): Record<string, unknown> {
  const capability = getCapabilityDefinition(input.step.capability);
  if (input.step.capability_version !== capability.version) {
    throw new Error(
      `Unsupported capability version: ${input.step.capability}@${input.step.capability_version}`
    );
  }
  if (!capability.allowedTriggerTypes.includes(input.trigger.type)) {
    throw new Error(
      `Capability ${capability.id} does not support ${input.trigger.type} triggers.`
    );
  }
  if (
    safetyLevelRank(input.safetyLevel) >
    safetyLevelRank(capability.maximumSafetyLevel)
  ) {
    throw new Error(
      `Capability ${capability.id} cannot run at safety level ${input.safetyLevel}.`
    );
  }
  const config = capability.configSchema.parse(input.step.config);
  const recipeId = String(config.recipe_id ?? "");
  if (
    capability.allowedRecipeIds &&
    !capability.allowedRecipeIds.includes(recipeId)
  ) {
    throw new Error(
      `Capability ${capability.id} does not support recipe ${recipeId}.`
    );
  }
  return config;
}

function connectorIds(config: Record<string, unknown>): string[] {
  return Array.isArray(config.connector_ids)
    ? config.connector_ids.filter(
        (connector): connector is string => typeof connector === "string"
      )
    : [];
}

function connectorEventMatcher(
  config: Record<string, unknown>,
  event: { source: string; eventType: string; payload: Record<string, unknown> }
): boolean {
  const recipe = String(config.recipe_id ?? "");
  if (event.source === "slack") {
    if (recipe !== "slack_urgent_watcher") return false;
    const text = String(event.payload.text ?? "");
    return (
      event.eventType === "slack.app_mention" ||
      /\b(urgent|asap|blocker|blocked|critical|incident|outage|deadline)\b/i.test(
        text
      )
    );
  }
  if (event.source === "github") {
    if (recipe !== "github_activity_digest") return false;
    const supported = [
      "push",
      "pull_request",
      "issues",
      "release",
      "workflow_run"
    ].some((type) => event.eventType === `github.${type}`);
    if (!supported) return false;
    return githubRepositoryMatches(
      githubRepositoryScope(config, String(config.prompt ?? "")),
      event.payload.repository
    );
  }
  if (event.source === "gmail") return recipe === "lead_response_monitor";
  if (event.source === "calendar") return recipe === "calendar_agenda";
  if (event.source === "drive") {
    return ["drive_summary", "pdf_summary", "meeting_recap"].includes(recipe);
  }
  return false;
}

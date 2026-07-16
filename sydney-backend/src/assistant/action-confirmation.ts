import { z } from "zod";
import type { AssistantRoute } from "./router.js";

export const lowConfidenceActionThreshold = 0.8;

const connectorId = z.enum([
  "gmail",
  "calendar",
  "drive",
  "github",
  "slack",
  "notion"
]);

const confirmableRouteSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("memory_list") }).strict(),
  z
    .object({
      kind: z.literal("memory_forget"),
      target: z.string().trim().min(1).max(160),
      all: z.boolean()
    })
    .strict(),
  z
    .object({
      kind: z.literal("agent_list"),
      target: z.string().trim().min(1).max(160).optional(),
      countOnly: z.boolean().optional()
    })
    .strict(),
  z
    .object({
      kind: z.literal("agent_manage"),
      operation: z.enum(["pause", "resume", "run", "delete"]),
      target: z.string().trim().min(1).max(160)
    })
    .strict(),
  z
    .object({
      kind: z.literal("agent_rename"),
      target: z.string().trim().min(1).max(160),
      name: z.string().trim().min(1).max(80)
    })
    .strict(),
  z
    .object({
      kind: z.literal("agent_update"),
      target: z.string().trim().min(1).max(160),
      description: z.string().trim().min(1).max(1000)
    })
    .strict(),
  z.object({ kind: z.literal("create_agent") }).strict(),
  z
    .object({
      kind: z.literal("connector_query"),
      connectors: z.array(connectorId).min(1).max(3)
    })
    .strict()
]);

export type ConfirmableAssistantRoute = z.infer<
  typeof confirmableRouteSchema
>;

export type AssistantActionSummary = {
  label: string;
  detail: string;
};

export function confirmableRouteFor(
  route: AssistantRoute
): ConfirmableAssistantRoute | null {
  const parsed = confirmableRouteSchema.safeParse(route);
  return parsed.success ? parsed.data : null;
}

export function requiresActionConfirmation(
  route: AssistantRoute,
  confidence: number
): boolean {
  return (
    Number.isFinite(confidence) &&
    confidence < lowConfidenceActionThreshold &&
    confirmableRouteFor(route) !== null
  );
}

export function confirmedAssistantRoute(
  value: unknown
): ConfirmableAssistantRoute | null {
  const parsed = confirmableRouteSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function assistantActionSummary(
  route: ConfirmableAssistantRoute
): AssistantActionSummary {
  switch (route.kind) {
    case "memory_list":
      return {
        label: "Review what Cuppet remembers",
        detail: "Show your active confirmed memories and compacted summary."
      };
    case "memory_forget":
      return route.all
        ? {
            label: "Forget every Assistant memory",
            detail: "A separate destructive confirmation will still be required."
          }
        : {
            label: `Forget memories matching “${route.target}”`,
            detail: "Remove matching active and compacted memory entries."
          };
    case "agent_list":
      if (route.target) {
        return {
          label: `Check the status of ${route.target}`,
          detail: "Read the matching agent’s current status and schedule."
        };
      }
      return route.countOnly
        ? {
            label: "Count your specialist agents",
            detail: "Read the number of agents currently in your account."
          }
        : {
            label: "List your specialist agents",
            detail: "Show the actual agents currently in your account."
          };
    case "agent_manage":
      return {
        label: `${capitalize(route.operation)} ${route.target}`,
        detail:
          route.operation === "delete"
            ? "A separate destructive confirmation will still be required."
            : `Apply the ${route.operation} action to this agent.`
      };
    case "agent_rename":
      return {
        label: `Rename ${route.target} to ${route.name}`,
        detail: "Change the selected agent’s visible name."
      };
    case "agent_update":
      return {
        label: `Update ${route.target}`,
        detail: route.description
      };
    case "create_agent":
      return {
        label: "Create a new specialist agent",
        detail: "Build an agent from your original request and add it to your inbox."
      };
    case "connector_query":
      return {
        label: `Read connected ${route.connectors.map(connectorName).join(" and ")} data`,
        detail: "Use only those connected services to answer your original request."
      };
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function connectorName(value: string): string {
  const names: Record<string, string> = {
    gmail: "Gmail",
    calendar: "Calendar",
    drive: "Drive",
    github: "GitHub",
    slack: "Slack",
    notion: "Notion"
  };
  return names[value] ?? value;
}

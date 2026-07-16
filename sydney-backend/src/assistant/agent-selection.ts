import { z } from "zod";
import type { AssistantRoute } from "./router.js";

const selectionIntentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("agent_status") }).strict(),
  z
    .object({
      kind: z.literal("agent_manage"),
      operation: z.enum(["pause", "resume", "run", "delete"])
    })
    .strict(),
  z
    .object({
      kind: z.literal("agent_rename"),
      name: z.string().trim().min(1).max(80)
    })
    .strict(),
  z
    .object({
      kind: z.literal("agent_update"),
      description: z.string().trim().min(1).max(1000)
    })
    .strict()
]);

export type AgentSelectionIntent = z.infer<typeof selectionIntentSchema>;

export function selectionIntentForRoute(
  route: AssistantRoute
): AgentSelectionIntent | null {
  if (route.kind === "agent_list" && route.target) {
    return { kind: "agent_status" };
  }
  if (route.kind === "agent_manage") {
    return { kind: "agent_manage", operation: route.operation };
  }
  if (route.kind === "agent_rename") {
    return { kind: "agent_rename", name: route.name };
  }
  if (route.kind === "agent_update") {
    return { kind: "agent_update", description: route.description };
  }
  return null;
}

export function selectedAgentRoute(
  value: unknown,
  selectedAgentName: string
): AssistantRoute | null {
  const parsed = selectionIntentSchema.safeParse(value);
  if (!parsed.success) return null;
  const intent = parsed.data;
  switch (intent.kind) {
    case "agent_status":
      return { kind: "agent_list", target: selectedAgentName };
    case "agent_manage":
      return {
        kind: "agent_manage",
        operation: intent.operation,
        target: selectedAgentName
      };
    case "agent_rename":
      return {
        kind: "agent_rename",
        target: selectedAgentName,
        name: intent.name
      };
    case "agent_update":
      return {
        kind: "agent_update",
        target: selectedAgentName,
        description: intent.description
      };
  }
}

export function agentSelectionQuestion(intent: AgentSelectionIntent): string {
  switch (intent.kind) {
    case "agent_status":
      return "Which agent should I check?";
    case "agent_manage":
      return `Which agent should I ${intent.operation}?`;
    case "agent_rename":
      return `Which agent should I rename to ${intent.name}?`;
    case "agent_update":
      return "Which agent should I update?";
  }
}

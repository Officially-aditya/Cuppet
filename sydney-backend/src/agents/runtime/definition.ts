import { z } from "zod";

export const agentSafetyLevelSchema = z.enum(["read", "suggest", "act"]);
export type AgentSafetyLevel = z.infer<typeof agentSafetyLevelSchema>;

export const agentTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("manual") }).strict(),
  z
    .object({
      type: z.literal("schedule"),
      cron: z.string().trim().regex(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/)
    })
    .strict(),
  z
    .object({
      type: z.literal("event"),
      source: z.enum(["slack", "github", "gmail", "calendar", "drive", "stock"]),
      filter: z.record(z.unknown()).default({}),
      cooldown_seconds: z.number().int().min(30).max(86_400)
    })
    .strict()
]);

export const agentStepSchema = z
  .object({
    id: z.string().trim().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    capability: z.string().trim().regex(/^[a-z][a-z0-9_.-]{1,79}$/),
    capability_version: z.literal("1.0"),
    depends_on: z.array(z.string()).max(8).default([]),
    config: z.record(z.unknown()).default({})
  })
  .strict();

export const agentDefinitionV1Schema = z
  .object({
    schema_version: z.literal(1),
    goal: z.string().trim().min(3).max(4000),
    instructions: z.array(z.string().trim().min(1).max(4000)).max(24),
    trigger: agentTriggerSchema,
    steps: z.array(agentStepSchema).min(1).max(8),
    output: z
      .object({
        contract: z.string().trim().regex(/^[a-z][a-z0-9_]{1,79}$/),
        contract_version: z.literal("1.0"),
        from_step: z.string(),
        options: z.record(z.unknown()).default({})
      })
      .strict(),
    interaction: z
      .object({
        follow_up_mode: z.enum(["grounded", "conversational"]),
        draft_platform: z
          .enum(["twitter", "linkedin", "reddit", "generic"])
          .optional(),
        allowed_message_actions: z
          .array(
            z.enum([
              "done",
              "snooze",
              "skip",
              "draft",
              "open_in_assistant",
              "connector_connect"
            ])
          )
          .max(12)
      })
      .strict(),
    policy: z
      .object({
        safety_level: agentSafetyLevelSchema,
        response_limit: z.enum(["concise", "balanced", "detailed"]),
        notifications_muted: z.boolean(),
        active_until: z.string().datetime().nullable()
      })
      .strict(),
    metadata: z
      .object({
        recipe_id: z.string().trim().regex(/^[a-z][a-z0-9_]{1,79}$/).optional(),
        recipe_version: z.number().int().positive().optional(),
        prompt_profile_version: z.number().int().positive().optional(),
        recipe_inputs: z.record(z.unknown()).optional()
      })
      .strict()
  })
  .strict()
  .superRefine((definition, context) => {
    const stepIds = new Set<string>();
    for (const [index, step] of definition.steps.entries()) {
      if (stepIds.has(step.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "id"],
          message: `Duplicate step id: ${step.id}`
        });
      }
      for (const dependency of step.depends_on) {
        if (!stepIds.has(dependency)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["steps", index, "depends_on"],
            message: `Step dependency must refer to an earlier step: ${dependency}`
          });
        }
      }
      stepIds.add(step.id);
    }
    if (!stepIds.has(definition.output.from_step)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["output", "from_step"],
        message: "Output must reference a defined step."
      });
    }
  });

export type AgentDefinitionV1 = z.infer<typeof agentDefinitionV1Schema>;
export type AgentDefinitionStep = AgentDefinitionV1["steps"][number];
export type AgentTrigger = AgentDefinitionV1["trigger"];

export function parseAgentDefinitionV1(value: unknown): AgentDefinitionV1 {
  return agentDefinitionV1Schema.parse(value);
}

export function safetyLevelRank(level: AgentSafetyLevel): number {
  return { read: 0, suggest: 1, act: 2 }[level];
}

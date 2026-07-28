import type {
  AgentDefinitionV1,
  AgentDefinitionV2,
  AgentDefinitionStep
} from "./definition.js";
import {
  getCapabilityDefinition,
  validateCapabilityStep,
  type CapabilityId,
  type CapabilityResult
} from "./capability-registry.js";
import { normalizeAndValidateOutput } from "./output-registry.js";

export async function executeAgentDefinition(input: {
  definition: AgentDefinitionV1 | AgentDefinitionV2;
  invokeAdapter: (
    capability: CapabilityId,
    step: AgentDefinitionStep
  ) => Promise<CapabilityResult>;
  preflightAccess?: (requirements: AgentDefinitionV2["required_access"]) => Promise<void>;
}): Promise<CapabilityResult> {
  if (input.definition.schema_version === 2 && input.preflightAccess) {
    await input.preflightAccess(input.definition.required_access);
  }
  const definition = input.definition.schema_version === 2
    ? { ...input.definition, schema_version: 1 } as AgentDefinitionV1
    : input.definition;
  const results = new Map<string, CapabilityResult>();
  for (const step of definition.steps) {
    validateCapabilityStep({
      step,
      trigger: definition.trigger,
      safetyLevel: definition.policy.safety_level
    });
    for (const dependency of step.depends_on) {
      if (!results.has(dependency)) {
        throw new Error(
          `Capability step ${step.id} is missing dependency ${dependency}.`
        );
      }
    }
    const capability = getCapabilityDefinition(step.capability);
    const result = capability.resultSchema.parse(
      await capability.handler({
        step,
        invokeAdapter: (requested) => input.invokeAdapter(requested, step)
      })
    ) as CapabilityResult;
    results.set(step.id, result);
  }

  const output = results.get(definition.output.from_step);
  if (!output) throw new Error("The configured output step did not execute.");
  const content = normalizeAndValidateOutput(
    output.content as { template: string; version: string; data: unknown }
  );
  // Adapters preserve existing wire contracts during the foundation release.
  // The configured contract is still validated and exposed, while a handful of
  // legacy deterministic fallbacks can retain their historic registered shape.
  return { ...output, content };
}

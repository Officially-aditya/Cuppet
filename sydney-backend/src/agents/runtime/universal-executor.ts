import type { AgentDefinitionV1, AgentDefinitionStep } from "./definition.js";
import {
  getCapabilityDefinition,
  validateCapabilityStep,
  type CapabilityId,
  type CapabilityResult
} from "./capability-registry.js";
import { normalizeAndValidateOutput } from "./output-registry.js";

export async function executeAgentDefinition(input: {
  definition: AgentDefinitionV1;
  invokeAdapter: (
    capability: CapabilityId,
    step: AgentDefinitionStep
  ) => Promise<CapabilityResult>;
}): Promise<CapabilityResult> {
  const results = new Map<string, CapabilityResult>();
  for (const step of input.definition.steps) {
    validateCapabilityStep({
      step,
      trigger: input.definition.trigger,
      safetyLevel: input.definition.policy.safety_level
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

  const output = results.get(input.definition.output.from_step);
  if (!output) throw new Error("The configured output step did not execute.");
  const content = normalizeAndValidateOutput(
    output.content as { template: string; version: string; data: unknown }
  );
  // Adapters preserve existing wire contracts during the foundation release.
  // The configured contract is still validated and exposed, while a handful of
  // legacy deterministic fallbacks can retain their historic registered shape.
  return { ...output, content };
}

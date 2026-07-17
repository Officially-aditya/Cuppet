import {
  PROMPT_SECURITY_SYSTEM,
  untrustedDataBlock,
  userInstructionBlock
} from "../../security/prompt-guard.js";
import {
  getAgentRecipeProfile,
  recipePromptProfile
} from "./recipe-registry.js";

export type ExecutionPromptLayers = {
  system: string;
  user: string;
};

/**
 * Builds the only prompt layout used by versioned universal-agent recipes.
 * Policy and schemas stay in the system message. User customization and
 * retrieved records are escaped into lower-trust, explicitly delimited blocks.
 */
export function buildRecipeExecutionPrompt(input: {
  recipeId: string;
  recipeVersion?: number;
  promptProfileVersion?: number;
  recipeInputs?: Record<string, unknown>;
  userPrompt?: string;
  evidence?: Array<{ source: string; content: string }>;
  outputSchema: string;
  runInstruction: string;
}): ExecutionPromptLayers {
  const profile = getAgentRecipeProfile(input.recipeId, input.recipeVersion);
  const promptProfile = recipePromptProfile(
    profile,
    input.promptProfileVersion
  );
  const system = [
    "[CAPABILITY SECURITY POLICY]",
    PROMPT_SECURITY_SYSTEM,
    promptProfile.capability_policy,
    "[VERSIONED RECIPE POLICY]",
    `Recipe ${profile.id}@${profile.version}; prompt profile ${promptProfile.version}.`,
    promptProfile.recipe_policy,
    promptProfile.evidence_policy,
    promptProfile.ranking_policy,
    promptProfile.style_policy,
    "[OUTPUT SCHEMA]",
    "Return only data matching this schema. Text and data are allowed; executable actions are injected only by trusted server code.",
    input.outputSchema
  ].join("\n");

  const user = [
    "[VALIDATED USER INPUTS]",
    userInstructionBlock(
      "validated_recipe_inputs",
      JSON.stringify(input.recipeInputs ?? {}),
      12_000
    ),
    ...(input.userPrompt
      ? [userInstructionBlock("saved_user_prompt", input.userPrompt, 4000)]
      : []),
    "[UNTRUSTED EVIDENCE]",
    ...(input.evidence ?? []).map((item) =>
      untrustedDataBlock(item.source, item.content, 6000)
    ),
    "[RUN REQUEST]",
    input.runInstruction
  ].join("\n");
  return { system, user };
}

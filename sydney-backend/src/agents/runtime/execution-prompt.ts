import {
  PROMPT_SECURITY_SYSTEM,
  untrustedDataBlock,
  userInstructionBlock
} from "../../security/prompt-guard.js";
import {
  getAgentRecipeProfile,
  recipePromptProfile
} from "./recipe-registry.js";
import {
  responseLimitInstruction,
  responseStyleGuidance
} from "../parser.js";

export type ExecutionPromptLayers = {
  system: string;
  user: string;
};

export function adaptPolicyForResponseLimit(
  policy: string,
  responseLimit?: string
): string {
  if (!responseLimit) return policy;

  if (responseLimit === "detailed") {
    return policy
      .replace(/\bbe concise\b/gi, "be detailed, thorough, and comprehensive")
      .replace(/\bconcise agenda\b/gi, "detailed agenda")
      .replace(/\bconcise report\b/gi, "detailed report")
      .replace(/\bconcise digest\b/gi, "detailed digest")
      .replace(/\bconcise brief\b/gi, "detailed brief")
      .replace(/\bconcise\b/gi, "detailed and in-depth");
  }

  if (responseLimit === "balanced") {
    return policy
      .replace(/\bbe concise\b/gi, "be balanced and practical")
      .replace(/\bconcise agenda\b/gi, "balanced agenda")
      .replace(/\bconcise report\b/gi, "balanced report")
      .replace(/\bconcise digest\b/gi, "balanced digest")
      .replace(/\bconcise brief\b/gi, "balanced brief")
      .replace(/\bconcise\b/gi, "balanced");
  }

  if (responseLimit === "concise") {
    return policy
      .replace(/\bbe concise\b/gi, "be extremely concise and brief");
  }

  return policy;
}

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
  responseLimit?: string;
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
    adaptPolicyForResponseLimit(promptProfile.recipe_policy, input.responseLimit),
    promptProfile.evidence_policy,
    promptProfile.ranking_policy,
    adaptPolicyForResponseLimit(promptProfile.style_policy, input.responseLimit),
    input.responseLimit ? responseStyleGuidance(input.responseLimit) : "",
    input.responseLimit ? responseLimitInstruction(input.responseLimit) : "",
    "[OUTPUT SCHEMA]",
    "Return only data matching this schema. Text and data are allowed; executable actions are injected only by trusted server code.",
    input.outputSchema
  ]
    .filter(Boolean)
    .join("\n");

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

import {
  extractContentPlatformFromPrompt,
  extractNicheFromPrompt
} from "./parser.js";
import {
  getAgentRecipeProfile,
  hasAgentRecipeProfile,
  validateRecipeInputs
} from "./runtime/recipe-registry.js";

/**
 * A parser result contains defaults for every recipe field. During a natural-
 * language description edit, only carry forward values it actually inferred so
 * that omitted configuration is not reset to those defaults.
 */
export function mergeRecipeInputsForDescriptionUpdate(input: {
  previousIntent: RecipeUpdateIntent;
  reparsedIntent: RecipeUpdateIntent;
  description: string;
}): Record<string, unknown> {
  const previousInputs = recordValue(input.previousIntent.recipe_inputs);
  const reparsedInputs = recordValue(input.reparsedIntent.recipe_inputs);
  const recipeId = recipeIdFor(input.previousIntent, input.reparsedIntent);

  if (!recipeId || !hasAgentRecipeProfile(recipeId)) {
    return { ...previousInputs };
  }

  try {
    const profile = getAgentRecipeProfile(
      recipeId,
      positiveInteger(input.previousIntent.recipe_version) ??
        positiveInteger(input.reparsedIntent.recipe_version)
    );
    const defaults = validateRecipeInputs(profile, {});
    const updates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(reparsedInputs)) {
      if (!sameValue(value, defaults[key])) updates[key] = value;
    }

    if (profile.id === "content_extractor") {
      if (extractContentPlatformFromPrompt(input.description) !== null) {
        updates.platform = reparsedInputs.platform;
      }
      if (extractNicheFromPrompt(input.description) !== null) {
        updates.niche = reparsedInputs.niche;
      }
    }

    return { ...previousInputs, ...updates };
  } catch {
    // Preserve the working configuration if a legacy recipe version cannot be
    // resolved instead of replacing it with inferred defaults.
    return { ...previousInputs };
  }
}

function recipeIdFor(
  previousIntent: RecipeUpdateIntent,
  reparsedIntent: RecipeUpdateIntent
): string | null {
  if (typeof previousIntent.intent === "string") return previousIntent.intent;
  return typeof reparsedIntent.intent === "string"
    ? reparsedIntent.intent
    : null;
}

type RecipeUpdateIntent = {
  intent?: unknown;
  recipe_inputs?: unknown;
  recipe_version?: unknown;
};

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

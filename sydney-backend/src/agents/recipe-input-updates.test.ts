import assert from "node:assert/strict";
import test from "node:test";
import { parseIntent } from "./parser.js";
import { mergeRecipeInputsForDescriptionUpdate } from "./recipe-input-updates.js";

test("description edits update explicit content targeting without resetting saved fields", () => {
  const reparsed = parseIntent(
    "Create content drafts for r/gaming about gaming topics every morning."
  );
  const previousIntent = {
    intent: "content_extractor",
    recipe_version: reparsed.recipe_version,
    recipe_inputs: {
      ...reparsed.recipe_inputs,
      platform: "linkedin",
      niche: "application security",
      audience: "security leaders",
      voice: "technical and direct",
      content_pillars: ["threat modeling"],
      exclusions: ["vendor pitches"],
      freshness: "30_days"
    }
  };

  const merged = mergeRecipeInputsForDescriptionUpdate({
    previousIntent,
    reparsedIntent: reparsed,
    description:
      "Create content drafts for r/gaming about gaming topics every morning."
  });

  assert.equal(merged.platform, "reddit");
  assert.equal(merged.niche, "gaming");
  assert.equal(merged.audience, "security leaders");
  assert.equal(merged.voice, "technical and direct");
  assert.deepEqual(merged.content_pillars, ["threat modeling"]);
  assert.deepEqual(merged.exclusions, ["vendor pitches"]);
  assert.equal(merged.freshness, "30_days");
});

test("an explicitly named default platform still replaces the saved platform", () => {
  const description = "Create Twitter drafts about developer tooling every morning.";
  const reparsed = parseIntent(description);
  const merged = mergeRecipeInputsForDescriptionUpdate({
    previousIntent: {
      intent: "content_extractor",
      recipe_version: reparsed.recipe_version,
      recipe_inputs: {
        ...reparsed.recipe_inputs,
        platform: "linkedin",
        niche: "security"
      }
    },
    reparsedIntent: reparsed,
    description
  });

  assert.equal(merged.platform, "twitter");
  assert.equal(merged.niche, "developer tooling");
});

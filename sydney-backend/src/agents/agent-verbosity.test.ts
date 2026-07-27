import assert from "node:assert/strict";
import test from "node:test";
import { responseLimitInstruction, responseStyleGuidance, maxTokensForResponseLimit } from "./parser.js";

test("verbosity helpers return distinct, non-conflicting directives", () => {
  const conciseInstr = responseLimitInstruction("concise");
  const detailedInstr = responseLimitInstruction("detailed");
  const balancedInstr = responseLimitInstruction("balanced");

  assert.match(conciseInstr, /extremely brief, concise, and focused/);
  assert.match(detailedInstr, /highly detailed, verbose, and precise/);
  assert.match(balancedInstr, /balanced summary of information/);

  const conciseStyle = responseStyleGuidance("concise");
  const detailedStyle = responseStyleGuidance("detailed");
  const balancedStyle = responseStyleGuidance("balanced");

  assert.match(conciseStyle, /extremely brief/);
  assert.match(detailedStyle, /comprehensive/);
  assert.match(balancedStyle, /balanced/);

  assert.doesNotMatch(detailedStyle, /concise/i);
  assert.doesNotMatch(detailedInstr, /extremely brief/i);
});

test("token allocations match configured verbosity constraints", () => {
  assert.equal(maxTokensForResponseLimit("concise"), 512);
  assert.equal(maxTokensForResponseLimit("balanced"), 900);
  assert.equal(maxTokensForResponseLimit("detailed"), 1200);
});

import { adaptPolicyForResponseLimit, buildRecipeExecutionPrompt } from "./runtime/execution-prompt.js";

test("adaptPolicyForResponseLimit replaces static concise directives when detailed or balanced is requested", () => {
  const staticPolicy = "Follow the registered output schema, be concise, and distinguish missing evidence.";
  const detailed = adaptPolicyForResponseLimit(staticPolicy, "detailed");
  const balanced = adaptPolicyForResponseLimit(staticPolicy, "balanced");
  const concise = adaptPolicyForResponseLimit(staticPolicy, "concise");

  assert.match(detailed, /be detailed, thorough, and comprehensive/);
  assert.doesNotMatch(detailed, /\bbe concise\b/);

  assert.match(balanced, /be balanced and practical/);
  assert.doesNotMatch(balanced, /\bbe concise\b/);

  assert.match(concise, /be extremely concise and brief/);
});

test("buildRecipeExecutionPrompt dynamically integrates response limit preference into versioned recipe prompts", () => {
  const detailedPrompt = buildRecipeExecutionPrompt({
    recipeId: "calendar_agenda",
    outputSchema: "{}",
    runInstruction: "run",
    responseLimit: "detailed"
  });

  assert.match(detailedPrompt.system, /RESPONSE DENSITY REQUIREMENT: The response must be highly detailed/);
  assert.doesNotMatch(detailedPrompt.system, /\bbe concise\b/);

  const concisePrompt = buildRecipeExecutionPrompt({
    recipeId: "calendar_agenda",
    outputSchema: "{}",
    runInstruction: "run",
    responseLimit: "concise"
  });

  assert.match(concisePrompt.system, /RESPONSE DENSITY REQUIREMENT: The response must be extremely brief/);
});


import assert from "node:assert/strict";
import test from "node:test";
import { responseLimitInstruction, responseStyleGuidance, maxTokensForResponseLimit } from "./parser.js";
import { applyResponseLimitToContent } from "./runtime/response-density.js";
import type { ContentExtractorMessageContent } from "./output.js";

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

test("content extractor fields follow the selected response density", () => {
  const content = {
    template: "content_extractor" as const,
    version: "1.0" as const,
    data: {
      ideas: [
        {
          title: "Idea",
          hook: "A useful hook.",
          angle: "A distinct angle.",
          audience_value: "A practical takeaway.",
          evidence_summary: "Supported by a current source."
        }
      ]
    }
  };

  const concise = applyResponseLimitToContent(content, "concise") as ContentExtractorMessageContent;
  const balanced = applyResponseLimitToContent(content, "balanced") as ContentExtractorMessageContent;
  const detailed = applyResponseLimitToContent(content, "detailed") as ContentExtractorMessageContent;

  assert.deepEqual(
    concise.data.ideas[0],
    { title: "Idea", hook: "A useful hook." }
  );
  assert.deepEqual(
    balanced.data.ideas[0],
    {
      title: "Idea",
      hook: "A useful hook.",
      angle: "A distinct angle.",
      audience_value: "A practical takeaway."
    }
  );
  assert.deepEqual(
    detailed.data.ideas[0],
    content.data.ideas[0]
  );
});

test("global structured output shaping removes deeper optional context at lower densities", () => {
  const content = {
    template: "news_brief" as const,
    version: "1.0" as const,
    data: {
      title: "News",
      items: [{ summary: "A grounded update." }],
      tldr: ["The essential update."],
      perspectives: [{ label: "View", summary: "Additional context." }],
      why_it_matters: "Useful context.",
      timeline: [{ date: "Today", event: "The update happened." }]
    }
  };

  const concise = applyResponseLimitToContent(content, "concise");
  const balanced = applyResponseLimitToContent(content, "balanced");
  const detailed = applyResponseLimitToContent(content, "detailed");

  assert.equal("why_it_matters" in concise.data, false);
  assert.equal("perspectives" in concise.data, false);
  assert.equal("timeline" in concise.data, false);
  assert.equal("why_it_matters" in balanced.data, true);
  assert.equal("perspectives" in balanced.data, false);
  assert.equal("timeline" in balanced.data, false);
  assert.equal("perspectives" in detailed.data, true);
  assert.equal("timeline" in detailed.data, true);
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

import assert from "node:assert/strict";
import test from "node:test";
import { parseIntent } from "./parser.js";
import { compileAgentDefinition } from "./runtime/compiler.js";
import {
  guardCustomIntentOverride,
  resolveRefinedIntent
} from "./llm-intent.js";

const ARTICLE_WRITER_PROMPT =
  "Create an article writer agent that brings back ideas on a daily basis";

test("free-form writer agents keep the user's own description instead of becoming news briefs", () => {
  const deterministic = parseIntent(ARTICLE_WRITER_PROMPT);
  assert.equal(deterministic.intent, "custom_read_agent");
  assert.equal(deterministic.output_template, "plain_text");

  const refined = resolveRefinedIntent(ARTICLE_WRITER_PROMPT, deterministic, {
    name: "Article Idea Writer",
    intent: "news_brief",
    output_template: "news_brief",
    connectors: ["web_search"],
    action: "Delivers fresh article ideas to write about every day.",
    schedule_cron: "0 9 * * *"
  });

  assert.equal(refined.intent, "custom_read_agent");
  assert.equal(refined.output_template, deterministic.output_template);
  assert.deepEqual(refined.template_config, deterministic.template_config);
  // Improvements unrelated to intent switching are preserved.
  assert.equal(refined.name, "Article Idea Writer");
  assert.equal(
    refined.action,
    "Delivers fresh article ideas to write about every day."
  );
  assert.deepEqual(refined.connector_ids, ["web_search"]);
  assert.equal(refined.schedule_cron, "0 9 * * *");
});

test("refined article writer compiles to the custom report runtime", () => {
  const deterministic = parseIntent(ARTICLE_WRITER_PROMPT);
  const refined = resolveRefinedIntent(ARTICLE_WRITER_PROMPT, deterministic, {
    intent: "news_brief",
    connectors: ["web_search"]
  });

  const definition = compileAgentDefinition(refined, ARTICLE_WRITER_PROMPT);
  assert.equal(definition.metadata.recipe_id, "custom_read_agent");
  assert.equal(definition.steps[0]?.capability, "custom.report");
});

test("invented recipe intents fall back to the custom agent runtime", () => {
  const deterministic = parseIntent(ARTICLE_WRITER_PROMPT);
  const refined = resolveRefinedIntent(ARTICLE_WRITER_PROMPT, deterministic, {
    intent: "idea_curator_agent",
    output_template: "news_brief"
  });

  assert.equal(refined.intent, "custom_read_agent");
  assert.equal(refined.output_template, "plain_text");
});

test("recipe switches require matching keywords in the original request", () => {
  const prompt = "Let me know which AI labs are hiring this week";
  const deterministic = parseIntent(prompt);
  assert.equal(deterministic.intent, "custom_read_agent");

  const refined = resolveRefinedIntent(prompt, deterministic, {
    intent: "job_market_radar",
    connectors: ["web_search"]
  });
  assert.equal(refined.intent, "job_market_radar");
});

test("explicit news requests keep the news brief recipe", () => {
  const prompt = "Send me AI news headlines every morning";
  const deterministic = parseIntent(prompt);
  assert.equal(deterministic.intent, "news_brief");

  const refined = resolveRefinedIntent(prompt, deterministic, {
    intent: "news_brief"
  });
  assert.equal(refined.intent, "news_brief");
  assert.equal(refined.output_template, "news_brief");
});

test("non-custom recipes are not second-guessed by the custom intent guard", () => {
  const prompt = "Send me AI news headlines every morning";
  const deterministic = parseIntent(prompt);

  const refined = guardCustomIntentOverride(prompt, deterministic, {
    ...deterministic,
    intent: "tech_news_brief"
  });
  assert.equal(refined.intent, "tech_news_brief");
});

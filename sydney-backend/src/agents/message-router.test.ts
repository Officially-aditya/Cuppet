import assert from "node:assert/strict";
import test from "node:test";
import { decideAgentInstruction } from "./instruction-updater.js";
import { routeAgentMessage } from "./message-router.js";
import type { ParsedIntent } from "./parser.js";

const parsedIntent: ParsedIntent = {
  name: "Tech News",
  avatar: "newspaper",
  intent: "tech_news_brief",
  connector: "web_search",
  connector_ids: ["web_search"],
  unsupported_connector: null,
  action: "Summarizes technology news.",
  schedule_cron: "0 8 * * *",
  output_template: "plain_text",
  template_config: {},
  safety_level: "read",
  risk_level: "low",
  permissions_needed: ["Web search"],
  realtime_enabled: false
};

const agent = {
  name: parsedIntent.name,
  prompt: "Send me technology news every morning.",
  parsed_intent: parsedIntent,
  schedule_cron: parsedIntent.schedule_cron,
  status: "active" as const
};

test("ordinary follow-ups cannot update agent instructions", () => {
  for (const text of [
    "Also include AI research stories",
    "Send this at 9 AM",
    "Include startup funding too"
  ]) {
    const route = routeAgentMessage(agent, text);
    assert.equal(route.intent, "chat", text);
    assert.deepEqual(route.patch, {}, text);
  }
});

test("agent updates require and accept an explicit update-agent command", () => {
  const route = routeAgentMessage(
    agent,
    "Update agent to also include AI research stories"
  );
  assert.equal(route.intent, "update_instructions");
  assert.equal(route.slots.instruction, "also include AI research stories");

  const schedule = routeAgentMessage(
    agent,
    "Change this agent to run every day at 9 AM"
  );
  assert.equal(schedule.intent, "change_schedule");
  assert.equal(schedule.slots.scheduleCron, "0 9 * * *");

  const polite = routeAgentMessage(
    agent,
    "Could you update my agent to include security news?"
  );
  assert.equal(polite.intent, "update_instructions");
});

test("LLM route overrides cannot bypass explicit update phrasing", () => {
  const decision = decideAgentInstruction(agent, "Include AI news too", {
    routeOverride: {
      intent: "update_instructions",
      confidence: 0.9,
      reason: "llm_update",
      slots: { instruction: "Include AI news too" },
      patch: { instruction: "Include AI news too" }
    }
  });

  assert.equal(decision.kind, "chat");
  assert.equal(decision.patch.action, undefined);
  assert.equal(decision.needsLlmReply, true);
});

test("routes a last-commit question to a fresh GitHub agent run", () => {
  const githubIntent: ParsedIntent = {
    ...parsedIntent,
    name: "Sydney Repository Monitor",
    intent: "github_activity_digest",
    connector: "github",
    connector_ids: ["github"],
    action: "Monitors commits in the Sydney repository.",
    output_template: "data_summary",
    github_repository: "Sydney"
  };
  const route = routeAgentMessage(
    {
      name: githubIntent.name,
      prompt: "Monitor commits in repository Sydney.",
      parsed_intent: githubIntent,
      schedule_cron: githubIntent.schedule_cron,
      status: "active"
    },
    "Can you provide me details of the last commit in Sydney project?"
  );

  assert.equal(route.intent, "run_now");
  assert.equal(route.reason, "fresh_agent_data_request");
  assert.equal(route.slots.timeRange, "latest");
});

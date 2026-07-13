import assert from "node:assert/strict";
import test from "node:test";
import {
  actionText,
  intentName,
  notificationsMuted,
  outputTemplate,
  parseAgentIntent,
  type AgentRow
} from "./agent-types.js";

function agent(parsedIntent: unknown, prompt = "Fallback prompt"): AgentRow {
  return {
    id: "agent-1",
    user_id: "user-1",
    name: "Test agent",
    prompt,
    parsed_intent: parsedIntent as Record<string, unknown>,
    connector_ids: [],
    schedule_cron: null,
    is_assistant: false,
    status: "active",
    safety_level: "read"
  };
}

test("reads persisted intents stored as objects or JSON strings", () => {
  const objectAgent = agent({
    intent: "daily_task",
    action: "Prepare for an interview",
    output_template: "daily_task"
  });
  const stringAgent = agent(JSON.stringify({
    intent: "habit_tracker",
    action: "Meditate",
    output_template: "streak_counter"
  }));

  assert.equal(intentName(objectAgent), "daily_task");
  assert.equal(actionText(objectAgent), "Prepare for an interview");
  assert.equal(outputTemplate(objectAgent), "daily_task");
  assert.equal(intentName(stringAgent), "habit_tracker");
  assert.equal(actionText(stringAgent), "Meditate");
  assert.equal(outputTemplate(stringAgent), "streak_counter");
});

test("malformed persisted intent safely falls back to the agent prompt", () => {
  const malformed = agent("{not-json", "Keep the original prompt");

  assert.deepEqual(parseAgentIntent(malformed), {});
  assert.equal(intentName(malformed), "");
  assert.equal(actionText(malformed), "Keep the original prompt");
  assert.equal(outputTemplate(malformed), "plain_text");
});

test("only explicitly muted agents suppress notifications", () => {
  assert.equal(notificationsMuted(agent({ notifications_muted: true })), true);
  assert.equal(notificationsMuted(agent({ notifications_muted: false })), false);
  assert.equal(notificationsMuted(agent({})), false);
});

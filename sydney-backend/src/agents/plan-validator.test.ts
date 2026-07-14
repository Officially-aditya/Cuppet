import assert from "node:assert/strict";
import test from "node:test";
import type { ParsedIntent } from "./parser.js";
import { validateAgentPlan } from "./plan-validator.js";

const calendarIntent: ParsedIntent = {
  name: "Calendar Agenda",
  avatar: "calendar",
  intent: "calendar_agenda",
  connector: "calendar",
  connector_ids: ["calendar"],
  unsupported_connector: null,
  action: "Read upcoming events.",
  schedule_cron: "0 7 * * *",
  output_template: "data_summary",
  template_config: {},
  safety_level: "read",
  risk_level: "low",
  permissions_needed: ["Google Calendar event read access"]
};

test("LLM refinement cannot reroute a deterministic Calendar agent", () => {
  const result = validateAgentPlan(calendarIntent, {
    intent: "scheduled_reminder",
    connector: "calendar"
  });

  assert.equal(result.intent.intent, "calendar_agenda");
  assert.deepEqual(result.intent.connector_ids, ["calendar"]);
});

test("accepts event triggers for realtime-capable connector agents", () => {
  const githubIntent: ParsedIntent = {
    ...calendarIntent,
    name: "Repository Monitor",
    intent: "github_activity_digest",
    connector: "github",
    connector_ids: ["github"],
    schedule_cron: null,
    realtime_enabled: true
  };

  const result = validateAgentPlan(githubIntent, {
    trigger: { type: "event", event: "github.repository_activity" }
  });

  assert.equal(result.trigger.type, "event");
  assert.equal(result.intent.realtime_enabled, true);
  assert.equal(result.intent.schedule_cron, null);
  assert.deepEqual(result.unsupported_requirements, []);
});

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

import assert from "node:assert/strict";
import test from "node:test";
import { decideAgentInstruction } from "./instruction-updater.js";
import type { ParsedIntent } from "./parser.js";

const realtimeIntent: ParsedIntent = {
  name: "Repository Monitor",
  avatar: "github",
  intent: "github_activity_digest",
  connector: "github",
  connector_ids: ["github"],
  unsupported_connector: null,
  action: "Watch repository changes.",
  schedule_cron: null,
  output_template: "data_summary",
  template_config: {},
  safety_level: "read",
  risk_level: "low",
  permissions_needed: ["GitHub repository read access"],
  realtime_enabled: true
};

test("adding a schedule disables realtime delivery", () => {
  const decision = decideAgentInstruction(
    {
      name: realtimeIntent.name,
      prompt: "Tell me whenever this repository changes.",
      parsed_intent: realtimeIntent,
      schedule_cron: null,
      status: "active"
    },
    "Update agent to run every day at 9 AM",
    {
      routeOverride: {
        intent: "change_schedule",
        confidence: 1,
        reason: "test_schedule_update",
        slots: { scheduleCron: "0 9 * * *" },
        patch: { schedule_cron: "0 9 * * *" }
      }
    }
  );

  assert.equal(decision.nextScheduleCron, "0 9 * * *");
  assert.equal(decision.nextParsedIntent?.schedule_cron, "0 9 * * *");
  assert.equal(decision.nextParsedIntent?.realtime_enabled, false);
});

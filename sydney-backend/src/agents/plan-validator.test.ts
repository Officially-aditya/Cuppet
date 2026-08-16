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

test("does not preserve stale realtime flags for schedule-only agents", () => {
  const staticIntent: ParsedIntent = {
    ...calendarIntent,
    name: "News Brief",
    intent: "news_brief",
    connector: "web_search",
    connector_ids: ["web_search"],
    realtime_enabled: true
  };

  const result = validateAgentPlan(staticIntent, {});

  assert.equal(result.trigger.type, "schedule");
  assert.equal(result.intent.realtime_enabled, false);
  assert.equal(result.intent.schedule_cron, "0 7 * * *");
});

test("all shipped scheduled output contracts share the authoritative allowlist", () => {
  for (const output_template of [
    "news_brief",
    "content_extractor",
    "portfolio_watch"
  ]) {
    const result = validateAgentPlan(calendarIntent, { output_template });
    assert.equal(result.intent.output_template, output_template);
    assert.equal(
      result.warnings.some((warning) => warning.includes("unsupported output")),
      false
    );
  }
});

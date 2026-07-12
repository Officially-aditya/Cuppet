import assert from "node:assert/strict";
import test from "node:test";
import type { AgentRow } from "./agent-types.js";
import {
  reminderWithoutDynamicRequests,
  scheduleTimeLabel,
  scheduledTitle,
  topicLabel,
  wantsNewsBrief,
  wantsTechNewsBrief,
  withPeriod
} from "./schedule-labels.js";

function agent(schedule_cron: string | null): AgentRow {
  return {
    id: "agent-1",
    user_id: "user-1",
    name: "Test agent",
    prompt: "Test prompt",
    parsed_intent: {},
    connector_ids: [],
    schedule_cron,
    is_assistant: false,
    status: "active",
    safety_level: "read"
  };
}

test("formats daily schedule labels and ignores unsupported cron shapes", () => {
  assert.equal(scheduleTimeLabel("0 0 * * *"), "12am");
  assert.equal(scheduleTimeLabel("30 16 * * *"), "4:30pm");
  assert.equal(scheduleTimeLabel("0 12 * * *"), "12pm");
  assert.equal(scheduleTimeLabel("0 9 * * 1-5"), null);
  assert.equal(scheduleTimeLabel(null), null);
});

test("manual, snoozed, and scheduled titles remain distinct", () => {
  const scheduled = agent("15 7 * * *");

  assert.equal(scheduledTitle(scheduled, "brief"), "Here's your 7:15am brief");
  assert.equal(
    scheduledTitle(scheduled, "brief", "manual"),
    "Here's the brief you requested"
  );
  assert.equal(
    scheduledTitle(scheduled, "brief", "snooze"),
    "Here's your snoozed brief"
  );
});

test("reminder cleanup removes dynamic news and DSA suffixes without losing the reminder", () => {
  assert.equal(
    reminderWithoutDynamicRequests(
      "Reminder: Review pull requests and send me the tech news digest daily."
    ),
    "Review pull requests"
  );
  assert.equal(
    reminderWithoutDynamicRequests(
      "Reminder: Practice arrays, and give me the DSA question of the day."
    ),
    "Practice arrays"
  );
  assert.equal(
    reminderWithoutDynamicRequests("Reminder: Call mom at 8 pm."),
    "Call mom at 8 pm."
  );
});

test("news classification and display helpers preserve expected contracts", () => {
  assert.equal(wantsNewsBrief("Send headlines every morning"), true);
  assert.equal(wantsTechNewsBrief("Send technology news every morning"), true);
  assert.equal(wantsTechNewsBrief("Send company news every morning"), false);
  assert.equal(topicLabel("News about climate policy every morning", "news brief"), "climate policy brief");
  assert.equal(withPeriod("Ready"), "Ready.");
  assert.equal(withPeriod("Ready!"), "Ready!");
});

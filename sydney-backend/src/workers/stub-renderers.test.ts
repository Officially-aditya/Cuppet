import assert from "node:assert/strict";
import test from "node:test";
import type { AgentRow } from "./agent-types.js";
import {
  renderBookCompanion,
  renderCodingTip,
  renderCompetitorWatch,
  renderDailyTaskAgent,
  renderGratitudePrompt,
  renderHabitTracker,
  renderLanguageWord,
  renderParentingMilestone,
  renderRelationshipNudge,
  renderStudyPlan
} from "./stub-renderers.js";

function agent(prompt: string, schedule_cron: string | null = "0 9 * * *"): AgentRow {
  return {
    id: "agent-1",
    user_id: "user-1",
    name: "Test agent",
    prompt,
    parsed_intent: {},
    connector_ids: [],
    schedule_cron,
    is_assistant: false,
    status: "active",
    safety_level: "read"
  };
}

function dataOf(message: ReturnType<typeof renderHabitTracker>): Record<string, unknown> {
  return message.content.data as Record<string, unknown>;
}

test("habit and language renderers preserve streak-counter contracts", () => {
  const habit = renderHabitTracker(agent("Meditate every day"));
  const language = renderLanguageWord(agent("Teach me one Spanish word daily"));

  assert.equal(habit.content.template, "streak_counter");
  assert.deepEqual(dataOf(habit), {
    label: "Meditation",
    count: 0,
    unit: "logged days",
    caption: "Here's your 9am habit check-in. Do one short meditation session now."
  });
  assert.equal(language.content.template, "streak_counter");
  assert.equal(dataOf(language).word, "Madrugada");
  assert.equal(dataOf(language).translation, "I woke up in the early hours.");
});

test("daily task renderer selects specialized task data and actions", () => {
  const rendered = renderDailyTaskAgent(agent("Help me prepare for an interview"));
  const data = dataOf(rendered);

  assert.equal(rendered.content.template, "daily_task");
  assert.equal(data.title, "Here's your 9am interview prep");
  assert.equal(data.estimated_minutes, 45);
  assert.deepEqual(
    (data.actions as Array<Record<string, unknown>>).map((action) => action.id),
    ["done", "snooze", "skip"]
  );
});

test("study plans remain exam-specific progress trackers", () => {
  const jee = renderStudyPlan(agent("Prepare me for JEE"));
  const generic = renderStudyPlan(agent("Help me study history"));

  assert.equal(jee.content.template, "progress_tracker");
  assert.equal(dataOf(jee).total, 4);
  assert.match(String(dataOf(jee).text), /physics, chemistry, and maths/);
  assert.equal((dataOf(generic).steps as unknown[]).length, 4);
});

test("competitor watch handles named and missing competitors", () => {
  const named = renderCompetitorWatch(
    agent('Watch "Acme" and "Globex" and tell me what changes')
  );
  const missing = renderCompetitorWatch(agent("Watch my competitors and tell me what changes"));

  assert.equal(named.content.template, "comparison");
  assert.deepEqual(
    (dataOf(named).rows as Array<Record<string, unknown>>).map((row) => row.label),
    ["Acme", "Globex"]
  );
  assert.match(String(dataOf(missing).insight), /names are required/);
});

test("news-like deterministic renderers always produce non-empty briefs", () => {
  const renderers = [
    renderCodingTip(agent("Give me a Python tip")),
    renderBookCompanion(agent("Share an Atomic Habits insight")),
    renderParentingMilestone(agent("Track a parenting milestone")),
    renderRelationshipNudge(agent("Help me stay in touch")),
    renderGratitudePrompt(agent("Give me a gratitude prompt"))
  ];

  for (const rendered of renderers) {
    assert.equal(rendered.content.template, "news_brief");
    const items = dataOf(rendered).items as unknown[];
    assert.ok(items.length > 0);
  }
});

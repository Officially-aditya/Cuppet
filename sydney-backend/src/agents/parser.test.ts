import assert from "node:assert/strict";
import test from "node:test";
import { parseIntent, responseLimitInstruction } from "./parser.js";

test("classifies a calendar agenda as a dedicated calendar connector", () => {
  const parsed = parseIntent(
    "Summarize my Google Calendar every morning and show my upcoming meetings."
  );

  assert.equal(parsed.intent, "calendar_agenda");
  assert.equal(parsed.connector, "calendar");
  assert.deepEqual(parsed.connector_ids, ["calendar"]);
  assert.deepEqual(parsed.permissions_needed, ["Google Calendar event read access"]);
});

test("keeps email digests Gmail-only even when an old prompt mentions calendar", () => {
  const parsed = parseIntent(
    "Create a Gmail digest that covers bills, calendar-related updates, and time-sensitive email every day."
  );

  assert.equal(parsed.intent, "email_digest");
  assert.equal(parsed.connector, "gmail");
  assert.deepEqual(parsed.connector_ids, ["gmail"]);
  assert.deepEqual(parsed.permissions_needed, ["Gmail read access"]);
});

test("classifies GitHub repository activity as a GitHub connector agent", () => {
  const parsed = parseIntent(
    "Send me a daily GitHub digest of repositories, open issues, and pull requests."
  );

  assert.equal(parsed.intent, "github_activity_digest");
  assert.equal(parsed.connector, "github");
  assert.deepEqual(parsed.connector_ids, ["github"]);
  assert.deepEqual(parsed.permissions_needed, [
    "GitHub profile and repository read access"
  ]);
  assert.equal(parsed.realtime_enabled, false);
});

test("treats immediate repository change alerts as realtime, not daily", () => {
  const parsed = parseIntent(
    "Create an agent which tracks any changes in my repository Sydney, if there are any changes, inform me immediately"
  );

  assert.equal(parsed.intent, "github_activity_digest");
  assert.equal(parsed.connector, "github");
  assert.equal(parsed.realtime_enabled, true);
  assert.equal(parsed.schedule_cron, null);
});

test("recognizes common realtime trigger language", () => {
  for (const prompt of [
    "Watch my GitHub repository in real time",
    "Alert me whenever my GitHub repository changes",
    "Notify me as soon as a GitHub pull request opens"
  ]) {
    const parsed = parseIntent(prompt);
    assert.equal(parsed.intent, "github_activity_digest");
    assert.equal(parsed.realtime_enabled, true, prompt);
    assert.equal(parsed.schedule_cron, null, prompt);
  }
});

test("content extractor is not classified as unsupported even when mentioning twitter or linkedin", () => {
  const parsed = parseIntent(
    "Create a content extractor agent that searches the web for trending topics and generates Twitter, LinkedIn, or Reddit drafts."
  );

  assert.equal(parsed.intent, "content_extractor");
  assert.equal(parsed.output_template, "content_extractor");
});

test("responseLimitInstruction returns appropriate prompts", () => {
  assert.match(responseLimitInstruction("concise"), /extremely brief/);
  assert.match(responseLimitInstruction("detailed"), /highly detailed/);
  assert.match(responseLimitInstruction("balanced"), /balanced/);
  assert.match(responseLimitInstruction(undefined), /balanced/);
});

test("agent active_until parsing and date format compatibility", () => {
  const dateStr = new Date().toISOString();
  const parsed = new Date(dateStr);
  assert.ok(!isNaN(parsed.getTime()));
});

test("extracts schedule_cron for various times and frequencies", () => {
  // Test "every weekday at 4 PM" -> 0 16 * * 1-5
  const p1 = parseIntent("Create a stock watch agent every weekday at 4 PM");
  assert.equal(p1.schedule_cron, "0 16 * * 1-5");

  // Test "7 pm daily" -> 0 19 * * *
  const p2 = parseIntent("Remind me to code 7 pm daily");
  assert.equal(p2.schedule_cron, "0 19 * * *");

  // Test "at 16:30 weekly" -> 30 16 * * 1
  const p3 = parseIntent("Summarize my repository activity at 16:30 weekly");
  assert.equal(p3.schedule_cron, "30 16 * * 1");

  // Test "every month at 9:00 am" -> 0 9 1 * *
  const p4 = parseIntent("Auditing invoices every month at 9:00 am");
  assert.equal(p4.schedule_cron, "0 9 1 * *");
});

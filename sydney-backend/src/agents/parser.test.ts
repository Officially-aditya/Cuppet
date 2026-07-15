import assert from "node:assert/strict";
import test from "node:test";
import { parseIntent, responseLimitInstruction } from "./parser.js";

test("onboarding suggestions create the intended scheduled agents", () => {
  const news = parseIntent(
    "Create an agent that delivers a concise technology news briefing every day at 8 AM."
  );
  assert.equal(news.intent, "tech_news_brief");
  assert.equal(news.schedule_cron, "0 8 * * *");
  assert.equal(news.realtime_enabled, false);

  const coding = parseIntent(
    "Create an agent that gives me one DSA coding question every day at 7 PM."
  );
  assert.equal(coding.intent, "dsa_question");
  assert.equal(coding.schedule_cron, "0 19 * * *");
  assert.equal(coding.realtime_enabled, false);
});

test("classifies the four multi-connector briefing agents", () => {
  const cases = [
    {
      prompt: "Create a daily executive briefing from Gmail, Calendar, and Slack every weekday at 7 AM",
      intent: "daily_executive_briefing",
      connectors: ["gmail", "calendar", "slack"]
    },
    {
      prompt: "Create a project pulse using GitHub, Slack, Notion, and Drive",
      intent: "project_pulse",
      connectors: ["github", "slack", "notion", "drive"]
    },
    {
      prompt: "Create a pre-meeting briefing using Calendar, Gmail, Drive, and Notion",
      intent: "meeting_intelligence",
      connectors: ["calendar", "gmail", "drive", "notion"]
    },
    {
      prompt: "Create a weekly accomplishment report from Slack, GitHub, Drive, and Notion",
      intent: "weekly_accomplishment_report",
      connectors: ["slack", "github", "drive", "notion"]
    }
  ];

  for (const item of cases) {
    const parsed = parseIntent(item.prompt);
    assert.equal(parsed.intent, item.intent, item.prompt);
    assert.equal(parsed.output_template, "briefing_card", item.prompt);
    assert.deepEqual(parsed.connector_ids, item.connectors, item.prompt);
  }
});

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

test("classifies Notion workspace summaries as a Notion connector agent", () => {
  const parsed = parseIntent(
    "Create an agent that summarizes changes in my selected Notion pages every morning."
  );

  assert.equal(parsed.intent, "notion_workspace_digest");
  assert.equal(parsed.connector, "notion");
  assert.deepEqual(parsed.connector_ids, ["notion"]);
  assert.deepEqual(parsed.permissions_needed, ["Read selected Notion pages"]);
  assert.equal(parsed.schedule_cron, "0 7 * * *");
});

test("treats immediate repository change alerts as realtime, not daily", () => {
  const parsed = parseIntent(
    "Create an agent which tracks any changes in my repository Sydney, if there are any changes, inform me immediately"
  );

  assert.equal(parsed.intent, "github_activity_digest");
  assert.equal(parsed.connector, "github");
  assert.equal(parsed.realtime_enabled, true);
  assert.equal(parsed.schedule_cron, null);
  assert.equal(parsed.github_repository, "Sydney");
});

test("persists full GitHub repository scope without narrowing generic agents", () => {
  const scoped = parseIntent(
    "Create an agent that watches repo officially-aditya/Sydney in real time"
  );
  assert.equal(scoped.intent, "github_activity_digest");
  assert.equal(scoped.github_repository, "officially-aditya/Sydney");

  const generic = parseIntent(
    "Send me a daily GitHub digest of repositories, open issues, and pull requests."
  );
  assert.equal(generic.intent, "github_activity_digest");
  assert.equal(generic.github_repository, undefined);
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

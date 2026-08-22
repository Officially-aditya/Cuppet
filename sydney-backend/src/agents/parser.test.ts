import assert from "node:assert/strict";
import test from "node:test";
import { parseIntent, responseLimitInstruction, responseStyleGuidance, maxTokensForResponseLimit } from "./parser.js";
import { config } from "../config.js";

test("onboarding suggestions create the intended scheduled agents", () => {
  const news = parseIntent(
    "Create an agent that delivers a concise technology news briefing every day at 8 AM."
  );
  assert.equal(news.intent, "tech_news_brief");
  assert.equal(news.schedule_cron, "0 8 * * *");
  assert.equal(news.output_template, "news_brief");
  assert.equal(news.realtime_enabled, false);

  const coding = parseIntent(
    "Create an agent that gives me one DSA coding question every day at 7 PM."
  );
  assert.equal(coding.intent, "dsa_question");
  assert.equal(coding.schedule_cron, "0 19 * * *");
  assert.equal(coding.realtime_enabled, false);
});

test("general news parsing selects the structured news brief contract", () => {
  const news = parseIntent(
    "Send me current world news every morning at 7 AM."
  );

  assert.equal(news.intent, "news_brief");
  assert.equal(news.output_template, "news_brief");
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

test("twitter draft descriptions are not rejected as unsupported connectors", () => {
  const parsed = parseIntent(
    "Search the web for tech topics and write Twitter drafts every morning."
  );
  assert.notEqual(parsed.intent, "unsupported_connector");
  assert.equal(parsed.unsupported_connector, null);
});

test("reddit draft descriptions parse as content drafting agents with platform and niche", () => {
  const parsed = parseIntent(
    "Search the web for gaming topics and write Reddit drafts for r/gaming every morning."
  );
  assert.notEqual(parsed.intent, "unsupported_connector");
  assert.equal(parsed.unsupported_connector, null);
  assert.equal(parsed.intent, "content_extractor");
  assert.equal(parsed.recipe_inputs?.platform, "reddit");
  assert.equal(parsed.recipe_inputs?.niche, "gaming");
});

test("explicit trusted MCP providers win over overlapping capability keywords", () => {
  const previousDirectory = config.MCP_TRUSTED_PROVIDER_DIRECTORY;
  config.MCP_TRUSTED_PROVIDER_DIRECTORY = JSON.stringify([
    {
      provider_id: "mcp.canva",
      name: "Canva",
      description: "Read approved Canva context",
      icon_name: "palette",
      category: "DESIGN",
      endpoint: "https://mcp.canva.example",
      capabilities: ["files.read"],
      allowed_tools: ["list_files"]
    }
  ]);

  try {
    const parsed = parseIntent(
      "Create a Canva agent that watches my portfolio file"
    );

    assert.equal(parsed.intent, "custom_read_agent");
    assert.equal(parsed.name, "Canva");
    assert.deepEqual(parsed.connector_ids, []);
    assert.deepEqual(parsed.required_access?.[0], {
      service: "files",
      capabilities: ["read"],
      required: true,
      preferred_provider_ids: ["mcp.canva"],
      reason: "Canva read access"
    });
  } finally {
    config.MCP_TRUSTED_PROVIDER_DIRECTORY = previousDirectory;
  }
});

test("portfolio keywords still classify as portfolio watch without an explicit provider", () => {
  const parsed = parseIntent("Create an agent that watches my portfolio file");

  assert.equal(parsed.intent, "portfolio_watch");
  assert.equal(parsed.name, "Portfolio Watch");
});

test("free-form creation requests stay generic custom agents", () => {
  const writer = parseIntent(
    "Create an article writer agent that brings back ideas on a daily basis"
  );
  assert.equal(writer.intent, "custom_read_agent");
  assert.equal(writer.name, "Custom Agent");
  assert.equal(writer.output_template, "plain_text");
  assert.equal(writer.schedule_cron, "0 9 * * *");

  const ideas = parseIntent(
    "I want an agent that sends me fresh writing ideas every morning"
  );
  assert.equal(ideas.intent, "custom_read_agent");
  assert.equal(ideas.name, "Custom Agent");
  assert.equal(ideas.schedule_cron, "0 7 * * *");
});

test("tickers, cashtags, and mapped companies still classify as portfolio watch", () => {
  for (const prompt of [
    "Watch TSLA and NVDA price movements daily",
    "$AAPL earnings summary each morning",
    "Summarize RELIANCE stock every evening"
  ]) {
    const parsed = parseIntent(prompt);
    assert.equal(parsed.intent, "portfolio_watch", prompt);
  }
});

test("common acronyms do not turn requests into portfolio watch", () => {
  const parsed = parseIntent(
    "Let me know which AI labs are hiring this week"
  );
  assert.notEqual(parsed.intent, "portfolio_watch");
});

test("responseLimitInstruction returns appropriate prompts", () => {
  assert.match(responseLimitInstruction("concise"), /extremely brief/);
  assert.match(responseLimitInstruction("detailed"), /highly detailed/);
  assert.match(responseLimitInstruction("balanced"), /balanced/);
  assert.match(responseLimitInstruction(undefined), /balanced/);

  assert.match(responseStyleGuidance("concise"), /extremely brief/);
  assert.match(responseStyleGuidance("detailed"), /comprehensive/);
  assert.match(responseStyleGuidance("balanced"), /balanced/);

  assert.equal(maxTokensForResponseLimit("concise"), 512);
  assert.equal(maxTokensForResponseLimit("balanced"), 900);
  assert.equal(maxTokensForResponseLimit("detailed"), 1200);
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

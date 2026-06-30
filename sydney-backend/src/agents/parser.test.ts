import assert from "node:assert/strict";
import test from "node:test";
import { parseIntent } from "./parser.js";

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
});

test("content extractor is not classified as unsupported even when mentioning twitter or linkedin", () => {
  const parsed = parseIntent(
    "Create a content extractor agent that searches the web for trending topics and generates Twitter, LinkedIn, or Reddit drafts."
  );

  assert.equal(parsed.intent, "content_extractor");
  assert.equal(parsed.output_template, "content_extractor");
});

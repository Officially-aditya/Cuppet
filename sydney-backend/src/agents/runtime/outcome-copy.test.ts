import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OUTCOME_COPY_REGISTRY,
  formatOutcomeErrorCodeMessage,
  isTechnicalBoilerplate,
  resolveOutcomeCopy,
  TECHNICAL_BOILERPLATE_PATTERNS
} from "./outcome-copy.js";

describe("Outcome Copy Registry", () => {
  const agentIntents = [
    "inbox_attention",
    "email_followup_watcher",
    "github_ci_watch",
    "github_digest",
    "google_drive_watch",
    "slack_attention",
    "notion_digest",
    "default_connector"
  ];

  const outcomeStates = [
    "no_relevant_items",
    "empty_source",
    "partial_results",
    "access_required",
    "failed"
  ] as const;

  it("provides copy for all intent and outcome state combinations", () => {
    for (const intent of agentIntents) {
      for (const state of outcomeStates) {
        const copy = resolveOutcomeCopy(intent, state);
        assert.ok(copy);
        assert.ok(copy.length > 0);
      }
    }
  });

  it("rejects technical boilerplate in all copy registry entries", () => {
    for (const [intent, copyDef] of Object.entries(DEFAULT_OUTCOME_COPY_REGISTRY)) {
      for (const [state, text] of Object.entries(copyDef)) {
        if (!text) continue;
        for (const pattern of TECHNICAL_BOILERPLATE_PATTERNS) {
          assert.equal(
            pattern.test(text),
            false,
            `Registry entry [${intent}.${state}] matched boilerplate pattern ${pattern}: "${text}"`
          );
        }
      }
    }
  });

  it("returns exact reassuring copy for inbox_attention all-clear", () => {
    const copy = resolveOutcomeCopy("inbox_attention", "no_relevant_items");
    assert.equal(copy, "Nothing in your inbox needs your attention right now.");
  });

  it("returns exact reassuring copy for email_followup_watcher", () => {
    const copy = resolveOutcomeCopy("email_followup_watcher", "no_relevant_items");
    assert.equal(copy, "No messages are waiting for your reply.");
  });

  it("returns exact reassuring copy for github_ci_watch", () => {
    const copy = resolveOutcomeCopy("github_ci_watch", "no_relevant_items");
    assert.equal(copy, "No workflow failures need your attention.");
  });

  it("distinguishes empty source from no relevant items when defined", () => {
    const noRelevant = resolveOutcomeCopy("inbox_attention", "no_relevant_items");
    const emptySource = resolveOutcomeCopy("inbox_attention", "empty_source");

    assert.equal(noRelevant, "Nothing in your inbox needs your attention right now.");
    assert.equal(emptySource, "There are no new emails to review.");
  });

  it("formats user-facing error codes without technical jargon", () => {
    const accessReq = formatOutcomeErrorCodeMessage("ACCESS_REQUIRED", "Gmail");
    assert.equal(accessReq, "Reconnect Gmail so this agent can continue.");
    assert.equal(accessReq.includes("OAuth"), false);
    assert.equal(accessReq.includes("token"), false);

    const tempUnavail = formatOutcomeErrorCodeMessage("TEMPORARILY_UNAVAILABLE", "Slack");
    assert.equal(tempUnavail, "I couldn’t reach Slack right now. I’ll try again on the next run.");
    assert.equal(tempUnavail.includes("HTTP 503"), false);
  });

  it("correctly identifies technical boilerplate strings", () => {
    assert.equal(isTechnicalBoilerplate("No matching Gmail messages were found for this run."), true);
    assert.equal(isTechnicalBoilerplate("Source: Gmail"), true);
    assert.equal(isTechnicalBoilerplate("connector token expired"), true);
    assert.equal(isTechnicalBoilerplate("Nothing in your inbox needs your attention right now."), false);
  });
});

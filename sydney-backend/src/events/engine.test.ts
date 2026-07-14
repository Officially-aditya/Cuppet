import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import {
  eventCooldownSeconds,
  shouldTriggerAgentEvent
} from "./engine.js";
import {
  verifyGitHubSignature,
  verifySlackSignature
} from "./routes.js";

test("Slack urgent watchers trigger only on urgent messages or mentions", () => {
  const intent = { intent: "slack_urgent_watcher" };
  assert.equal(
    shouldTriggerAgentEvent(intent, {
      source: "slack",
      eventType: "slack.message",
      payload: { text: "Production is blocked by an outage" }
    }),
    true
  );
  assert.equal(
    shouldTriggerAgentEvent(intent, {
      source: "slack",
      eventType: "slack.message",
      payload: { text: "Lunch is ready" }
    }),
    false
  );
  assert.equal(
    shouldTriggerAgentEvent(intent, {
      source: "slack",
      eventType: "slack.app_mention",
      payload: { text: "Can you review this?" }
    }),
    true
  );
});
test("event matching is connector-specific and can be disabled per agent", () => {
  assert.equal(
    shouldTriggerAgentEvent({ intent: "github_activity_digest" }, {
      source: "github",
      eventType: "github.pull_request",
      payload: {}
    }),
    true
  );
  assert.equal(
    shouldTriggerAgentEvent(
      { intent: "github_activity_digest", realtime_enabled: false },
      { source: "github", eventType: "github.push", payload: {} }
    ),
    false
  );
  assert.equal(
    shouldTriggerAgentEvent({ intent: "portfolio_watch" }, {
      source: "stock",
      eventType: "stock.quote",
      payload: { threshold_crossed: false }
    }),
    false
  );
});

test("event cooldowns are bounded to prevent notification storms", () => {
  assert.equal(eventCooldownSeconds({}, "slack"), 120);
  assert.equal(eventCooldownSeconds({ event_cooldown_seconds: 1 }, "slack"), 30);
  assert.equal(
    eventCooldownSeconds({ event_cooldown_seconds: 999999 }, "github"),
    86_400
  );
});

test("Slack signatures require exact bytes and reject stale requests", () => {
  const rawBody = Buffer.from('{"type":"event_callback"}');
  const timestamp = "1783987200";
  const secret = "slack-signing-secret";
  const signature = `v0=${createHmac("sha256", secret)
    .update(`v0:${timestamp}:`)
    .update(rawBody)
    .digest("hex")}`;

  assert.equal(
    verifySlackSignature({
      rawBody,
      timestamp,
      signature,
      signingSecret: secret,
      nowSeconds: 1783987200
    }),
    true
  );
  assert.equal(
    verifySlackSignature({
      rawBody: Buffer.from('{"type": "event_callback"}'),
      timestamp,
      signature,
      signingSecret: secret,
      nowSeconds: 1783987200
    }),
    false
  );
  assert.equal(
    verifySlackSignature({
      rawBody,
      timestamp,
      signature,
      signingSecret: secret,
      nowSeconds: 1783987600
    }),
    false
  );
});

test("GitHub webhook signatures require exact request bytes", () => {
  const rawBody = Buffer.from('{"action":"opened"}');
  const secret = "github-webhook-secret";
  const signature = `sha256=${createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
  assert.equal(
    verifyGitHubSignature({ rawBody, signature, webhookSecret: secret }),
    true
  );
  assert.equal(
    verifyGitHubSignature({
      rawBody: Buffer.from('{"action":"closed"}'),
      signature,
      webhookSecret: secret
    }),
    false
  );
});

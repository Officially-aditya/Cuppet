import assert from "node:assert/strict";
import test from "node:test";
import {
  createSlackAuthUrl,
  fetchSlackActivity,
  parseSlackCallbackUrl,
  slackRequestedScopes,
  slackScopesCoverReadAccess
} from "./slack.js";

test("creates a Slack OAuth URL with signed state and read-only scopes", async () => {
  const session = await createSlackAuthUrl({
    userId: "user-slack",
    callbackScheme: "sydney"
  });
  const url = new URL(session.authUrl);

  assert.equal(url.origin, "https://slack.com");
  assert.equal(url.pathname, "/oauth/v2/authorize");
  assert.equal(url.searchParams.get("redirect_uri"), process.env.SLACK_REDIRECT_URI);
  assert.ok(url.searchParams.get("state"));
  assert.deepEqual(
    new Set((url.searchParams.get("scope") ?? "").split(",")),
    new Set(slackRequestedScopes())
  );
  assert.equal(url.searchParams.get("scope")?.includes("chat:write"), false);
});

test("accepts the mobile Slack connector callback", () => {
  const parsed = parseSlackCallbackUrl(
    "sydney://connectors/slack?connector_id=slack&status=connected"
  );
  assert.equal(parsed.connectorId, "slack");
  assert.equal(parsed.error, undefined);
});

test("rejects Slack callbacks for another connector path", () => {
  assert.throws(
    () =>
      parseSlackCallbackUrl(
        "sydney://connectors/github?connector_id=slack&status=connected"
      ),
    /Invalid Slack connector callback URL/
  );
});

test("requires core channel history scopes before marking Slack usable", () => {
  assert.equal(
    slackScopesCoverReadAccess([
      "channels:read",
      "channels:history",
      "users:read"
    ]),
    true
  );
  assert.equal(
    slackScopesCoverReadAccess(["channels:read", "users:read"]),
    false
  );
});

test("Slack activity includes only joined readable channels and resolves authors", async () => {
  const originalFetch = globalThis.fetch;
  const requestedHistory: string[] = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/conversations.list")) {
      return Response.json({
        ok: true,
        channels: [
          { id: "C1", name: "engineering", is_member: true },
          { id: "C2", name: "unjoined", is_member: false },
          { id: "C3", name: "old", is_member: true, is_archived: true },
          { id: "C4", name: "removed", is_member: true }
        ],
        response_metadata: { next_cursor: "" }
      });
    }
    if (url.pathname.endsWith("/users.list")) {
      return Response.json({
        ok: true,
        members: [
          { id: "U1", name: "ada", profile: { display_name: "Ada" } }
        ]
      });
    }
    if (url.pathname.endsWith("/conversations.history")) {
      const channel = url.searchParams.get("channel") ?? "";
      requestedHistory.push(channel);
      if (channel === "C4") {
        return Response.json({ ok: false, error: "not_in_channel" });
      }
      return Response.json({
        ok: true,
        messages: [
          { type: "message", user: "U1", text: "Production deploy completed", ts: "2.0" },
          { type: "message", user: "U1", text: "", ts: "1.0" }
        ]
      });
    }
    throw new Error(`Unexpected Slack URL: ${url}`);
  };

  try {
    const activity = await fetchSlackActivity("token", { oldest: 1 });
    assert.deepEqual(requestedHistory, ["C1", "C4"]);
    assert.equal(activity.length, 1);
    assert.equal(activity[0]?.channelName, "engineering");
    assert.equal(activity[0]?.authorName, "Ada");
    assert.equal(activity[0]?.message.text, "Production deploy completed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

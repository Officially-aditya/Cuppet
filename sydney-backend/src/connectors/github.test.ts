import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGitHubAppInstallUrl,
  githubTimestampInWindow,
  parseGitHubCallbackUrl,
  prepareGitHubWebhookActivity,
  resolveGitHubActivityWindow
} from "./github.js";

test("builds the GitHub App repository approval URL", () => {
  const url = buildGitHubAppInstallUrl("cuppet", "signed-state");
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.pathname, "/apps/cuppet/installations/new");
  assert.equal(url.searchParams.get("state"), "signed-state");
});

test("rejects an invalid GitHub App slug", () => {
  assert.throws(
    () => buildGitHubAppInstallUrl("https://malicious.example", "state"),
    /invalid_github_app_slug/
  );
});

test("accepts the mobile GitHub connector callback", () => {
  const parsed = parseGitHubCallbackUrl(
    "sydney://connectors/github?connector_id=github&status=connected"
  );

  assert.equal(parsed.connectorId, "github");
  assert.equal(parsed.error, undefined);
});

test("rejects callbacks for another connector path", () => {
  assert.throws(
    () =>
      parseGitHubCallbackUrl(
        "sydney://connectors/google?connector_id=github&status=connected"
      ),
    /Invalid GitHub connector callback URL/
  );
});

test("GitHub digest windows resume after the previous successful run", () => {
  const until = new Date("2026-07-15T10:00:00.000Z");
  const resumed = resolveGitHubActivityWindow(
    "2026-07-15T09:15:00.000Z",
    until
  );

  assert.equal(resumed.since.toISOString(), "2026-07-15T09:15:00.000Z");
  assert.equal(resumed.until.toISOString(), until.toISOString());
  assert.equal(resumed.resumedFromPreviousRun, true);
  assert.equal(
    githubTimestampInWindow("2026-07-15T09:30:00.000Z", resumed),
    true
  );
  assert.equal(
    githubTimestampInWindow("2026-07-15T09:15:00.000Z", resumed),
    false
  );
});

test("GitHub digest windows use 24 hours initially and clamp stale cursors", () => {
  const until = new Date("2026-07-15T10:00:00.000Z");
  const initial = resolveGitHubActivityWindow(null, until);
  const stale = resolveGitHubActivityWindow(
    "2026-06-01T00:00:00.000Z",
    until
  );

  assert.equal(initial.since.toISOString(), "2026-07-14T10:00:00.000Z");
  assert.equal(initial.resumedFromPreviousRun, false);
  assert.equal(stale.since.toISOString(), "2026-07-08T10:00:00.000Z");
  assert.equal(stale.resumedFromPreviousRun, true);
});

test("realtime GitHub pushes render only exact deduplicated webhook commits", () => {
  const sha = "a".repeat(40);
  const activity = prepareGitHubWebhookActivity({
    event_type: "github.push",
    occurred_at: "2026-07-15T10:30:00.000Z",
    payload: {
      repository: "cuppet-org/cuppet",
      repository_url: "https://github.com/cuppet-org/cuppet",
      ref: "refs/heads/main",
      commit_count: 2,
      commits: [
        {
          sha,
          message: "Ship exact webhook activity\nwith details",
          timestamp: "2026-07-15T10:29:00.000Z",
          url: `https://github.com/cuppet-org/cuppet/commit/${sha}`
        },
        {
          sha,
          message: "Duplicate delivery must not render twice",
          timestamp: "2026-07-15T10:29:00.000Z"
        }
      ],
      head_commit: {
        sha,
        message: "Head commit duplicate"
      }
    }
  });

  assert.equal(activity.repository, "cuppet-org/cuppet");
  assert.equal(activity.timeline.length, 1);
  assert.equal(activity.timeline[0]?.title, "Ship exact webhook activity");
  assert.equal(activity.timeline[0]?.repository, "cuppet-org/cuppet");
  assert.equal(activity.timeline[0]?.type, "commit");
  assert.equal(activity.sourceRefs.length, 1);
  assert.equal(activity.sourceRefs[0]?.id, sha);
  assert.match(activity.summary, /2 commits were pushed/);
});

test("realtime GitHub issue events do not include account-wide activity", () => {
  const activity = prepareGitHubWebhookActivity({
    event_type: "github.issues",
    occurred_at: "2026-07-15T10:30:00.000Z",
    payload: {
      action: "opened",
      repository: "cuppet-org/cuppet",
      issue: {
        id: "42",
        number: 7,
        title: "Prevent stale commit replay",
        state: "open",
        updated_at: "2026-07-15T10:29:00.000Z",
        url: "https://github.com/cuppet-org/cuppet/issues/7"
      }
    }
  });

  assert.deepEqual(activity.timeline, [
    {
      title: "Prevent stale commit replay",
      repository: "cuppet-org/cuppet",
      timestamp: "2026-07-15T10:29:00.000Z",
      url: "https://github.com/cuppet-org/cuppet/issues/7",
      type: "issue"
    }
  ]);
  assert.equal(activity.sourceRefs[0]?.type, "github_issue");
});

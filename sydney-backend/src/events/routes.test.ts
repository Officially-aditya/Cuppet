import assert from "node:assert/strict";
import test from "node:test";
import {
  GITHUB_WEBHOOK_COMMIT_LIMIT,
  normalizeGitHubWebhookPayload
} from "./routes.js";

const receivedAt = new Date("2026-07-15T10:30:00.000Z");

function githubEnvelope() {
  return {
    installation: {
      id: 991,
      account: { login: "cuppet-org" }
    },
    repository: {
      id: 42,
      full_name: "cuppet-org/cuppet",
      html_url: "https://github.com/cuppet-org/cuppet",
      default_branch: "main",
      private: true
    },
    sender: { login: "octocat" }
  };
}

test("normalizes exact GitHub push range and commit details", () => {
  const firstSha = "a".repeat(40);
  const secondSha = "b".repeat(40);
  const normalized = normalizeGitHubWebhookPayload(
    "push",
    {
      ...githubEnvelope(),
      ref: "refs/heads/main",
      before: firstSha,
      after: secondSha,
      compare: `https://github.com/cuppet-org/cuppet/compare/${firstSha}...${secondSha}`,
      forced: false,
      size: 2,
      distinct_size: 2,
      pusher: { name: "Octo Cat", username: "octocat" },
      commits: [
        {
          id: firstSha,
          message: "Preserve the exact subject\nand body",
          timestamp: "2026-07-15T10:20:00Z",
          url: `https://github.com/cuppet-org/cuppet/commit/${firstSha}`,
          distinct: true,
          author: { name: "Author One", username: "author-one" },
          committer: { name: "Committer One", username: "committer-one" },
          added: ["src/new.ts"],
          removed: [],
          modified: ["src/existing.ts"]
        },
        {
          id: secondSha,
          message: "Second commit",
          timestamp: "2026-07-15T10:25:00+00:00",
          url: `https://github.com/cuppet-org/cuppet/commit/${secondSha}`,
          distinct: true
        }
      ],
      head_commit: {
        id: secondSha,
        message: "Second commit",
        timestamp: "2026-07-15T10:25:00+00:00",
        url: `https://github.com/cuppet-org/cuppet/commit/${secondSha}`
      }
    },
    receivedAt
  );

  assert.ok(normalized);
  assert.equal(normalized.eventName, "push");
  assert.equal(normalized.externalAccountId, "991");
  assert.deepEqual(normalized.externalAccountAliases, ["cuppet-org"]);
  assert.equal(normalized.subjectId, "42");
  assert.equal(normalized.occurredAt.toISOString(), receivedAt.toISOString());
  assert.equal(normalized.payload.repository, "cuppet-org/cuppet");
  assert.equal(normalized.payload.ref, "refs/heads/main");
  assert.equal(normalized.payload.before, firstSha);
  assert.equal(normalized.payload.after, secondSha);

  const commits = normalized.payload.commits as Array<Record<string, unknown>>;
  assert.equal(commits.length, 2);
  assert.deepEqual(commits[0], {
    sha: firstSha,
    message: "Preserve the exact subject\nand body",
    timestamp: "2026-07-15T10:20:00Z",
    url: `https://github.com/cuppet-org/cuppet/commit/${firstSha}`,
    distinct: true,
    repository: "cuppet-org/cuppet",
    author: { name: "Author One", username: "author-one" },
    committer: { name: "Committer One", username: "committer-one" },
    added: ["src/new.ts"],
    removed: [],
    modified: ["src/existing.ts"]
  });
  assert.deepEqual(normalized.payload.head_commit, {
    sha: secondSha,
    message: "Second commit",
    timestamp: "2026-07-15T10:25:00+00:00",
    url: `https://github.com/cuppet-org/cuppet/commit/${secondSha}`,
    repository: "cuppet-org/cuppet"
  });
});

test("bounds oversized GitHub push commit arrays", () => {
  const commitCount = GITHUB_WEBHOOK_COMMIT_LIMIT + 7;
  const normalized = normalizeGitHubWebhookPayload("push", {
    ...githubEnvelope(),
    ref: "refs/heads/main",
    before: "a".repeat(40),
    after: "b".repeat(40),
    commits: Array.from({ length: commitCount }, (_, index) => ({
      id: index.toString(16).padStart(40, "0"),
      message: `Commit ${index}`,
      timestamp: "2026-07-15T10:20:00Z"
    }))
  });

  assert.ok(normalized);
  const commits = normalized.payload.commits as Array<Record<string, unknown>>;
  assert.equal(commits.length, GITHUB_WEBHOOK_COMMIT_LIMIT);
  assert.equal(normalized.payload.commit_count, commitCount);
  assert.equal(normalized.payload.commits_truncated, true);
  assert.equal(
    commits.at(-1)?.sha,
    (GITHUB_WEBHOOK_COMMIT_LIMIT - 1).toString(16).padStart(40, "0")
  );
});

test("sanitizes untrusted GitHub commit fields without losing the event", () => {
  const sha = "c".repeat(40);
  const normalized = normalizeGitHubWebhookPayload("push", {
    ...githubEnvelope(),
    commits: [
      {
        id: sha,
        message: "Remove\u0000 unsafe\u0007 controls",
        timestamp: "not-a-date",
        url: "javascript:alert(1)"
      }
    ]
  });

  assert.ok(normalized);
  const commits = normalized.payload.commits as Array<Record<string, unknown>>;
  assert.deepEqual(commits, [
    {
      sha,
      message: "Remove unsafe controls",
      repository: "cuppet-org/cuppet"
    }
  ]);
});

test("retains focused pull request, issue, release, and workflow metadata", () => {
  const pullRequest = normalizeGitHubWebhookPayload("pull_request", {
    ...githubEnvelope(),
    action: "opened",
    number: 17,
    pull_request: {
      id: 1700,
      number: 17,
      title: "Add webhook cursors",
      state: "open",
      draft: false,
      html_url: "https://github.com/cuppet-org/cuppet/pull/17",
      updated_at: "2026-07-15T10:00:00Z",
      user: { login: "octocat" },
      base: { ref: "main", sha: "d".repeat(40) },
      head: { ref: "webhook-cursors", sha: "e".repeat(40) }
    }
  });
  const issue = normalizeGitHubWebhookPayload("issues", {
    ...githubEnvelope(),
    action: "labeled",
    number: 23,
    issue: {
      id: 2300,
      number: 23,
      title: "Old commits are replayed",
      state: "open",
      html_url: "https://github.com/cuppet-org/cuppet/issues/23",
      updated_at: "2026-07-15T10:01:00Z",
      user: { login: "reporter" },
      labels: [{ name: "bug" }, { name: "realtime" }]
    }
  });
  const release = normalizeGitHubWebhookPayload("release", {
    ...githubEnvelope(),
    action: "published",
    release: {
      id: 300,
      tag_name: "v1.2.0",
      name: "Cursor release",
      draft: false,
      prerelease: false,
      html_url: "https://github.com/cuppet-org/cuppet/releases/tag/v1.2.0",
      published_at: "2026-07-15T10:02:00Z",
      author: { login: "maintainer" }
    }
  });
  const workflow = normalizeGitHubWebhookPayload("workflow_run", {
    ...githubEnvelope(),
    action: "completed",
    workflow_run: {
      id: 400,
      name: "Backend tests",
      event: "push",
      status: "completed",
      conclusion: "success",
      head_branch: "main",
      head_sha: "f".repeat(40),
      html_url: "https://github.com/cuppet-org/cuppet/actions/runs/400",
      run_number: 12,
      run_attempt: 1,
      updated_at: "2026-07-15T10:03:00Z",
      actor: { login: "octocat" }
    }
  });

  assert.equal(
    (pullRequest?.payload.pull_request as Record<string, unknown>).head_sha,
    "e".repeat(40)
  );
  assert.deepEqual(
    (issue?.payload.issue as Record<string, unknown>).labels,
    ["bug", "realtime"]
  );
  assert.equal(
    (release?.payload.release as Record<string, unknown>).tag_name,
    "v1.2.0"
  );
  assert.equal(
    (workflow?.payload.workflow_run as Record<string, unknown>).conclusion,
    "success"
  );
});

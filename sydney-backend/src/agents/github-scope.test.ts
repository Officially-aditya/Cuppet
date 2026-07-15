import assert from "node:assert/strict";
import test from "node:test";
import {
  extractGitHubRepository,
  githubRepositoryMatches,
  githubRepositoryScope
} from "./github-scope.js";

test("extracts explicitly named GitHub repositories from agent prompts", () => {
  const cases = [
    [
      "Track any changes in my repository Sydney and inform me immediately",
      "Sydney"
    ],
    ["Watch repo officially-aditya/Sydney", "officially-aditya/Sydney"],
    ["Watch repository Sydney.", "Sydney"],
    ["Monitor the GitHub repository called cuppet-api", "cuppet-api"],
    [
      "Watch https://github.com/Officially-aditya/Sydney.git for pushes",
      "Officially-aditya/Sydney"
    ],
    ["Monitor git@github.com:owner/private-repo.git", "owner/private-repo"]
  ] as const;

  for (const [prompt, expected] of cases) {
    assert.equal(extractGitHubRepository(prompt), expected, prompt);
  }
});

test("does not invent a scope for generic repository-agent language", () => {
  for (const prompt of [
    "Send me a daily GitHub repository activity digest",
    "Watch my repository for changes",
    "Summarize repositories, open issues, and pull requests",
    "Create a GitHub repo watcher"
  ]) {
    assert.equal(extractGitHubRepository(prompt), null, prompt);
  }
});

test("prefers persisted scope and falls back to old agents' prompts", () => {
  assert.equal(
    githubRepositoryScope(
      { github_repository: "owner/current" },
      "Watch repo owner/old"
    ),
    "owner/current"
  );
  assert.equal(
    githubRepositoryScope({}, "Watch repository Sydney"),
    "Sydney"
  );
});

test("matches full or bare repository scopes without affecting generic agents", () => {
  assert.equal(githubRepositoryMatches(null, "owner/anything"), true);
  assert.equal(
    githubRepositoryMatches("Officially-aditya/Sydney", "officially-aditya/sydney"),
    true
  );
  assert.equal(githubRepositoryMatches("Sydney", "another-owner/SYDNEY"), true);
  assert.equal(githubRepositoryMatches("Sydney", "owner/other"), false);
  assert.equal(githubRepositoryMatches("Sydney", undefined), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { githubAssistantQuery } from "./connector-tools.js";

test("extracts the repository and latest-commit mode from natural GitHub questions", () => {
  assert.deepEqual(
    githubAssistantQuery(
      "Can you provide me details of the last commit in Sydney project?"
    ),
    { repository: "Sydney", latestCommit: true }
  );
  assert.deepEqual(
    githubAssistantQuery(
      "What is the latest commit for officially-aditya/Sydney?"
    ),
    { repository: "officially-aditya/Sydney", latestCommit: true }
  );
});

test("does not turn generic GitHub wording into a repository filter", () => {
  assert.deepEqual(githubAssistantQuery("Show my recent GitHub activity"), {
    latestCommit: false
  });
});

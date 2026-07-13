import assert from "node:assert/strict";
import test from "node:test";
import { shouldRetryAgentRun } from "./run-lifecycle.js";

test("retries non-final attempts and stops after the configured limit", () => {
  assert.equal(shouldRetryAgentRun(0, 2), true);
  assert.equal(shouldRetryAgentRun(1, 2), false);
  assert.equal(shouldRetryAgentRun(0, 1), false);
  assert.equal(shouldRetryAgentRun(0, undefined), false);
});

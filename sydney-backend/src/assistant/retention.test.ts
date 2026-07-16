import assert from "node:assert/strict";
import test from "node:test";
import { isMessageWithinRetention } from "./retention.js";

test("the exact 30-day boundary is inaccessible", () => {
  const now = "2026-07-16T12:00:00.000Z";
  assert.equal(isMessageWithinRetention("2026-06-16T12:00:00.001Z", now, 30), true);
  assert.equal(isMessageWithinRetention("2026-06-16T12:00:00.000Z", now, 30), false);
  assert.equal(isMessageWithinRetention("2026-06-16T11:59:59.999Z", now, 30), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { feedbackRequestSchema } from "./routes.js";

test("normalizes and validates product feedback", () => {
  const parsed = feedbackRequestSchema.safeParse({
    topic: "product_idea",
    message: "  The inbox is easy to scan.  "
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.message, "The inbox is easy to scan.");
  }
});

test("rejects invalid or unexpected feedback payloads", () => {
  assert.equal(
    feedbackRequestSchema.safeParse({
      topic: "unknown",
      message: "A note"
    }).success,
    false
  );
  assert.equal(
    feedbackRequestSchema.safeParse({
      topic: "general_feedback",
      message: "   "
    }).success,
    false
  );
  assert.equal(
    feedbackRequestSchema.safeParse({
      topic: "general_feedback",
      message: "A note",
      email: "person@example.com"
    }).success,
    false
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { waitlistRequestSchema } from "./routes.js";

test("normalizes waitlist email addresses before persistence", () => {
  const parsed = waitlistRequestSchema.safeParse({
    email: "  Person@Example.COM "
  });

  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.email, "person@example.com");
});

test("rejects malformed or unexpected waitlist payloads", () => {
  assert.equal(
    waitlistRequestSchema.safeParse({ email: "not-an-email" }).success,
    false
  );
  assert.equal(
    waitlistRequestSchema.safeParse({
      email: "person@example.com",
      name: "Unexpected field"
    }).success,
    false
  );
});

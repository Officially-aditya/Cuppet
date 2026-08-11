import assert from "node:assert/strict";
import test from "node:test";
import { waitlistEmailIssue, waitlistRequestSchema } from "./routes.js";

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
  assert.equal(
    waitlistRequestSchema.safeParse({
      email: "person@example.com",
      website: ""
    }).success,
    true
  );
});

test("blocks disposable and obviously generated waitlist addresses", () => {
  assert.equal(waitlistEmailIssue("person@mailinator.com"), "disposable");
  assert.equal(waitlistEmailIssue("person@sub.mailinator.com"), "disposable");
  assert.equal(waitlistEmailIssue("123456789@gmail.com"), "random");
  assert.equal(waitlistEmailIssue("qz7xk2m9v4b6n8r1@gmail.com"), "random");
  assert.equal(waitlistEmailIssue("person@example.com"), null);
});

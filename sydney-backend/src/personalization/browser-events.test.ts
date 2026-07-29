import assert from "node:assert/strict";
import test from "node:test";
import { browserPreferenceEventSchema } from "./browser-events.js";

test("browser preference events accept only bounded domain-level data", () => {
  const parsed = browserPreferenceEventSchema.safeParse({
    event_id: "browser-event-123",
    event_type: "save",
    domain: "docs.example.com",
    category: "typescript",
    duration_seconds: 42
  });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal("url" in parsed.data, false);
});

test("browser preference events reject local hosts and oversized duration", () => {
  assert.equal(
    browserPreferenceEventSchema.safeParse({
      event_id: "browser-event-123",
      event_type: "page_view",
      domain: "localhost"
    }).success,
    false
  );
  assert.equal(
    browserPreferenceEventSchema.safeParse({
      event_id: "browser-event-123",
      event_type: "page_view",
      domain: "example.com",
      duration_seconds: 86_401
    }).success,
    false
  );
});

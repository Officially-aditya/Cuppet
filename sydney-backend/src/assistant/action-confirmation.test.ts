import assert from "node:assert/strict";
import test from "node:test";
import {
  assistantActionSummary,
  confirmableRouteFor,
  confirmedAssistantRoute,
  requiresActionConfirmation
} from "./action-confirmation.js";

test("captures only valid internal operations for durable confirmation", () => {
  assert.deepEqual(
    confirmableRouteFor({
      kind: "agent_rename",
      target: "News Agent",
      name: "Daily Brief"
    }),
    {
      kind: "agent_rename",
      target: "News Agent",
      name: "Daily Brief"
    }
  );
  assert.equal(confirmableRouteFor({ kind: "chat" }), null);
  assert.equal(
    confirmedAssistantRoute({
      kind: "agent_rename",
      target: "News Agent",
      name: "Daily Brief",
      injected: true
    }),
    null
  );
});

test("requires confirmation below the exact 0.8 action boundary", () => {
  const route = { kind: "create_agent" } as const;
  assert.equal(requiresActionConfirmation(route, 0.79), true);
  assert.equal(requiresActionConfirmation(route, 0.8), false);
  assert.equal(requiresActionConfirmation({ kind: "chat" }, 0.1), false);
});

test("describes the exact operation before it can run", () => {
  assert.deepEqual(
    assistantActionSummary({
      kind: "connector_query",
      connectors: ["gmail", "calendar"]
    }),
    {
      label: "Read connected Gmail and Calendar data",
      detail: "Use only those connected services to answer your original request."
    }
  );
  assert.deepEqual(
    assistantActionSummary({
      kind: "memory_forget",
      target: "old address",
      all: false
    }),
    {
      label: "Forget memories matching “old address”",
      detail: "Remove matching active and compacted memory entries."
    }
  );
});

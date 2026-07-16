import assert from "node:assert/strict";
import test from "node:test";
import {
  agentSelectionQuestion,
  selectedAgentRoute,
  selectionIntentForRoute
} from "./agent-selection.js";

test("captures only target-specific agent routes for user confirmation", () => {
  assert.deepEqual(
    selectionIntentForRoute({
      kind: "agent_manage",
      operation: "delete",
      target: "model-selected target"
    }),
    { kind: "agent_manage", operation: "delete" }
  );
  assert.deepEqual(
    selectionIntentForRoute({
      kind: "agent_rename",
      target: "old",
      name: "Daily Brief"
    }),
    { kind: "agent_rename", name: "Daily Brief" }
  );
  assert.equal(selectionIntentForRoute({ kind: "agent_list" }), null);
  assert.equal(selectionIntentForRoute({ kind: "create_agent" }), null);
});

test("resumes a validated operation with the user-selected agent name", () => {
  assert.deepEqual(
    selectedAgentRoute(
      { kind: "agent_manage", operation: "delete" },
      "News Agent"
    ),
    { kind: "agent_manage", operation: "delete", target: "News Agent" }
  );
  assert.deepEqual(
    selectedAgentRoute({ kind: "agent_status" }, "Calendar Agent"),
    { kind: "agent_list", target: "Calendar Agent" }
  );
  assert.equal(
    selectedAgentRoute(
      { kind: "agent_manage", operation: "delete", target: "injected" },
      "News Agent"
    ),
    null
  );
});

test("selection questions describe the pending operation", () => {
  assert.equal(
    agentSelectionQuestion({ kind: "agent_manage", operation: "pause" }),
    "Which agent should I pause?"
  );
  assert.equal(
    agentSelectionQuestion({ kind: "agent_rename", name: "Daily Brief" }),
    "Which agent should I rename to Daily Brief?"
  );
});

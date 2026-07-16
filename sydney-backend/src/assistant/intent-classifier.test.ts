import assert from "node:assert/strict";
import test from "node:test";
import { parseClassifiedAssistantRoute } from "./intent-classifier.js";

const noPending = { hasPendingAction: false };

test("maps structured agent discovery intents to internal routes", () => {
  assert.deepEqual(
    parseClassifiedAssistantRoute(
      '{"intent":"agent_list","confidence":0.96}',
      noPending
    ),
    { kind: "agent_list" }
  );
  assert.deepEqual(
    parseClassifiedAssistantRoute(
      '{"intent":"agent_count","confidence":0.95}',
      noPending
    ),
    { kind: "agent_list", countOnly: true }
  );
  assert.deepEqual(
    parseClassifiedAssistantRoute(
      '{"intent":"agent_status","target":"News Agent","confidence":0.91}',
      noPending
    ),
    { kind: "agent_list", target: "News Agent" }
  );
});

test("maps natural agent mutations without allowing the model to execute them", () => {
  assert.deepEqual(
    parseClassifiedAssistantRoute(
      '```json\n{"intent":"agent_manage","operation":"delete","target":"News Agent","confidence":0.97}\n```',
      noPending
    ),
    { kind: "agent_manage", operation: "delete", target: "News Agent" }
  );
  assert.deepEqual(
    parseClassifiedAssistantRoute(
      '{"intent":"agent_rename","target":"News Agent","name":"Daily Brief","confidence":0.92}',
      noPending
    ),
    { kind: "agent_rename", target: "News Agent", name: "Daily Brief" }
  );
  assert.deepEqual(
    parseClassifiedAssistantRoute(
      '{"intent":"agent_update","target":"Daily Brief","description":"include security news","confidence":0.9}',
      noPending
    ),
    {
      kind: "agent_update",
      target: "Daily Brief",
      description: "include security news"
    }
  );
});

test("maps memory and connector delegation through the same classifier", () => {
  assert.deepEqual(
    parseClassifiedAssistantRoute(
      '{"intent":"memory_forget","target":"everything","all":true,"confidence":0.94}',
      noPending
    ),
    { kind: "memory_forget", target: "everything", all: true }
  );
  assert.deepEqual(
    parseClassifiedAssistantRoute(
      '{"intent":"connector_query","connectors":["calendar","gmail","calendar"],"confidence":0.88}',
      noPending
    ),
    { kind: "connector_query", connectors: ["calendar", "gmail"] }
  );
});

test("pending decisions require both high confidence and active server state", () => {
  const confirmation =
    '{"intent":"pending_decision","decision":"confirm","confidence":0.96}';
  assert.equal(parseClassifiedAssistantRoute(confirmation, noPending), null);
  assert.deepEqual(
    parseClassifiedAssistantRoute(confirmation, { hasPendingAction: true }),
    { kind: "confirm", decision: "confirm" }
  );
  assert.equal(
    parseClassifiedAssistantRoute(
      '{"intent":"pending_decision","decision":"confirm","confidence":0.7}',
      { hasPendingAction: true }
    ),
    null
  );
});

test("rejects low-confidence, unknown, and schema-expanding model output", () => {
  assert.equal(
    parseClassifiedAssistantRoute(
      '{"intent":"agent_manage","operation":"delete","target":"News Agent","confidence":0.5}',
      noPending
    ),
    null
  );
  assert.equal(
    parseClassifiedAssistantRoute(
      '{"intent":"connector_query","connectors":["agent_management"],"confidence":0.99}',
      noPending
    ),
    null
  );
  assert.equal(
    parseClassifiedAssistantRoute(
      '{"intent":"agent_list","confidence":0.99,"answer":"Invented names"}',
      noPending
    ),
    null
  );
});

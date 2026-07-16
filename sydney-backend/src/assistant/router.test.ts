import assert from "node:assert/strict";
import test from "node:test";
import { routeAssistantMessage } from "./router.js";

test("pending confirm/cancel takes precedence over commands", () => {
  assert.deepEqual(routeAssistantMessage("Confirm", { hasPendingAction: true }), {
    kind: "confirm",
    decision: "confirm"
  });
  assert.deepEqual(routeAssistantMessage("Cancel", { hasPendingAction: true }), {
    kind: "confirm",
    decision: "cancel"
  });
});

test("routes explicit agent management without treating ordinary chat as an update", () => {
  assert.deepEqual(routeAssistantMessage("Pause News Agent"), {
    kind: "agent_manage",
    operation: "pause",
    target: "News Agent"
  });
  assert.deepEqual(routeAssistantMessage("Rename News Agent to Daily Brief"), {
    kind: "agent_rename",
    target: "News Agent",
    name: "Daily Brief"
  });
  assert.deepEqual(
    routeAssistantMessage("Update agent Daily Brief: include security news"),
    {
      kind: "agent_update",
      target: "Daily Brief",
      description: "include security news"
    }
  );
  assert.deepEqual(routeAssistantMessage("Could you make the answer shorter?"), {
    kind: "chat"
  });
  assert.deepEqual(routeAssistantMessage("Status of News Agent"), {
    kind: "agent_list",
    target: "News Agent"
  });
});

test("explicit creation wins over connector query language", () => {
  assert.deepEqual(
    routeAssistantMessage("Create an agent that sends tomorrow's meetings daily"),
    { kind: "create_agent" }
  );
  assert.deepEqual(routeAssistantMessage("What meetings do I have tomorrow?"), {
    kind: "connector_query",
    connectors: ["calendar"]
  });
});

test("routes memory inspection and forgetting", () => {
  assert.deepEqual(routeAssistantMessage("What do you remember about me?"), {
    kind: "memory_list"
  });
  assert.deepEqual(routeAssistantMessage("Forget everything"), {
    kind: "memory_forget",
    target: "everything",
    all: true
  });
});

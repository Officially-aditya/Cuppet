import assert from "node:assert/strict";
import test from "node:test";
import {
  agentWorkerRuntimeStatus,
  setAgentWorkerRuntimeStatus
} from "./runtime-status.js";

test("reports worker readiness transitions used by the health endpoint", () => {
  setAgentWorkerRuntimeStatus("starting");
  assert.equal(agentWorkerRuntimeStatus(), "starting");
  setAgentWorkerRuntimeStatus("ready");
  assert.equal(agentWorkerRuntimeStatus(), "ready");
  setAgentWorkerRuntimeStatus("disabled");
});

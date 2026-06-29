import assert from "node:assert/strict";
import test from "node:test";
import { agentExecutionKey } from "./execution-key.js";

test("scheduled jobs with different scheduler IDs share a delivery key", () => {
  const first = agentExecutionKey({
    agentId: "agent-1",
    trigger: "schedule",
    jobId: "repeat:old-scheduler:1781965800000",
    timestamp: 1781965700000
  });
  const second = agentExecutionKey({
    agentId: "agent-1",
    trigger: "schedule",
    jobId: "repeat:new-scheduler:1781965800000",
    timestamp: 1781965750000
  });

  assert.equal(first, second);
});

test("manual jobs retain distinct delivery keys", () => {
  const first = agentExecutionKey({
    agentId: "agent-1",
    trigger: "manual",
    jobId: "1",
    timestamp: 1781965800000
  });
  const second = agentExecutionKey({
    agentId: "agent-1",
    trigger: "manual",
    jobId: "2",
    timestamp: 1781965800000
  });

  assert.notEqual(first, second);
});

test("snooze jobs retain distinct delivery keys", () => {
  const first = agentExecutionKey({
    agentId: "agent-1",
    trigger: "snooze",
    jobId: "snooze-1",
    timestamp: 1781965800000
  });
  const second = agentExecutionKey({
    agentId: "agent-1",
    trigger: "snooze",
    jobId: "snooze-2",
    timestamp: 1781965800000
  });

  assert.notEqual(first, second);
  assert.match(first!, /^snooze:/);
});

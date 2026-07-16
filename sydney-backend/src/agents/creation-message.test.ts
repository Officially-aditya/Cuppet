import assert from "node:assert/strict";
import test from "node:test";
import {
  agentCreationReadyDetail,
  agentCreationThreadMessage
} from "./creation-message.js";
import { describeSchedule } from "./message-router.js";
import { parseIntent } from "./parser.js";

test("asks the user to connect GitHub in a new GitHub agent thread", () => {
  const parsedIntent = parseIntent(
    "Create a daily GitHub digest for repositories, issues, and pull requests."
  );
  const message = agentCreationThreadMessage({
    parsedIntent,
    githubConnected: false,
    readyDetail: "It will run daily."
  });

  assert.equal(message.role, "agent");
  assert.equal(message.content.template, "daily_task");
  assert.match(
    message.content.data.task?.toString() ?? "",
    /Summarizes recently updated repositories/i
  );
  assert.match(
    message.content.data.task?.toString() ?? "",
    /I’ll run daily/i
  );
  assert.match(
    message.content.data.context?.toString() ?? "",
    /can’t read repository activity until you authorize GitHub/i
  );
  assert.deepEqual(message.content.data.actions, [
    {
      id: "connect_github",
      type: "connector_connect",
      connector_id: "github",
      connector_name: "GitHub",
      run_after_connect: true,
      label: "Connect GitHub",
      style: "primary"
    }
  ]);
});

test("introduces a ready agent with capability, timing, access, and controls", () => {
  const parsedIntent = parseIntent("Create a daily GitHub repository digest.");
  const message = agentCreationThreadMessage({
    parsedIntent,
    githubConnected: true,
    readyDetail: "It will run daily."
  });

  assert.equal(message.role, "agent");
  assert.equal(message.content.template, "data_summary");
  assert.equal(message.content.data.kind, "agent_introduction");
  assert.equal(
    message.content.data.text,
    "Hi, I’m GitHub Activity. I’m set up and ready to help."
  );
  const summary = message.content.data.summary?.toString() ?? "";
  assert.match(summary, /What I do:/);
  assert.match(summary, /Summarizes recently updated repositories/i);
  assert.match(summary, /When I run:\nI’ll run daily\./);
  assert.match(summary, /Access and safety:/);
  assert.match(summary, /GitHub profile and repository read access/);
  assert.match(summary, /I only read data and prepare updates/);
  assert.match(summary, /Controls:/);
  assert.match(summary, /ask me to run now/i);
});

test("describes realtime agents without inventing a daily schedule", () => {
  const parsedIntent = parseIntent(
    "Track changes in my GitHub repository and inform me immediately."
  );

  assert.equal(
    agentCreationReadyDetail(parsedIntent),
    "It will react to matching activity and notify you immediately."
  );
  assert.doesNotMatch(agentCreationReadyDetail(parsedIntent), /daily|9:00/i);
});

test("renders scheduled introductions in human-readable time", () => {
  const parsedIntent = parseIntent("Create a daily calendar agenda.");

  assert.equal(
    agentCreationReadyDetail(parsedIntent, describeSchedule),
    "It will run every day at 9:00 AM."
  );
});

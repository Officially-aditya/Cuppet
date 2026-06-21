import assert from "node:assert/strict";
import test from "node:test";
import { agentCreationThreadMessage } from "./creation-message.js";
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
  assert.equal(
    message.content.data.task,
    "To run this agent, you need to connect GitHub."
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

test("keeps the ready system message when GitHub is connected", () => {
  const parsedIntent = parseIntent("Create a daily GitHub repository digest.");
  const message = agentCreationThreadMessage({
    parsedIntent,
    githubConnected: true,
    readyDetail: "It will run daily."
  });

  assert.equal(message.role, "system");
  assert.equal(message.content.template, "system");
  assert.equal(message.content.data.message, "GitHub Activity is ready.");
});

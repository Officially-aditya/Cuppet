import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAgentTargetFromList
} from "./agent-target.js";

function agent(id: string, name: string) {
  return { id, name };
}

test("agent targets prefer an exact case-insensitive name", () => {
  const result = resolveAgentTargetFromList(
    [agent("1", "News"), agent("2", "News Agent")],
    "news agent"
  );
  assert.equal(result.kind, "resolved");
  if (result.kind === "resolved") assert.equal(result.agent.id, "2");
});

test("agent targets accept only a unique normalized prefix", () => {
  const unique = resolveAgentTargetFromList(
    [agent("1", "Daily News"), agent("2", "Calendar Brief")],
    "daily"
  );
  assert.equal(unique.kind, "resolved");

  const ambiguous = resolveAgentTargetFromList(
    [agent("1", "Daily News"), agent("2", "Daily Tasks")],
    "daily"
  );
  assert.equal(ambiguous.kind, "ambiguous");
  if (ambiguous.kind === "ambiguous") {
    assert.deepEqual(ambiguous.matches.map((item) => item.name), [
      "Daily News",
      "Daily Tasks"
    ]);
  }
});

test("agent targets never fuzzy-match a typo", () => {
  assert.equal(
    resolveAgentTargetFromList([agent("1", "News Agent")], "Nwes").kind,
    "not_found"
  );
});

test("agent targets ignore conversational filler and resolve unique name tokens", () => {
  const result = resolveAgentTargetFromList(
    [
      agent("1", "Sydney Repository Monitor"),
      agent("2", "Portfolio Watch")
    ],
    "the sydney monitor agent"
  );

  assert.equal(result.kind, "resolved");
  if (result.kind === "resolved") assert.equal(result.agent.id, "1");
});

test("partial token matches remain ambiguous when multiple real agents match", () => {
  const result = resolveAgentTargetFromList(
    [
      agent("1", "Sydney Repository Monitor"),
      agent("2", "Sydney Deployment Monitor")
    ],
    "sydney monitor"
  );

  assert.equal(result.kind, "ambiguous");
});

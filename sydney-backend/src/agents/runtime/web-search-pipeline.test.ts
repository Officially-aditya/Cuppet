import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hasPrivateConnectors,
  isExplicitWebSearchRequested,
  shouldPerformWebSearch
} from "./web-search-pipeline.js";

describe("Web Search Pipeline Rules", () => {
  it("detects private workspace connectors", () => {
    assert.equal(hasPrivateConnectors(["gmail"]), true);
    assert.equal(hasPrivateConnectors(["slack"]), true);
    assert.equal(hasPrivateConnectors(["github"]), true);
    assert.equal(hasPrivateConnectors(["notion"]), true);
    assert.equal(hasPrivateConnectors(["drive"]), true);
    assert.equal(hasPrivateConnectors(["calendar"]), true);
    assert.equal(hasPrivateConnectors(["google_drive"]), true);
    assert.equal(hasPrivateConnectors(["google_calendar"]), true);

    assert.equal(hasPrivateConnectors([]), false);
    assert.equal(hasPrivateConnectors(["web_search"]), false);
  });

  it("detects explicit web search requests in prompt", () => {
    assert.equal(
      isExplicitWebSearchRequested("Please search the web for AI developments"),
      true
    );
    assert.equal(
      isExplicitWebSearchRequested("Google search latest tech releases"),
      true
    );
    assert.equal(
      isExplicitWebSearchRequested("Look up online market trends"),
      true
    );

    assert.equal(
      isExplicitWebSearchRequested("Summarize my daily task inbox"),
      false
    );
    assert.equal(
      isExplicitWebSearchRequested("Give me a study guide for linear algebra"),
      false
    );
  });

  it("never performs automatic web search for connector-based agents unless explicitly requested", () => {
    // Connector-based agent without explicit search instruction -> false
    assert.equal(
      shouldPerformWebSearch({
        prompt: "Summarize my unread emails and calendar events",
        connectorIds: ["gmail", "calendar"]
      }),
      false
    );

    assert.equal(
      shouldPerformWebSearch({
        prompt: "Summarize the project files in my Drive",
        connectorIds: ["drive"]
      }),
      false
    );

    // Connector-based agent WITH explicit search request -> true
    assert.equal(
      shouldPerformWebSearch({
        prompt: "Check my email for flight status and search web for destination weather",
        connectorIds: ["gmail"]
      }),
      true
    );
  });

  it("automatically performs web search for stand-alone agents without private connectors", () => {
    // Stand-alone custom topic agent -> true automatically
    assert.equal(
      shouldPerformWebSearch({
        prompt: "Daily breakdown of major Tech and AI breakthroughs",
        connectorIds: []
      }),
      true
    );

    assert.equal(
      shouldPerformWebSearch({
        prompt: "Cryptocurrency market trends update",
        connectorIds: ["web_search"]
      }),
      true
    );
  });
});

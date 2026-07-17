import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAgentChatMode,
  extractPostSearchText,
  hasWebSearchEvidence,
  isStrongResearchIntent,
  refersToPriorContext
} from "./agent-chat.js";
import type { LlmContentBlock } from "./llm-types.js";

test("classifies strong external lookups as research", () => {
  assert.equal(classifyAgentChatMode("search for UGC NET updates"), "research");
  assert.equal(classifyAgentChatMode("look up React 19 release notes"), "research");
  assert.equal(classifyAgentChatMode("what's the latest news on OpenAI"), "research");
  assert.equal(classifyAgentChatMode("what happened with the Fed today"), "research");
  assert.equal(classifyAgentChatMode("find arxiv papers on transformers"), "research");
  assert.equal(
    classifyAgentChatMode("Was Anthropic Claude 5 announced?"),
    "research"
  );
  assert.equal(
    classifyAgentChatMode("search for inkling and write draft on it"),
    "research"
  );
});

test("content extractor draft-about-topic uses research mode", () => {
  assert.equal(
    classifyAgentChatMode("write a draft about Inkling", {
      contentExtractor: true
    }),
    "research"
  );
  assert.equal(
    classifyAgentChatMode("draft a twitter post on remote work trends", {
      contentExtractor: true
    }),
    "research"
  );
});

test("keeps grounded mode for follow-ups and weak wording", () => {
  assert.equal(classifyAgentChatMode("explain more"), "grounded");
  assert.equal(classifyAgentChatMode("why is that important?"), "grounded");
  assert.equal(classifyAgentChatMode("how does this work?"), "grounded");
  assert.equal(classifyAgentChatMode("show only urgent ones"), "grounded");
  assert.equal(classifyAgentChatMode("give me the link"), "grounded");
  assert.equal(classifyAgentChatMode("summarize the third item"), "grounded");
  assert.equal(
    classifyAgentChatMode("search for more on the second story"),
    "grounded"
  );
  assert.equal(
    classifyAgentChatMode("look up the company mentioned above"),
    "grounded"
  );
});

test("detects prior-thread referents", () => {
  assert.equal(refersToPriorContext("tell me about that"), true);
  assert.equal(refersToPriorContext("the second item"), true);
  assert.equal(refersToPriorContext("item #3 please"), true);
  assert.equal(refersToPriorContext("in your last report"), true);
  assert.equal(refersToPriorContext("search for climate news this week"), false);
});

test("strong research intent is narrower than the old keyword soup", () => {
  assert.equal(isStrongResearchIntent("search for climate news"), true);
  assert.equal(isStrongResearchIntent("latest news on chips"), true);
  assert.equal(isStrongResearchIntent("more detail please"), false);
  assert.equal(isStrongResearchIntent("explain background"), false);
  assert.equal(isStrongResearchIntent("why how sources"), false);
});

test("hasWebSearchEvidence detects tool results and citations", () => {
  const withTool: LlmContentBlock[] = [
    {
      type: "web_search_tool_result",
      tool_use_id: "ws1",
      content: [{ type: "web_search_result", url: "https://example.com", title: "Ex" }]
    },
    { type: "text", text: "Answer from search." }
  ];
  assert.equal(hasWebSearchEvidence(withTool), true);

  const withCitation: LlmContentBlock[] = [
    {
      type: "text",
      text: "Cited.",
      citations: [
        {
          type: "web_search_result_location",
          url: "https://example.com",
          title: "Ex"
        }
      ]
    }
  ];
  assert.equal(hasWebSearchEvidence(withCitation), true);
  assert.equal(hasWebSearchEvidence([{ type: "text", text: "No tools." }]), false);
});

test("extractPostSearchText prefers text after the last search result", () => {
  const content: LlmContentBlock[] = [
    { type: "text", text: "Draft before search should be ignored. " },
    {
      type: "web_search_tool_result",
      tool_use_id: "ws1",
      content: [{ type: "web_search_result", url: "https://a.com", title: "A" }]
    },
    { type: "text", text: "Final answer after search." }
  ];
  assert.equal(extractPostSearchText(content), "Final answer after search.");
});

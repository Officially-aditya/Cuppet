import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../config.js";
import { renderLlmCustomAgent } from "./custom-agent.js";

test("custom agents retry with Tavily evidence when native web search returns no sources", async () => {
  const originalProvider = config.LLM_PROVIDER;
  const originalGeminiKey = config.GEMINI_API_KEY;
  const originalTavilyKey = config.TAVILY_API_KEY;
  const originalFirecrawlKey = config.FIRECRAWL_API_KEY;
  const originalFetch = globalThis.fetch;
  const geminiRequests: Record<string, unknown>[] = [];
  const tavilyRequests: Record<string, unknown>[] = [];

  try {
    config.LLM_PROVIDER = "gemini";
    config.GEMINI_API_KEY = "test-gemini-key";
    config.TAVILY_API_KEY = "tvly-test";
    config.FIRECRAWL_API_KEY = undefined;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (url === "https://api.tavily.com/search") {
        tavilyRequests.push(body);
        return new Response(
          JSON.stringify({
            results: [
              {
                title: "Reliable source",
                url: "https://example.com/source",
                content: "A verified recent development."
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
      if (url.startsWith("https://generativelanguage.googleapis.com/")) {
        geminiRequests.push(body);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: geminiRequests.length === 1
                        ? "Ungrounded native response"
                        : "Evidence-grounded fallback response"
                    }
                  ]
                },
                finishReason: "STOP"
              }
            ]
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    };

    const rendered = await renderLlmCustomAgent({
      agentName: "Tech radar",
      prompt: "Summarize current technology developments.",
      action: "Prepare a current technology report.",
      heading: "Your update"
    });

    assert.equal(tavilyRequests.length, 1);
    assert.equal(geminiRequests.length, 2);
    assert.deepEqual(geminiRequests[0]?.tools, [{ googleSearch: {} }]);
    assert.equal(geminiRequests[1]?.tools, undefined);
    assert.match(JSON.stringify(geminiRequests[1]), /web_search_results/);
    assert.equal(rendered?.content.template, "plain_text");
    if (rendered?.content.template === "plain_text") {
      assert.equal(
        rendered.content.data.body,
        "Evidence-grounded fallback response"
      );
    }
    assert.deepEqual(rendered?.sourceRefs, [
      {
        type: "web_search_result",
        title: "Reliable source",
        url: "https://example.com/source"
      }
    ]);
  } finally {
    config.LLM_PROVIDER = originalProvider;
    config.GEMINI_API_KEY = originalGeminiKey;
    config.TAVILY_API_KEY = originalTavilyKey;
    config.FIRECRAWL_API_KEY = originalFirecrawlKey;
    globalThis.fetch = originalFetch;
  }
});

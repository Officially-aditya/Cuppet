import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../config.js";
import { createAgentChatReply } from "./agent-chat.js";
import { createAssistantChatReply } from "./assistant-chat.js";
import type { ParsedIntent } from "./parser.js";

const researchIntent: ParsedIntent = {
  name: "Research",
  avatar: "search",
  intent: "web_search_agent",
  connector: "web_search",
  connector_ids: ["web_search"],
  unsupported_connector: null,
  action: "Researches user-requested topics.",
  schedule_cron: null,
  output_template: "news_brief",
  template_config: {},
  safety_level: "read",
  risk_level: "low",
  permissions_needed: [],
  response_limit: "concise"
};

test("Assistant uses Tavily evidence for explicit manual search", async () => {
  await withSearchProviders(async (requests) => {
    const reply = await createAssistantChatReply(
      "search for new solid-state battery announcements"
    );

    assert.equal(requests.tavily.length, 1);
    assert.equal(requests.firecrawl.length, 0);
    assert.equal(requests.gemini.length, 1);
    assert.equal(requests.gemini[0]?.tools, undefined);
    assert.match(JSON.stringify(requests.gemini[0]), /web_search_results/);
    assert.match(reply, /https:\/\/example\.com\/battery/);
  });
});

test("agent chat uses Tavily only for explicit manual research", async () => {
  await withSearchProviders(async (requests) => {
    const reply = await createAgentChatReply({
      agent: {
        name: "Research",
        prompt: "Research technology topics on request.",
        parsed_intent: researchIntent
      },
      latestAgentOutput: "Old output that must not be reused.",
      sourceRefs: [],
      recentUserMessages: ["Old conversation that must not be reused."],
      userText: "look up new solid-state battery announcements"
    });

    assert.equal(requests.tavily.length, 1);
    assert.equal(requests.firecrawl.length, 0);
    assert.equal(requests.gemini.length, 1);
    assert.equal(requests.gemini[0]?.tools, undefined);
    const geminiRequest = JSON.stringify(requests.gemini[0]);
    assert.match(geminiRequest, /web_search_results/);
    assert.doesNotMatch(geminiRequest, /Old output/);
    assert.doesNotMatch(geminiRequest, /Old conversation/);
    assert.match(reply, /https:\/\/example\.com\/battery/);
  });
});

test("Tavily failure falls back to Firecrawl search", async () => {
  await withSearchProviders(
    async (requests) => {
      const reply = await createAssistantChatReply(
        "search for new solid-state battery announcements"
      );

      assert.equal(requests.tavily.length, 1);
      assert.equal(requests.firecrawl.length, 1);
      assert.equal(requests.gemini[0]?.tools, undefined);
      assert.match(reply, /https:\/\/example\.com\/firecrawl-battery/);
    },
    { tavilyStatus: 503 }
  );
});

test("external search failures fall back to Gemini native search", async () => {
  await withSearchProviders(
    async (requests) => {
      const reply = await createAssistantChatReply(
        "search for new solid-state battery announcements"
      );

      assert.equal(requests.tavily.length, 1);
      assert.equal(requests.firecrawl.length, 1);
      assert.deepEqual(requests.gemini[0]?.tools, [{ googleSearch: {} }]);
      assert.equal(reply, "Native grounded answer");
    },
    { tavilyStatus: 503, firecrawlStatus: 429, nativeGrounding: true }
  );
});

test("non-manual current-information queries skip Tavily", async () => {
  await withSearchProviders(
    async (requests) => {
      await createAssistantChatReply(
        "what's the latest news on solid-state batteries?"
      );

      assert.equal(requests.tavily.length, 0);
      assert.equal(requests.firecrawl.length, 0);
      assert.deepEqual(requests.gemini[0]?.tools, [{ googleSearch: {} }]);
    },
    { nativeGrounding: true }
  );
});

async function withSearchProviders(
  run: (requests: {
    tavily: Record<string, unknown>[];
    firecrawl: Record<string, unknown>[];
    gemini: Record<string, unknown>[];
  }) => Promise<void>,
  options: {
    tavilyStatus?: number;
    firecrawlStatus?: number;
    nativeGrounding?: boolean;
  } = {}
): Promise<void> {
  const originalProvider = config.LLM_PROVIDER;
  const originalGeminiKey = config.GEMINI_API_KEY;
  const originalTavilyKey = config.TAVILY_API_KEY;
  const originalFirecrawlKey = config.FIRECRAWL_API_KEY;
  const originalFetch = globalThis.fetch;
  const requests = {
    tavily: [] as Record<string, unknown>[],
    firecrawl: [] as Record<string, unknown>[],
    gemini: [] as Record<string, unknown>[]
  };

  try {
    config.LLM_PROVIDER = "gemini";
    config.GEMINI_API_KEY = "test-gemini-key";
    config.TAVILY_API_KEY = "tvly-test";
    config.FIRECRAWL_API_KEY = "fc-test";
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      if (url === "https://api.tavily.com/search") {
        requests.tavily.push(body);
        const status = options.tavilyStatus ?? 200;
        return new Response(
          status === 200
            ? JSON.stringify({
                request_id: "request-123",
                results: [
                  {
                    title: "Battery source",
                    url: "https://example.com/battery",
                    content:
                      "A manufacturer announced a solid-state battery pilot."
                  }
                ]
              })
            : JSON.stringify({ detail: "Search unavailable" }),
          {
            status,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (url === "https://api.firecrawl.dev/v2/search") {
        requests.firecrawl.push(body);
        const status = options.firecrawlStatus ?? 200;
        return new Response(
          status === 200
            ? JSON.stringify({
                success: true,
                id: "firecrawl-request-123",
                data: {
                  web: [
                    {
                      title: "Firecrawl battery source",
                      url: "https://example.com/firecrawl-battery",
                      description:
                        "A manufacturer opened a solid-state battery pilot."
                    }
                  ]
                }
              })
            : JSON.stringify({ success: false, error: "Search unavailable" }),
          {
            status,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (url.startsWith("https://generativelanguage.googleapis.com/")) {
        requests.gemini.push(body);
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: options.nativeGrounding
                        ? "Native grounded answer"
                        : "Evidence-grounded answer"
                    }
                  ]
                },
                finishReason: "STOP",
                ...(options.nativeGrounding
                  ? {
                      groundingMetadata: {
                        webSearchQueries: ["solid-state batteries"],
                        groundingChunks: [
                          {
                            web: {
                              uri: "https://example.com/native",
                              title: "Native source"
                            }
                          }
                        ]
                      }
                    }
                  : {})
              }
            ],
            usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      throw new Error(`Unexpected request URL: ${url}`);
    };

    await run(requests);
  } finally {
    config.LLM_PROVIDER = originalProvider;
    config.GEMINI_API_KEY = originalGeminiKey;
    config.TAVILY_API_KEY = originalTavilyKey;
    config.FIRECRAWL_API_KEY = originalFirecrawlKey;
    globalThis.fetch = originalFetch;
  }
}

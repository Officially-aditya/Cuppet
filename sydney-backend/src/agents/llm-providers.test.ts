import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../config.js";
import { createAnthropicMessage } from "./anthropic.js";
import { createGeminiMessage } from "./gemini.js";

test("Gemini adapter translates neutral web search into Google Search grounding", async () => {
  const originalKey = config.GEMINI_API_KEY;
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  try {
    config.GEMINI_API_KEY = "test-gemini-key";
    globalThis.fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: "Grounded answer" }] },
              finishReason: "STOP",
              groundingMetadata: {
                webSearchQueries: ["latest news"],
                groundingChunks: [
                  { web: { uri: "https://example.com/story", title: "Story" } }
                ]
              }
            }
          ],
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const response = await createGeminiMessage({
      system: "System",
      messages: [{ role: "user", content: "Find current news" }],
      tools: [{ name: "web_search" }]
    });

    assert.deepEqual(requestBody?.tools, [{ googleSearch: {} }]);
    assert.equal(response.content[0]?.type, "text");
    assert.equal(response.content[1]?.type, "web_search_tool_result");
  } finally {
    config.GEMINI_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  }
});

test("Anthropic adapter retains native Messages API and web-search support", async () => {
  const originalKey = config.ANTHROPIC_API_KEY;
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestHeaders: Headers | undefined;
  let requestBody: Record<string, unknown> | undefined;
  try {
    config.ANTHROPIC_API_KEY = "test-anthropic-key";
    globalThis.fetch = async (input, init) => {
      requestUrl = String(input);
      requestHeaders = new Headers(init?.headers);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          id: "msg_test",
          role: "assistant",
          content: [{ type: "text", text: "Claude answer" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 2, output_tokens: 3 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const response = await createAnthropicMessage({
      system: "System",
      messages: [{ role: "user", content: "Find current news" }],
      tools: [
        {
          name: "web_search",
          maxUses: 3
        }
      ]
    });

    assert.equal(requestUrl, "https://api.anthropic.com/v1/messages");
    assert.equal(requestHeaders?.get("x-api-key"), "test-anthropic-key");
    assert.equal(requestBody?.model, config.ANTHROPIC_MODEL);
    assert.deepEqual(requestBody?.tools, [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3
      }
    ]);
    assert.equal(response.content[0]?.type, "text");
  } finally {
    config.ANTHROPIC_API_KEY = originalKey;
    globalThis.fetch = originalFetch;
  }
});

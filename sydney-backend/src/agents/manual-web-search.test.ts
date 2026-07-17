import assert from "node:assert/strict";
import test from "node:test";
import {
  appendManualWebSearchSources,
  manualWebSearchQuery,
  searchTavily
} from "./manual-web-search.js";

test("manual search detection accepts explicit self-contained commands", () => {
  assert.equal(
    manualWebSearchQuery("search for React 20 release notes"),
    "React 20 release notes"
  );
  assert.equal(
    manualWebSearchQuery("Can you look up current RBI guidance?"),
    "current RBI guidance"
  );
  assert.equal(
    manualWebSearchQuery("please research solid-state battery announcements"),
    "solid-state battery announcements"
  );
  assert.equal(
    manualWebSearchQuery("search for Inkling and write a Reddit draft about it"),
    "Inkling"
  );
  assert.equal(
    manualWebSearchQuery("what's the latest news on semiconductors"),
    null
  );
  assert.equal(manualWebSearchQuery("explain the previous result"), null);
  assert.equal(manualWebSearchQuery("search for more on that story"), null);
  assert.equal(
    manualWebSearchQuery("look up the company mentioned above"),
    null
  );
});

test("Tavily search sends a bounded basic request and normalizes results", async () => {
  let requestUrl = "";
  let requestHeaders: Headers | undefined;
  let requestBody: Record<string, unknown> | undefined;

  const evidence = await searchTavily("battery news", {
    apiKey: "tvly-test",
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestHeaders = new Headers(init?.headers);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          request_id: "request-123",
          results: [
            {
              title: "Battery update",
              url: "https://example.com/update#section",
              content: "A manufacturer announced a new battery.",
              score: 0.92,
              published_date: "2026-07-17"
            },
            {
              title: "Unsafe URL",
              url: "file:///tmp/private",
              content: "Must be discarded."
            },
            {
              title: "Empty result",
              url: "https://example.com/empty",
              content: ""
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
  });

  assert.equal(requestUrl, "https://api.tavily.com/search");
  assert.equal(requestHeaders?.get("authorization"), "Bearer tvly-test");
  assert.deepEqual(requestBody, {
    query: "battery news",
    search_depth: "basic",
    topic: "general",
    max_results: 3,
    include_answer: false,
    include_raw_content: false,
    include_images: false
  });
  assert.equal(evidence?.requestId, "request-123");
  assert.deepEqual(evidence?.results, [
    {
      title: "Battery update",
      url: "https://example.com/update",
      content: "A manufacturer announced a new battery.",
      score: 0.92,
      publishedDate: "2026-07-17"
    }
  ]);
});

test("Tavily empty results allow native search fallback", async () => {
  const evidence = await searchTavily("missing topic", {
    apiKey: "tvly-test",
    fetchImpl: async () =>
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
  });

  assert.equal(evidence, null);
});

test("manual search answers always expose the retrieved source links", () => {
  const reply = appendManualWebSearchSources("Grounded answer.", {
    provider: "tavily",
    query: "test",
    results: [
      {
        title: "Example source",
        url: "https://example.com/source",
        content: "Evidence"
      }
    ]
  });

  assert.match(reply, /### Sources/);
  assert.match(reply, /\[Example source\]\(https:\/\/example\.com\/source\)/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAndValidateOutput } from "./runtime/output-registry.js";
import { normalizeNewsBriefJson } from "./runtime/structured-json.js";

test("news JSON normalization keeps valid fields and discards model extras", () => {
  const normalized = normalizeNewsBriefJson(
    [
      "```json",
      JSON.stringify({
        tldr: ["One", "Two", "Three"],
        items: [
          {
            headline: "Lead",
            summary: "Grounded summary.",
            source: "Example",
            url: "https://example.com/story",
            invented_field: "discard me"
          }
        ],
        perspectives: [
          {
            label: "View",
            summary: "Supported position.",
            url: "not a URL",
            extra: true
          }
        ],
        unexpected: "discard me"
      }),
      "```"
    ].join("\n")
  );

  assert.deepEqual(normalized, {
    tldr: ["One", "Two", "Three"],
    items: [
      {
        headline: "Lead",
        summary: "Grounded summary.",
        source: "Example",
        url: "https://example.com/story"
      }
    ],
    perspectives: [{ label: "View", summary: "Supported position." }]
  });
});

test("truncated news JSON salvages complete TLDR and story objects", () => {
  const normalized = normalizeNewsBriefJson(
    [
      '{"tldr":["One","Two","Three"],"items":[',
      '{"headline":"First","summary":"Complete first story"},',
      '{"headline":"Second","summary":"Complete second story"},',
      '{"headline":"Third","summary":"cut off'
    ].join("")
  );

  assert.deepEqual(normalized, {
    tldr: ["One", "Two", "Three"],
    items: [
      { headline: "First", summary: "Complete first story" },
      { headline: "Second", summary: "Complete second story" }
    ]
  });
});

test("news output boundary promotes JSON accidentally embedded in a summary", () => {
  const raw = JSON.stringify({
    tldr: ["One", "Two", "Three"],
    items: [
      {
        headline: "Recovered lead",
        summary: "This should render as a story."
      }
    ],
    why_it_matters: "Useful context."
  });
  const content = normalizeAndValidateOutput({
    template: "news_brief",
    version: "1.0",
    data: {
      title: "Here's the news you requested.",
      items: [{ summary: raw }],
      initialItemCount: 5
    }
  });

  assert.deepEqual(content.data, {
    title: "Here's the news you requested.",
    tldr: ["One", "Two", "Three"],
    items: [
      {
        headline: "Recovered lead",
        summary: "This should render as a story."
      }
    ],
    why_it_matters: "Useful context.",
    initialItemCount: 5
  });
});

test("news output boundary never exposes wholly truncated JSON", () => {
  const content = normalizeAndValidateOutput({
    template: "news_brief",
    version: "1.0",
    data: {
      title: "News",
      items: [
        {
          summary:
            '{"tldr":["unfinished"],"items":[{"headline":"Cut off","summary":"'
        }
      ]
    }
  });

  const summary = (content.data as any).items[0].summary as string;
  assert.match(summary, /couldn’t assemble a complete/);
  assert.doesNotMatch(summary, /\{"tldr"/);
});

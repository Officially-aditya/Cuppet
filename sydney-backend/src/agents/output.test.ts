import assert from "node:assert/strict";
import test from "node:test";
import { parseNewsBriefText } from "./output.js";

test("merges a heading-only brief field with its following detail", () => {
  const result = parseNewsBriefText(
    "Daily DSA practice",
    [
      "2. Daily LeetCode Practice",
      "Complete these two problems:",
      "- **Problem 1 (Easy):** [Contains Duplicate](https://leetcode.com/problems/contains-duplicate/)",
      "- **Focus:**",
      "  - Using a Hash Set to track seen elements.",
      "- **Problem 2 (Medium):** [Longest Substring](https://leetcode.com/problems/longest-substring-without-repeating-characters/)",
      "- **Focus:**",
      "  - Implementing the sliding window pattern to track indices.",
      "- **Goal:**",
      "  - Finish both problems and record the mistakes."
    ].join("\n")
  );

  const focusItems = result.items.filter((item) => item.headline === "Focus");
  assert.deepEqual(focusItems, [
    { headline: "Focus", summary: "Using a Hash Set to track seen elements." },
    {
      headline: "Focus",
      summary: "Implementing the sliding window pattern to track indices."
    }
  ]);
  assert.deepEqual(
    result.items.find((item) => item.headline === "Goal"),
    {
      headline: "Goal",
      summary: "Finish both problems and record the mistakes."
    }
  );
  assert.equal(
    result.items.some(
      (item) => item.headline && item.summary.replace(/[\s*_`#>~:.-]+/g, "") === ""
    ),
    false
  );
});

test("stockSymbols extracts capital tickers and filters system words", () => {
  function stockSymbols(prompt: string): string[] {
    const matches = prompt.match(/\b[A-Z]{2,5}\b/g) ?? [];
    return [...new Set(matches)].filter(
      (symbol) => !["DSA", "JEE", "NEET", "PDF", "API"].includes(symbol)
    );
  }
  const symbols = stockSymbols("Track TCS, RIL, INFY and avoid DSA, API, NEET");
  assert.deepEqual(symbols, ["TCS", "RIL", "INFY"]);
});

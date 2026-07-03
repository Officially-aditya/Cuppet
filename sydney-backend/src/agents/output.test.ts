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

test("stockSymbols extracts capital tickers and maps names correctly", () => {
  const STOCK_MAPPINGS: Record<string, string> = {
    "ril": "Reliance Industries",
    "reliance": "Reliance Industries",
    "tcs": "Tata Consultancy Services",
    "tata consultancy": "Tata Consultancy Services",
    "infy": "Infosys",
    "infosys": "Infosys",
    "tata steel": "Tata Steel",
    "hdfc": "HDFC Bank",
    "icici": "ICICI Bank",
    "sbi": "State Bank of India",
    "sbin": "State Bank of India",
    "state bank": "State Bank of India",
    "wipro": "Wipro",
    "airtel": "Bharti Airtel",
    "bharti airtel": "Bharti Airtel",
    "l&t": "Larsen & Toubro",
    "larsen": "Larsen & Toubro",
    "rvnl": "Rail Vikas Nigam",
    "irfc": "Indian Railway Finance Corporation",
    "lic": "Life Insurance Corporation",
    "hcl": "HCL Technologies"
  };

  const STOP_WORDS = new Set([
    "track", "watch", "stocks", "stock", "portfolio", "market", "close", "and", "the", "avoid", "for", "this",
    "that", "daily", "with", "my", "holdings", "of", "me", "show", "give", "brief", "summary", "digest",
    "movement", "today", "yesterday", "tomorrow", "week", "month", "year", "latest", "current", "update",
    "price", "prices", "info", "information", "details", "report", "status", "rate", "rates",
    "quotes", "quote", "share", "shares"
  ]);

  function stockSymbols(prompt: string): string[] {
    const lower = prompt.toLowerCase();
    const searchQueries: string[] = [];

    for (const [key, value] of Object.entries(STOCK_MAPPINGS)) {
      const regex = new RegExp(`\\b${key}\\b`, "i");
      if (regex.test(lower)) {
        searchQueries.push(value);
      }
    }

    const matches = prompt.match(/\b[A-Z]{2,6}\b/g) ?? [];
    for (const symbol of matches) {
      if (["DSA", "JEE", "NEET", "PDF", "API"].includes(symbol)) {
        continue;
      }
      if (STOCK_MAPPINGS[symbol.toLowerCase()]) {
        continue;
      }
      searchQueries.push(symbol);
    }

    const words = lower.split(/[^a-zA-Z&]+/).map(w => w.trim()).filter(w => w.length >= 2);
    for (const word of words) {
      if (STOP_WORDS.has(word)) continue;
      if (["dsa", "jee", "neet", "pdf", "api"].includes(word)) continue;
      if (STOCK_MAPPINGS[word]) continue;
      const isMatched = searchQueries.some(q => q.toLowerCase().includes(word));
      if (isMatched) continue;

      const titleCaseWord = word.charAt(0).toUpperCase() + word.slice(1);
      searchQueries.push(titleCaseWord);
    }

    return [...new Set(searchQueries)].slice(0, 6);
  }

  const s1 = stockSymbols("Track TCS, Infosys, and RIL");
  assert.deepEqual(s1, ["Reliance Industries", "Tata Consultancy Services", "Infosys"]);

  const s2 = stockSymbols("Track reliance and tata steel");
  assert.deepEqual(s2, ["Reliance Industries", "Tata Steel"]);

  const s3 = stockSymbols("Track MRF and avoid DSA");
  assert.deepEqual(s3, ["MRF"]);

  const s4 = stockSymbols("Track muthoot and mrf");
  assert.deepEqual(s4, ["Muthoot", "Mrf"]);
});

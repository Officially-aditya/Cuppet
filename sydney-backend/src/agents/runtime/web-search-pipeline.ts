import { config } from "../../config.js";
import {
  searchTavily,
  searchFirecrawl,
  type ManualWebSearchEvidence
} from "../manual-web-search.js";

const PRIVATE_CONNECTOR_IDS = new Set([
  "gmail",
  "google_workspace",
  "drive",
  "google_drive",
  "calendar",
  "google_calendar",
  "slack",
  "github",
  "notion"
]);

export function isExplicitWebSearchRequested(
  prompt: string,
  parsedIntent?: Record<string, unknown>
): boolean {
  const combined = [
    prompt,
    String(parsedIntent?.action ?? ""),
    String(parsedIntent?.intent ?? "")
  ]
    .join(" ")
    .toLowerCase();

  return (
    /\b(?:search(?:\s+the)?\s+web|web\s+search|google\s+search|find\s+online|look\s+up\s+online|search\s+online|web\s+updates?|tavily|firecrawl|news\s+search)\b/.test(
      combined
    ) ||
    /\b(?:search|look\s+up)\b.*\b(?:web|online|internet|google)\b/.test(combined)
  );
}

export function hasPrivateConnectors(connectorIds: string[] = []): boolean {
  return connectorIds.some((id) =>
    PRIVATE_CONNECTOR_IDS.has(id.toLowerCase()) || /^mcp\./i.test(id)
  );
}

export function shouldPerformWebSearch(input: {
  prompt: string;
  connectorIds?: string[];
  parsedIntent?: Record<string, unknown>;
}): boolean {
  const connectorIds = input.connectorIds ?? [];
  const containsPrivateConnector = hasPrivateConnectors(connectorIds);

  if (containsPrivateConnector) {
    return isExplicitWebSearchRequested(input.prompt, input.parsedIntent);
  }

  // Stand-alone agents (no private connectors) use web search automatically
  return true;
}

export async function executeWebSearchFallbackChain(input: {
  query: string;
  topic?: "general" | "news" | "finance";
  timeRange?: "day" | "week";
}): Promise<ManualWebSearchEvidence | null> {
  // Provider Preference Chain:
  // 1st: LLM Native search handles directly when tool call is passed.
  // 2nd: Tavily API Search
  if (config.TAVILY_API_KEY) {
    try {
      const tavilyResult = await searchTavily(input.query, {
        topic: input.topic ?? "news",
        timeRange: input.timeRange ?? "day",
        searchDepth: "advanced"
      });
      if (tavilyResult && tavilyResult.results.length > 0) {
        return tavilyResult;
      }
    } catch {
      // Proceed to next fallback provider
    }
  }

  // 3rd: Firecrawl API Search
  if (config.FIRECRAWL_API_KEY) {
    try {
      const firecrawlResult = await searchFirecrawl(input.query, {
        topic: input.topic ?? "news",
        timeRange: input.timeRange ?? "day"
      });
      if (firecrawlResult && firecrawlResult.results.length > 0) {
        return firecrawlResult;
      }
    } catch {
      // Fallback chain completed
    }
  }

  return null;
}

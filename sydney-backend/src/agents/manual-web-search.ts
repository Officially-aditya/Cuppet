import { config } from "../config.js";
import {
  sanitizeUntrustedText,
  untrustedDataBlock
} from "../security/prompt-guard.js";

const tavilySearchUrl = "https://api.tavily.com/search";
const maxSearchResults = 3;

export type ManualWebSearchResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
  publishedDate?: string;
};

export type ManualWebSearchEvidence = {
  provider: "tavily";
  query: string;
  results: ManualWebSearchResult[];
  requestId?: string;
};

type TavilySearchOptions = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function manualWebSearchQuery(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const politePrefix =
    "(?:(?:please|kindly)\\s+)?(?:(?:can|could|would|will)\\s+you\\s+)?";
  const command =
    "(?:search(?:\\s+the\\s+web)?(?:\\s+for)?|web\\s+search(?:\\s+for)?|look\\s+up|look\\s+into|research|google|find\\s+online)";
  const match = normalized.match(
    new RegExp(`^${politePrefix}${command}\\s+(.+)$`, "i")
  );
  if (!match?.[1]) return null;

  const query = match[1]
    .replace(
      /\s+(?:and|then)\s+(?:write|draft|compose|create|summarize|explain|compare|give|tell)\b[\s\S]*$/i,
      ""
    )
    .replace(/[?!.]+$/, "")
    .trim();
  if (!query || hasUnresolvedSearchReferent(query)) return null;
  return query.slice(0, 500);
}

export async function loadManualWebSearchEvidence(
  text: string
): Promise<ManualWebSearchEvidence | null> {
  const query = manualWebSearchQuery(text);
  if (!query || !config.TAVILY_API_KEY) return null;

  try {
    return await searchTavily(query);
  } catch {
    return null;
  }
}

export async function searchTavily(
  query: string,
  options: TavilySearchOptions = {}
): Promise<ManualWebSearchEvidence | null> {
  const apiKey = options.apiKey ?? config.TAVILY_API_KEY;
  if (!apiKey) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(tavilySearchUrl, {
    method: "POST",
    signal: AbortSignal.timeout(options.timeoutMs ?? 6_000),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      query: query.slice(0, 500),
      search_depth: "basic",
      topic: "general",
      max_results: maxSearchResults,
      include_answer: false,
      include_raw_content: false,
      include_images: false
    })
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed (${response.status}).`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const rawResults = Array.isArray(payload.results) ? payload.results : [];
  const results = rawResults
    .map(normalizeTavilyResult)
    .filter((result): result is ManualWebSearchResult => result !== null)
    .slice(0, maxSearchResults);
  if (results.length === 0) return null;

  return {
    provider: "tavily",
    query,
    results,
    ...(typeof payload.request_id === "string"
      ? { requestId: payload.request_id.slice(0, 200) }
      : {})
  };
}

export function manualWebSearchEvidenceBlock(
  evidence: ManualWebSearchEvidence
): string {
  return untrustedDataBlock(
    "tavily_search_results",
    JSON.stringify({
      query: evidence.query,
      results: evidence.results
    }),
    16_000
  );
}

export function appendManualWebSearchSources(
  reply: string,
  evidence: ManualWebSearchEvidence
): string {
  const sources = evidence.results
    .map((result) => {
      const title = result.title
        .replace(/[\r\n\[\]]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return `- [${title || result.url}](${result.url})`;
    })
    .join("\n");
  return sources ? `${reply.trim()}\n\n### Sources\n\n${sources}` : reply.trim();
}

function hasUnresolvedSearchReferent(query: string): boolean {
  return (
    /^(?:more\s+)?(?:on|about)\s+(?:this|that|these|those|it|them|the\s+(?:first|second|third|last|previous|above|story|item|result|topic))\b/i.test(
      query
    ) ||
    /\b(?:mentioned\s+above|from\s+(?:the|your)\s+last|previous\s+(?:story|item|result|message|output))\b/i.test(
      query
    )
  );
}

function normalizeTavilyResult(value: unknown): ManualWebSearchResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  const url = safeWebUrl(result.url);
  if (!url) return null;

  const title = sanitizeUntrustedText(
    typeof result.title === "string" ? result.title : url,
    300
  );
  const content = sanitizeUntrustedText(
    typeof result.content === "string" ? result.content : "",
    2400
  );
  if (!content) return null;

  return {
    title,
    url,
    content,
    ...(typeof result.score === "number" && Number.isFinite(result.score)
      ? { score: result.score }
      : {}),
    ...(typeof result.published_date === "string"
      ? { publishedDate: result.published_date.slice(0, 100) }
      : {})
  };
}

function safeWebUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

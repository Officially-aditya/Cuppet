import {
  anthropicConfigured,
  createAnthropicMessage,
  extractAnthropicText,
  totalAnthropicTokens,
  type AnthropicContentBlock,
  type AnthropicTextMessage
} from "./anthropic.js";
import { renderedNewsBrief, parseNewsBriefText, type RenderedAgentMessage } from "./output.js";

const maxContinuationTurns = 2;

type SourceRef = {
  type: "web_search_citation" | "web_search_result";
  title: string | null;
  url: string;
  cited_text?: string;
  page_age?: string;
};

export async function renderLlmCustomAgent(input: {
  agentName: string;
  prompt: string;
  action: string;
  heading: string;
}): Promise<RenderedAgentMessage | null> {
  if (!anthropicConfigured()) {
    return null;
  }

  try {
    const textToAnalyze = [input.action, input.prompt].join("\n");
    const useWebSearch = shouldUseWebSearch(textToAnalyze);

    const system = [
      "You run a Sydney custom scheduled agent.",
      useWebSearch
        ? "Use the web_search tool to find the required information (such as research papers, articles, latest updates, or web data) requested in the user's prompt. Provide real, accurate information retrieved from the search results."
        : "Use only the user's saved prompt and action. Do not claim to have checked external services, files, email, web, Slack, calendar, or private data.",
      "If external data is required (like email, Slack, private documents) that cannot be retrieved via web search, state which connector is needed instead of inventing results. Never write conversational notes, summaries, or call-to-actions about automating updates or setting up connectors (e.g. do not say 'To automate these updates...').",
      "Return a detailed, structured, and useful message for this run."
    ].join(" ");

    const messages: AnthropicTextMessage[] = [
      {
        role: "user",
        content: [
          `Agent name: ${input.agentName}`,
          `Saved prompt: ${input.prompt}`,
          `Saved action: ${input.action}`,
          `Run heading: ${input.heading}`
        ].join("\n")
      }
    ];

    let response = await createAnthropicMessage({
      maxTokens: 700,
      system,
      messages,
      ...(useWebSearch
        ? {
            tools: [
              {
                type: "web_search_20250305",
                name: "web_search",
                max_uses: 3
              }
            ]
          }
        : {})
    });

    let tokensUsed = totalAnthropicTokens(response);
    const allContent: AnthropicContentBlock[] = [...response.content];

    for (let i = 0; response.stop_reason === "pause_turn"; i += 1) {
      if (i >= maxContinuationTurns) {
        break;
      }
      messages.push({ role: "assistant", content: response.content });
      response = await createAnthropicMessage({
        maxTokens: 700,
        system,
        messages,
        ...(useWebSearch
          ? {
              tools: [
                {
                  type: "web_search_20250305",
                  name: "web_search",
                  max_uses: 3
                }
              ]
            }
          : {})
      });
      tokensUsed += totalAnthropicTokens(response);
      allContent.push(...response.content);
    }

    const body = extractAnthropicText(response.content) || extractAnthropicText(allContent);
    if (!body) return null;

    const parsed = parseNewsBriefText(input.heading, body);
    return renderedNewsBrief(parsed, {
      sourceRefs: extractSourceRefs(allContent),
      tokensUsed
    });
  } catch {
    return null;
  }
}

function shouldUseWebSearch(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(?:latest|current|recent|today|news|headline|update|what happened|pull up|look up|search|web|more|detail|explain|background|why|how|source|sources|link|links|reference|references|citation|citations|article|articles|website|websites|url|urls|research|paper|papers|arxiv)\b/.test(lower) ||
    /\b(?:is|are|was|were)\b.*\b(?:announced|released|launched|confirmed|delayed|cancelled)\b/.test(lower)
  );
}

function extractSourceRefs(content: AnthropicContentBlock[]): SourceRef[] {
  const citationRefs = extractCitationRefs(content);
  if (citationRefs.length > 0) {
    return citationRefs;
  }

  return extractSearchResultRefs(content);
}

function extractCitationRefs(content: AnthropicContentBlock[]): SourceRef[] {
  const byUrl = new Map<string, SourceRef>();

  for (const block of content) {
    if (block.type !== "text") {
      continue;
    }

    for (const citation of block.citations ?? []) {
      if (!citation.url || byUrl.has(citation.url)) continue;
      byUrl.set(citation.url, {
        type: "web_search_citation",
        title: citation.title ?? null,
        url: citation.url,
        cited_text: citation.cited_text
      });
    }
  }

  return [...byUrl.values()];
}

function extractSearchResultRefs(content: AnthropicContentBlock[]): SourceRef[] {
  const byUrl = new Map<string, SourceRef>();

  for (const block of content) {
    if (
      block.type === "web_search_tool_result" &&
      Array.isArray(block.content)
    ) {
      for (const result of block.content) {
        if (!result.url || byUrl.has(result.url)) continue;
        byUrl.set(result.url, {
          type: "web_search_result",
          title: result.title ?? null,
          url: result.url,
          page_age: result.page_age
        });
      }
    }
  }

  return [...byUrl.values()];
}

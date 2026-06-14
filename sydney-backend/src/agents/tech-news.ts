import type { AgentRunTrigger } from "../queue/index.js";
import {
  createAnthropicMessage,
  extractAnthropicText,
  totalAnthropicTokens,
  type AnthropicContentBlock,
  type AnthropicTextMessage,
  type AnthropicTextBlock,
  type AnthropicWebSearchToolResultBlock
} from "./anthropic.js";
import { renderedPlainText, type RenderedAgentMessage } from "./output.js";

type NewsBriefOptions = {
  heading?: string;
};

type SourceRef = {
  type: "web_search_citation" | "web_search_result";
  title: string | null;
  url: string;
  cited_text?: string;
  page_age?: string;
};

type AnthropicWebSearchResult = {
  type: "web_search_result";
  url: string;
  title?: string | null;
  page_age?: string;
};

const maxContinuationTurns = 2;

export async function createTechNewsBrief(
  userPrompt: string,
  trigger: AgentRunTrigger,
  options: NewsBriefOptions = {}
): Promise<RenderedAgentMessage> {
  return createWebNewsBrief({
    options,
    systemPrompt: buildNewsSystemPrompt({
      agentName: "Tech News Agent",
      focus:
        "Prefer AI, developer platforms, consumer tech, security, and policy stories."
    }),
    userMessage: buildTechNewsPrompt(userPrompt, trigger)
  });
}

export async function createGeneralNewsBrief(
  userPrompt: string,
  trigger: AgentRunTrigger,
  options: NewsBriefOptions = {}
): Promise<RenderedAgentMessage> {
  return createWebNewsBrief({
    options,
    systemPrompt: buildNewsSystemPrompt({
      agentName: "News Agent",
      focus:
        "Prefer high-impact world, business, technology, policy, science, and India-relevant stories."
    }),
    userMessage: buildGeneralNewsPrompt(userPrompt, trigger)
  });
}

async function createWebNewsBrief(input: {
  options: NewsBriefOptions;
  systemPrompt: string;
  userMessage: string;
}): Promise<RenderedAgentMessage> {
  const messages: AnthropicTextMessage[] = [
    {
      role: "user" as const,
      content: input.userMessage
    }
  ];

  let response = await createNewsMessage(messages, input.systemPrompt);
  let tokensUsed = totalAnthropicTokens(response);
  const allContent = [...response.content];

  for (let i = 0; response.stop_reason === "pause_turn"; i += 1) {
    if (i >= maxContinuationTurns) {
      throw new Error("Anthropic web search paused too many times.");
    }

    messages.push({
      role: "assistant",
      content: response.content
    });
    response = await createNewsMessage(messages, input.systemPrompt);
    tokensUsed += totalAnthropicTokens(response);
    allContent.push(...response.content);
  }

  const searchErrors = extractSearchErrors(allContent);
  if (searchErrors.length > 0) {
    throw new Error(`Anthropic web search failed: ${searchErrors.join(", ")}`);
  }

  const body = extractFinalText(response.content) || extractFinalText(allContent);
  if (!body) {
    throw new Error("Anthropic returned no Tech News brief text.");
  }

  return renderedPlainText(withHeading(body, input.options.heading), {
    sourceRefs: extractSourceRefs(allContent),
    tokensUsed
  });
}

async function createNewsMessage(
  messages: AnthropicTextMessage[],
  systemPrompt: string
){
  return createAnthropicMessage({
    messages,
    system: systemPrompt,
    maxTokens: 1200,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3
      }
    ]
  });
}

function buildNewsSystemPrompt(input: {
  agentName: string;
  focus: string;
}): string {
  return [
    `You are Sydney's ${input.agentName}.`,
    "Use web search for current information.",
    "Return only the final digest. Do not mention that you searched.",
    "Keep it concise: one short headline sentence, then three numbered items.",
    "Each numbered item should include why it matters in one sentence.",
    input.focus,
    "Avoid rumors, minor product updates, duplicate stories, and market-price-only items.",
    "Do not insert line breaks inside a numbered item."
  ].join(" ");
}

function buildTechNewsPrompt(userPrompt: string, trigger: AgentRunTrigger): string {
  return [
    "Create today's technology news brief.",
    `Original user request: ${userPrompt}`,
    `Run trigger: ${trigger}.`,
    "Search the web for recent, high-signal technology news from reputable sources.",
    "Use this exact output shape:",
    "Tech news brief for today:",
    "1. <headline>: <summary and why it matters>",
    "2. <headline>: <summary and why it matters>",
    "3. <headline>: <summary and why it matters>"
  ].join("\n");
}

function buildGeneralNewsPrompt(userPrompt: string, trigger: AgentRunTrigger): string {
  return [
    "Create today's news brief.",
    `Original user request: ${userPrompt}`,
    `Run trigger: ${trigger}.`,
    "Search the web for recent, high-signal news from reputable sources.",
    "Prioritize stories a busy user should know before starting the day.",
    "Use this exact output shape:",
    "News brief for today:",
    "1. <headline>: <summary and why it matters>",
    "2. <headline>: <summary and why it matters>",
    "3. <headline>: <summary and why it matters>"
  ].join("\n");
}

function withHeading(body: string, heading: string | undefined): string {
  const cleanHeading = heading?.trim();
  if (!cleanHeading) {
    return body;
  }

  return body.startsWith(cleanHeading)
    ? body
    : [cleanHeading, body].join("\n\n");
}

function extractFinalText(content: AnthropicContentBlock[]): string {
  const lastSearchResultIndex = lastWebSearchResultIndex(content);
  const candidateBlocks =
    lastSearchResultIndex === -1
      ? content
      : content.slice(lastSearchResultIndex + 1);

  const text = extractAnthropicText(candidateBlocks);

  if (text) {
    return normalizeDigestText(text);
  }

  const fallbackText = extractAnthropicText(content);

  return normalizeDigestText(fallbackText);
}

function lastWebSearchResultIndex(content: AnthropicContentBlock[]): number {
  for (let i = content.length - 1; i >= 0; i -= 1) {
    if (content[i]?.type === "web_search_tool_result") {
      return i;
    }
  }

  return -1;
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

function normalizeDigestText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n+([,:;])/g, "$1")
    .replace(/([,:;])\n+/g, "$1 ")
    .replace(/\b(\d+)\.\n+/g, "$1. ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractSearchErrors(content: AnthropicContentBlock[]): string[] {
  return content.flatMap((block) => {
    if (
      block.type === "web_search_tool_result" &&
      !Array.isArray(block.content)
    ) {
      return [block.content.error_code];
    }

    return [];
  });
}

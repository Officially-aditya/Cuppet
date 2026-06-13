import { config } from "../config.js";
import type { AgentRunTrigger } from "../queue/index.js";
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

type AnthropicMessageParam = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicServerToolUseBlock
  | AnthropicWebSearchToolResultBlock;

type AnthropicTextBlock = {
  type: "text";
  text: string;
  citations?: AnthropicCitation[];
};

type AnthropicCitation = {
  type: "web_search_result_location";
  url: string;
  title?: string | null;
  cited_text?: string;
  encrypted_index?: string;
};

type AnthropicServerToolUseBlock = {
  type: "server_tool_use";
  id: string;
  name: "web_search" | string;
  input?: {
    query?: string;
  };
};

type AnthropicWebSearchToolResultBlock = {
  type: "web_search_tool_result";
  tool_use_id: string;
  content:
    | AnthropicWebSearchResult[]
    | {
        type: "web_search_tool_result_error";
        error_code: string;
      };
};

type AnthropicWebSearchResult = {
  type: "web_search_result";
  url: string;
  title?: string | null;
  page_age?: string;
};

type AnthropicMessageResponse = {
  id: string;
  role: "assistant";
  content: AnthropicContentBlock[];
  stop_reason: "end_turn" | "max_tokens" | "pause_turn" | "refusal" | string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    server_tool_use?: {
      web_search_requests?: number;
    };
  };
};

type AnthropicErrorResponse = {
  error?: {
    message?: string;
    type?: string;
  };
};

const anthropicMessagesUrl = "https://api.anthropic.com/v1/messages";
const anthropicVersion = "2023-06-01";
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
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required to run web-search news agents."
    );
  }

  const messages: AnthropicMessageParam[] = [
    {
      role: "user",
      content: input.userMessage
    }
  ];

  let response = await createAnthropicMessage(messages, input.systemPrompt);
  let tokensUsed = totalTokens(response);
  const allContent = [...response.content];

  for (let i = 0; response.stop_reason === "pause_turn"; i += 1) {
    if (i >= maxContinuationTurns) {
      throw new Error("Anthropic web search paused too many times.");
    }

    messages.push({
      role: "assistant",
      content: response.content
    });
    response = await createAnthropicMessage(messages, input.systemPrompt);
    tokensUsed += totalTokens(response);
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

async function createAnthropicMessage(
  messages: AnthropicMessageParam[],
  systemPrompt: string
): Promise<AnthropicMessageResponse> {
  const response = await fetch(anthropicMessagesUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.ANTHROPIC_API_KEY!,
      "anthropic-version": anthropicVersion
    },
    body: JSON.stringify({
      model: config.ANTHROPIC_MODEL,
      max_tokens: 1200,
      system: systemPrompt,
      messages,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3
        }
      ]
    })
  });

  const payload = (await response.json()) as
    | AnthropicMessageResponse
    | AnthropicErrorResponse;

  if (!response.ok) {
    throw new Error(
      `Anthropic Messages API failed (${response.status}): ${anthropicErrorMessage(payload)}`
    );
  }

  return payload as AnthropicMessageResponse;
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

  const text = candidateBlocks
    .filter((block): block is AnthropicTextBlock => block.type === "text")
    .map((block) => block.text)
    .filter(Boolean)
    .join("");

  if (text) {
    return normalizeDigestText(text);
  }

  const fallbackText = content
    .filter((block): block is AnthropicTextBlock => block.type === "text")
    .map((block) => block.text)
    .filter(Boolean)
    .join("");

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

function totalTokens(response: AnthropicMessageResponse): number {
  const usage = response.usage;
  if (!usage) return 0;

  let tokens = 0;
  for (const value of [
    usage.input_tokens,
    usage.output_tokens,
    usage.cache_creation_input_tokens,
    usage.cache_read_input_tokens
  ]) {
    tokens += value ?? 0;
  }

  return tokens;
}

function anthropicErrorMessage(
  payload: AnthropicMessageResponse | AnthropicErrorResponse
): string {
  if ("error" in payload) {
    return payload.error?.message ?? payload.error?.type ?? "Unknown error";
  }

  return "Unknown error";
}

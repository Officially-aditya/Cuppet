import type { AgentRunTrigger } from "../queue/index.js";
import {
  createLlmMessage,
  extractLlmText,
  totalLlmTokens,
  type LlmContentBlock,
  type LlmTextMessage,
  type LlmTextBlock,
  type LlmWebSearchToolResultBlock
} from "./llm.js";
import { renderedNewsBrief, parseNewsBriefText, type RenderedAgentMessage } from "./output.js";
import { userInstructionBlock } from "../security/prompt-guard.js";
import { z } from "zod";
import { buildRecipeExecutionPrompt } from "./runtime/execution-prompt.js";
import {
  normalizeNewsBriefJson,
  type NormalizedNewsBriefJson
} from "./runtime/structured-json.js";

type NewsBriefOptions = {
  heading?: string;
  recipeId?: string;
  recipeVersion?: number;
  promptProfileVersion?: number;
  recipeInputs?: Record<string, unknown>;
};

type SourceRef = {
  type: "web_search_citation" | "web_search_result";
  title: string | null;
  url: string;
  cited_text?: string;
  page_age?: string;
};

type LlmWebSearchResult = {
  type: "web_search_result";
  url: string;
  title?: string | null;
  page_age?: string;
};

const maxContinuationTurns = 2;
const newsBriefResponseSchema = z
  .object({
    tldr: z.array(z.string().trim().min(1).max(500)).length(3),
    items: z
      .array(
        z
          .object({
            headline: z.string().trim().min(1).max(300),
            summary: z.string().trim().min(1).max(1800),
            category: z.string().trim().max(120).optional(),
            source: z.string().trim().max(300).optional(),
            url: z.string().url().optional()
          })
          .strict()
      )
      .min(1)
      .max(5),
    perspectives: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(160),
            summary: z.string().trim().min(1).max(1000),
            source: z.string().trim().max(300).optional(),
            url: z.string().url().optional()
          })
          .strict()
      )
      .max(6)
      .optional(),
    why_it_matters: z.string().trim().min(1).max(1800).optional(),
    timeline: z
      .array(
        z
          .object({
            date: z.string().trim().min(1).max(120),
            event: z.string().trim().min(1).max(700)
          })
          .strict()
      )
      .max(5)
      .optional()
  })
  .strict();

export async function createTechNewsBrief(
  userPrompt: string,
  trigger: AgentRunTrigger,
  options: NewsBriefOptions = {}
): Promise<RenderedAgentMessage> {
  const promptLayers = buildNewsSystemPrompt({
    agentName: "Tech News Agent",
    focus:
      "Prefer AI, developer platforms, consumer tech, security, and policy stories.",
    userPrompt,
    options: {
      ...options,
      recipeId: options.recipeId ?? "tech_news_brief"
    }
  });
  return createWebNewsBrief({
    options,
    systemPrompt: promptLayers.system,
    userMessage: [
      promptLayers.user,
      buildTechNewsPrompt(userPrompt, trigger)
    ].join("\n")
  });
}

export async function createGeneralNewsBrief(
  userPrompt: string,
  trigger: AgentRunTrigger,
  options: NewsBriefOptions = {}
): Promise<RenderedAgentMessage> {
  const promptLayers = buildNewsSystemPrompt({
    agentName: "News Agent",
    focus:
      "Prefer high-impact world, business, technology, policy, science, and India-relevant stories.",
    userPrompt,
    options: {
      ...options,
      recipeId: options.recipeId ?? "news_brief"
    }
  });
  return createWebNewsBrief({
    options,
    systemPrompt: promptLayers.system,
    userMessage: [
      promptLayers.user,
      buildGeneralNewsPrompt(userPrompt, trigger)
    ].join("\n")
  });
}

async function createWebNewsBrief(input: {
  options: NewsBriefOptions;
  systemPrompt: string;
  userMessage: string;
}): Promise<RenderedAgentMessage> {
  const messages: LlmTextMessage[] = [
    {
      role: "user" as const,
      content: input.userMessage
    }
  ];

  let response = await createNewsMessage(messages, input.systemPrompt);
  let tokensUsed = totalLlmTokens(response);
  const allContent = [...response.content];

  for (let i = 0; response.stop_reason === "pause_turn"; i += 1) {
    if (i >= maxContinuationTurns) {
      throw new Error("LLM web search paused too many times.");
    }

    messages.push({
      role: "assistant",
      content: response.content
    });
    response = await createNewsMessage(messages, input.systemPrompt);
    tokensUsed += totalLlmTokens(response);
    allContent.push(...response.content);
  }

  const searchErrors = extractSearchErrors(allContent);
  if (searchErrors.length > 0) {
    throw new Error(`LLM web search failed: ${searchErrors.join(", ")}`);
  }

  const body = extractFinalText(response.content) || extractFinalText(allContent);
  if (!body) {
    throw new Error("LLM provider returned no Tech News brief text.");
  }

  const heading = input.options.heading || "News brief";
  const parsed = parseStructuredNewsBrief(body);
  const data = parsed
    ? { title: heading, ...parsed, initialItemCount: 5 }
    : { ...parseNewsBriefText(heading, body), initialItemCount: 5 };
  return renderedNewsBrief(data, {
    sourceRefs: extractSourceRefs(allContent),
    tokensUsed
  });
}

async function createNewsMessage(
  messages: LlmTextMessage[],
  systemPrompt: string
){
  return createLlmMessage({
    messages,
    system: systemPrompt,
    maxTokens: 2400,
    tools: [
      {
        name: "web_search",
        maxUses: 3
      }
    ]
  });
}

function buildNewsSystemPrompt(input: {
  agentName: string;
  focus: string;
  userPrompt: string;
  options: NewsBriefOptions;
}) {
  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return buildRecipeExecutionPrompt({
    recipeId: input.options.recipeId ?? "news_brief",
    recipeVersion: input.options.recipeVersion,
    promptProfileVersion: input.options.promptProfileVersion,
    recipeInputs: input.options.recipeInputs,
    userPrompt: input.userPrompt,
    outputSchema: [
      '{"tldr":["three concise strings"],',
      '"items":[{"headline":"string","summary":"grounded context","category":"string","source":"string","url":"https://..."}]}'
    ].join(""),
    runInstruction: [
      `Today is ${todayStr}. Use bounded native web search for current information.`,
      "Include exactly five ranked, non-duplicate stories when five are supported; return fewer rather than inventing evidence.",
      "The TL;DR must contain exactly three items.",
      "Keep every story summary under 90 words.",
      `Default focus: ${input.focus}`,
      `Agent role: ${input.agentName}.`
    ].join(" ")
  });
}

function buildTechNewsPrompt(userPrompt: string, trigger: AgentRunTrigger): string {
  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return [
    `Create today's technology news brief. Today's date is ${todayStr}.`,
    userInstructionBlock("original_user_request", userPrompt, 4000),
    `Run trigger: ${trigger}.`,
    "Search the web for extremely fresh, recent, high-signal technology news (published within the last 24-48 hours) from reputable sources that are directly relevant to the user's original request. Do not return old search results.",
    "If the request specifies a topic, focus your search and all news brief items exclusively on that topic.",
    "Return the registered JSON output shape described by the system policy."
  ].join("\n");
}

function buildGeneralNewsPrompt(userPrompt: string, trigger: AgentRunTrigger): string {
  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return [
    `Create today's news brief. Today's date is ${todayStr}.`,
    userInstructionBlock("original_user_request", userPrompt, 4000),
    `Run trigger: ${trigger}.`,
    "Search the web for extremely fresh, recent, high-signal news (published within the last 24-48 hours) from reputable sources that are directly relevant to the user's original request. Do not return old search results.",
    "If the request specifies a topic, focus your search and all news brief items exclusively on that topic.",
    "Return the registered JSON output shape described by the system policy."
  ].join("\n");
}

function parseStructuredNewsBrief(
  value: string
): z.infer<typeof newsBriefResponseSchema> | NormalizedNewsBriefJson | null {
  const normalized = normalizeNewsBriefJson(value);
  if (!normalized) return null;
  const strict = newsBriefResponseSchema.safeParse(normalized);
  return strict.success ? strict.data : normalized;
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

function extractFinalText(content: LlmContentBlock[]): string {
  const lastSearchResultIndex = lastWebSearchResultIndex(content);
  const candidateBlocks =
    lastSearchResultIndex === -1
      ? content
      : content.slice(lastSearchResultIndex + 1);

  const text = extractLlmText(candidateBlocks);

  if (text) {
    return normalizeDigestText(text);
  }

  const fallbackText = extractLlmText(content);

  return normalizeDigestText(fallbackText);
}

function lastWebSearchResultIndex(content: LlmContentBlock[]): number {
  for (let i = content.length - 1; i >= 0; i -= 1) {
    if (content[i]?.type === "web_search_tool_result") {
      return i;
    }
  }

  return -1;
}

function extractSourceRefs(content: LlmContentBlock[]): SourceRef[] {
  const citationRefs = extractCitationRefs(content);
  if (citationRefs.length > 0) {
    return citationRefs;
  }

  return extractSearchResultRefs(content);
}

function extractCitationRefs(content: LlmContentBlock[]): SourceRef[] {
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

function extractSearchResultRefs(content: LlmContentBlock[]): SourceRef[] {
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
    .replace(/\n+([,;])/g, "$1")
    .replace(/([,;])\n+/g, "$1 ")
    .replace(/\b(\d+)\.\n+/g, "$1. ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractSearchErrors(content: LlmContentBlock[]): string[] {
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

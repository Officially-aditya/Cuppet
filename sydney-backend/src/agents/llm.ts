import { config } from "../config.js";
import {
  PROMPT_SECURITY_SYSTEM,
  sanitizeModelOutput
} from "../security/prompt-guard.js";
import {
  anthropicConfigured,
  createAnthropicMessage
} from "./anthropic.js";
import { createGeminiMessage, geminiConfigured } from "./gemini.js";
import type {
  LlmContentBlock,
  LlmMessageInput,
  LlmMessageResponse,
  LlmTextBlock
} from "./llm-types.js";

export type LlmProvider = "gemini" | "anthropic";

export function activeLlmProvider(): LlmProvider {
  return config.LLM_PROVIDER;
}

export function llmConfigured(): boolean {
  return activeLlmProvider() === "anthropic"
    ? anthropicConfigured()
    : geminiConfigured();
}

export async function createLlmMessage(
  input: LlmMessageInput
): Promise<LlmMessageResponse> {
  const securedInput = {
    ...input,
    system: [PROMPT_SECURITY_SYSTEM, input.system.slice(0, 20_000)].join("\n\n")
  };
  return activeLlmProvider() === "anthropic"
    ? createAnthropicMessage(securedInput)
    : createGeminiMessage(securedInput);
}

export function cleanModelReasoning(text: string): string {
  if (!text) return "";
  let cleaned = text;
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
  cleaned = cleaned.replace(/<thinking>[\s\S]*/gi, "");
  cleaned = cleaned.replace(/<thought>[\s\S]*/gi, "");
  cleaned = cleaned.replace(/<reasoning>[\s\S]*/gi, "");
  cleaned = cleaned.replace(
    /(?:\*?\*?\bAction Required\b\*?\*?:?|Action Required\*\*)\s*(?:Please\s+)?(?:to\s+)?(?:connect|reconnect|setup|configure|enable|authorization|link|connector)\b[\s\S]*$/gi,
    ""
  );
  cleaned = cleaned.replace(
    /(?:To deliver these updates automatically)[\s\S]*$/gi,
    ""
  );
  return sanitizeModelOutput(cleaned);
}

export function extractLlmText(content: LlmContentBlock[]): string {
  const text = content
    .filter((block): block is LlmTextBlock => block.type === "text")
    .map((block) => block.text)
    .filter(Boolean)
    .join("")
    .trim();
  return cleanModelReasoning(text);
}

export function totalLlmTokens(response: LlmMessageResponse): number {
  const usage = response.usage;
  if (!usage) return 0;
  return [
    usage.input_tokens,
    usage.output_tokens,
    usage.cache_creation_input_tokens,
    usage.cache_read_input_tokens
  ].reduce<number>((total, value) => total + (value ?? 0), 0);
}

export type {
  LlmCitation,
  LlmContentBlock,
  LlmImageBlock,
  LlmMessageInput,
  LlmMessageResponse,
  LlmServerToolUseBlock,
  LlmTextBlock,
  LlmTextMessage,
  LlmTool,
  LlmWebSearchResult,
  LlmWebSearchToolResultBlock
} from "./llm-types.js";

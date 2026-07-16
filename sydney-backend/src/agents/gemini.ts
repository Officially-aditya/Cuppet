import { config } from "../config.js";
import type {
  LlmContentBlock,
  LlmMessageInput,
  LlmMessageResponse,
  LlmTextBlock
} from "./llm-types.js";

interface GeminiResponse {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    content?: { role?: string; parts?: Array<{ text?: string }> };
    finishReason?: string;
    safetyRatings?: Array<{
      category?: string;
      probability?: string;
      blocked?: boolean;
    }>;
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{
        web?: { uri?: string; title?: string };
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

type GeminiInputPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export function geminiConfigured(): boolean {
  return Boolean(config.GEMINI_API_KEY);
}

export async function createGeminiMessage(
  input: LlmMessageInput
): Promise<LlmMessageResponse> {
  if (!config.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;
  const contents = input.messages.slice(-20).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: Array.isArray(message.content)
      ? message.content.flatMap<GeminiInputPart>((block) => {
          if (block.type === "text") {
            return [{ text: (block as LlmTextBlock).text.slice(0, 24_000) }];
          }
          if (block.type === "image") {
            return [{
              inlineData: {
                mimeType: block.source.media_type,
                data: block.source.data
              }
            }];
          }
          return [];
        })
      : [{ text: message.content.slice(0, 24_000) }]
  }));
  const hasWebSearch = input.tools?.some((tool) => tool.name === "web_search");

  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: input.system.slice(0, 20_000) }] },
      generationConfig: { maxOutputTokens: input.maxTokens ?? 800 },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ],
      ...(hasWebSearch ? { tools: [{ googleSearch: {} }] } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API failed (${response.status}).`);
  }

  const payload = (await response.json()) as GeminiResponse;
  if (payload.promptFeedback?.blockReason) {
    throw new Error("Gemini blocked the prompt for safety reasons.");
  }
  const candidate = payload.candidates?.[0];
  if (
    candidate?.finishReason === "SAFETY" ||
    candidate?.safetyRatings?.some((rating) => rating.blocked === true)
  ) {
    throw new Error("Gemini blocked the response for safety reasons.");
  }

  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .slice(0, 50_000);
  const content: LlmContentBlock[] = [{ type: "text", text }];
  const results = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((chunk) =>
      chunk.web?.uri
        ? {
            type: "web_search_result" as const,
            url: chunk.web.uri,
            title: chunk.web.title ?? null,
            page_age: undefined
          }
        : null
    )
    .filter((result): result is NonNullable<typeof result> => result !== null);
  if (results.length > 0) {
    content.push({
      type: "web_search_tool_result",
      tool_use_id: "web_search",
      content: results
    });
  }

  return {
    id: `msg_gemini_${Math.random().toString(36).substring(7)}`,
    role: "assistant",
    content,
    stop_reason:
      candidate?.finishReason === "MAX_TOKENS" ? "max_tokens" : "end_turn",
    usage: {
      input_tokens: payload.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      server_tool_use: hasWebSearch
        ? {
            web_search_requests:
              candidate?.groundingMetadata?.webSearchQueries?.length ?? 0
          }
        : undefined
    }
  };
}

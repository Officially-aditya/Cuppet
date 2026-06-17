import { config } from "../config.js";

export type AnthropicTextMessage = {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
};

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicServerToolUseBlock
  | AnthropicWebSearchToolResultBlock;

export type AnthropicTextBlock = {
  type: "text";
  text: string;
  citations?: AnthropicCitation[];
};

export type AnthropicCitation = {
  type: "web_search_result_location";
  url: string;
  title?: string | null;
  cited_text?: string;
  encrypted_index?: string;
};

export type AnthropicServerToolUseBlock = {
  type: "server_tool_use";
  id: string;
  name: "web_search" | string;
  input?: {
    query?: string;
  };
};

export type AnthropicWebSearchToolResultBlock = {
  type: "web_search_tool_result";
  tool_use_id: string;
  content:
    | AnthropicWebSearchResult[]
    | {
        type: "web_search_tool_result_error";
        error_code: string;
      };
};

export type AnthropicWebSearchResult = {
  type: "web_search_result";
  url: string;
  title?: string | null;
  page_age?: string;
};

export type AnthropicMessageResponse = {
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

type AnthropicTool =
  | {
      type: "web_search_20250305";
      name: "web_search";
      max_uses?: number;
    }
  | Record<string, unknown>;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      role?: string;
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{
        web?: {
          uri?: string;
          title?: string;
        };
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export function anthropicConfigured(): boolean {
  return Boolean(config.GEMINI_API_KEY);
}

export async function createAnthropicMessage(input: {
  messages: AnthropicTextMessage[];
  system: string;
  maxTokens?: number;
  tools?: AnthropicTool[];
}): Promise<AnthropicMessageResponse> {
  if (!config.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.GEMINI_MODEL}:generateContent?key=${config.GEMINI_API_KEY}`;

  const contents = input.messages.map((msg) => {
    const role = msg.role === "assistant" ? "model" : "user";
    const parts = Array.isArray(msg.content)
      ? msg.content
          .filter((block) => block.type === "text")
          .map((block) => ({ text: (block as AnthropicTextBlock).text }))
      : [{ text: msg.content }];
    return { role, parts };
  });

  const hasWebSearch = input.tools?.some((t) => t.name === "web_search");
  const tools = hasWebSearch ? [{ googleSearch: {} }] : undefined;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      contents,
      systemInstruction: {
        parts: [
          {
            text: input.system
          }
        ]
      },
      generationConfig: {
        maxOutputTokens: input.maxTokens ?? 800
      },
      ...(tools ? { tools } : {})
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as GeminiResponse;

  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text ?? "";
  const contentBlocks: AnthropicContentBlock[] = [
    {
      type: "text",
      text: text
    }
  ];

  const chunks = candidate?.groundingMetadata?.groundingChunks;
  if (chunks && chunks.length > 0) {
    const results = chunks
      .map((chunk) => {
        if (chunk.web?.uri) {
          return {
            type: "web_search_result" as const,
            url: chunk.web.uri,
            title: chunk.web.title ?? null,
            page_age: undefined
          };
        }
        return null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (results.length > 0) {
      contentBlocks.push({
        type: "web_search_tool_result",
        tool_use_id: "web_search",
        content: results
      });
    }
  }

  const stopReason = candidate?.finishReason === "MAX_TOKENS" ? "max_tokens" : "end_turn";

  return {
    id: "msg_gemini_" + Math.random().toString(36).substring(7),
    role: "assistant",
    content: contentBlocks,
    stop_reason: stopReason,
    usage: {
      input_tokens: payload.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      server_tool_use: hasWebSearch
        ? {
            web_search_requests: candidate?.groundingMetadata?.webSearchQueries?.length ?? 0
          }
        : undefined
    }
  };
}

export function cleanReasoning(text: string): string {
  if (!text) return "";
  let cleaned = text;
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, "");
  cleaned = cleaned.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
  cleaned = cleaned.replace(/<thinking>[\s\S]*/gi, "");
  cleaned = cleaned.replace(/<thought>[\s\S]*/gi, "");
  cleaned = cleaned.replace(/<reasoning>[\s\S]*/gi, "");
  
  // Clean up LLM connector setup explanations / reasoning blocks
  cleaned = cleaned.replace(/(?:\*?\*?\bAction Required\b\*?\*?:?|Action Required\*\*)[\s\S]*$/gi, "");
  cleaned = cleaned.replace(/(?:To deliver these updates automatically)[\s\S]*$/gi, "");
  
  return cleaned.trim();
}

export function extractAnthropicText(content: AnthropicContentBlock[]): string {
  const text = content
    .filter((block): block is AnthropicTextBlock => block.type === "text")
    .map((block) => block.text)
    .filter(Boolean)
    .join("")
    .trim();
  return cleanReasoning(text);
}

export function totalAnthropicTokens(response: AnthropicMessageResponse): number {
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

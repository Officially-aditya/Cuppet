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

type AnthropicErrorResponse = {
  error?: {
    message?: string;
    type?: string;
  };
};

const anthropicMessagesUrl = "https://api.anthropic.com/v1/messages";
const anthropicVersion = "2023-06-01";

export function anthropicConfigured(): boolean {
  return Boolean(config.ANTHROPIC_API_KEY);
}

export async function createAnthropicMessage(input: {
  messages: AnthropicTextMessage[];
  system: string;
  maxTokens?: number;
  tools?: AnthropicTool[];
}): Promise<AnthropicMessageResponse> {
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required.");
  }

  const response = await fetch(anthropicMessagesUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.ANTHROPIC_API_KEY,
      "anthropic-version": anthropicVersion
    },
    body: JSON.stringify({
      model: config.ANTHROPIC_MODEL,
      max_tokens: input.maxTokens ?? 800,
      system: input.system,
      messages: input.messages,
      ...(input.tools ? { tools: input.tools } : {})
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

export function extractAnthropicText(content: AnthropicContentBlock[]): string {
  return content
    .filter((block): block is AnthropicTextBlock => block.type === "text")
    .map((block) => block.text)
    .filter(Boolean)
    .join("")
    .trim();
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

function anthropicErrorMessage(
  payload: AnthropicMessageResponse | AnthropicErrorResponse
): string {
  if ("error" in payload) {
    return payload.error?.message ?? payload.error?.type ?? "Unknown error";
  }

  return "Unknown error";
}

import { config } from "../config.js";
import type {
  LlmMessageInput,
  LlmMessageResponse
} from "./llm-types.js";

type AnthropicErrorResponse = {
  error?: { message?: string; type?: string };
};

const messagesUrl = "https://api.anthropic.com/v1/messages";
const apiVersion = "2023-06-01";

export function anthropicConfigured(): boolean {
  return Boolean(config.ANTHROPIC_API_KEY);
}

export async function createAnthropicMessage(
  input: LlmMessageInput
): Promise<LlmMessageResponse> {
  if (!config.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic."
    );
  }

  const response = await fetch(messagesUrl, {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "content-type": "application/json",
      "x-api-key": config.ANTHROPIC_API_KEY,
      "anthropic-version": apiVersion
    },
    body: JSON.stringify({
      model: config.ANTHROPIC_MODEL,
      max_tokens: input.maxTokens ?? 800,
      system: input.system,
      messages: input.messages,
      ...(input.tools
        ? {
            tools: input.tools.map((tool) => ({
              type: "web_search_20250305",
              name: tool.name,
              ...(tool.maxUses === undefined
                ? {}
                : { max_uses: tool.maxUses })
            }))
          }
        : {})
    })
  });
  const payload = (await response.json()) as
    | LlmMessageResponse
    | AnthropicErrorResponse;

  if (!response.ok) {
    const message =
      "error" in payload
        ? payload.error?.message ?? payload.error?.type ?? "Unknown error"
        : "Unknown error";
    throw new Error(
      `Anthropic Messages API failed (${response.status}): ${message}`
    );
  }

  return payload as LlmMessageResponse;
}

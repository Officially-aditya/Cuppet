import {
  anthropicConfigured,
  createAnthropicMessage,
  extractAnthropicText,
  type AnthropicContentBlock,
  type AnthropicTextMessage
} from "./anthropic.js";

const maxContinuationTurns = 2;

export async function createAssistantChatReply(text: string): Promise<string> {
  if (!anthropicConfigured()) {
    return fallbackAssistantReply(text);
  }

  try {
    const messages: AnthropicTextMessage[] = [{ role: "user", content: text }];
    const system = assistantSystemPrompt(shouldUseWebSearch(text));
    let response = await createAssistantMessage(messages, system, text);
    const allContent: AnthropicContentBlock[] = [...response.content];

    for (let i = 0; response.stop_reason === "pause_turn"; i += 1) {
      if (i >= maxContinuationTurns) {
        throw new Error("Anthropic assistant chat paused too many times.");
      }

      messages.push({ role: "assistant", content: response.content });
      response = await createAssistantMessage(messages, system, text);
      allContent.push(...response.content);
    }

    const reply = extractFinalText(response.content) || extractFinalText(allContent);
    return reply || fallbackAssistantReply(text);
  } catch {
    return fallbackAssistantReply(text);
  }
}

function createAssistantMessage(
  messages: AnthropicTextMessage[],
  system: string,
  text: string
) {
  const useWebSearch = shouldUseWebSearch(text);
  return createAnthropicMessage({
    maxTokens: useWebSearch ? 1100 : 700,
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
}

function assistantSystemPrompt(useWebSearch: boolean): string {
  return [
    "You are Sydney, a helpful AI assistant inside a mobile delegation app.",
    "You can answer normal chat questions directly.",
    "You can explain Sydney: users can create dedicated agent contacts that run on schedules or on demand.",
    "Never create, modify, or claim to create agents from this chat response.",
    "If the user wants an agent, tell them to use New or say an explicit phrase like 'create an agent that ...'.",
    useWebSearch
      ? "For latest, current, recent, or news questions, use web search before answering. Include source names and links when useful."
      : "If current/private data is required and no data is provided, say what connector or context is needed.",
    "Keep replies concise, practical, and conversational.",
    "Prefer short headings and bullets for scanability."
  ].join(" ");
}

function shouldUseWebSearch(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(?:latest|current|recent|today|news|headline|update|what happened|pull up|look up|search|web)\b/.test(lower) ||
    /\b(?:is|are|was|were)\b.*\b(?:announced|released|launched|confirmed|delayed|cancelled)\b/.test(lower)
  );
}

function extractFinalText(content: AnthropicContentBlock[]): string {
  const lastSearchResultIndex = lastWebSearchResultIndex(content);
  const candidateBlocks =
    lastSearchResultIndex === -1
      ? content
      : content.slice(lastSearchResultIndex + 1);
  return extractAnthropicText(candidateBlocks) || extractAnthropicText(content);
}

function lastWebSearchResultIndex(content: AnthropicContentBlock[]): number {
  for (let i = content.length - 1; i >= 0; i -= 1) {
    if (content[i]?.type === "web_search_tool_result") {
      return i;
    }
  }

  return -1;
}

function fallbackAssistantReply(text: string): string {
  const lower = text.trim().toLowerCase();
  if (/\b(?:what can you do|what do you do|who are you)\b/.test(lower)) {
    return "I can chat, answer questions, explain Sydney, and help you think through tasks. Use New or say \"create an agent that...\" when you want a scheduled agent contact.";
  }

  return "I can help with that. Ask me directly, or use New when you want to create a scheduled agent.";
}

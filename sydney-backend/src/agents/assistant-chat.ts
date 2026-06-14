import {
  anthropicConfigured,
  createAnthropicMessage,
  extractAnthropicText
} from "./anthropic.js";

export async function createAssistantChatReply(text: string): Promise<string> {
  if (!anthropicConfigured()) {
    return fallbackAssistantReply(text);
  }

  try {
    const response = await createAnthropicMessage({
      maxTokens: 700,
      system: [
        "You are Sydney, a helpful AI assistant inside a mobile delegation app.",
        "You can answer normal chat questions directly.",
        "You can explain Sydney: users can create dedicated agent contacts that run on schedules or on demand.",
        "Never create, modify, or claim to create agents from this chat response.",
        "If the user wants an agent, tell them to use New or say an explicit phrase like 'create an agent that ...'.",
        "If current/private data is required and no data is provided, say what connector or context is needed.",
        "Keep replies concise, practical, and conversational."
      ].join(" "),
      messages: [{ role: "user", content: text }]
    });

    const reply = extractAnthropicText(response.content);
    return reply || fallbackAssistantReply(text);
  } catch {
    return fallbackAssistantReply(text);
  }
}

function fallbackAssistantReply(text: string): string {
  const lower = text.trim().toLowerCase();
  if (/\b(?:what can you do|what do you do|who are you)\b/.test(lower)) {
    return "I can chat, answer questions, explain Sydney, and help you think through tasks. Use New or say \"create an agent that...\" when you want a scheduled agent contact.";
  }

  return "I can help with that. Ask me directly, or use New when you want to create a scheduled agent.";
}

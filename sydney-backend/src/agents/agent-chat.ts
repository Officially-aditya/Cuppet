import {
  anthropicConfigured,
  createAnthropicMessage,
  extractAnthropicText,
  type AnthropicContentBlock,
  type AnthropicTextMessage
} from "./anthropic.js";
import type { ParsedIntent } from "./parser.js";

const maxContinuationTurns = 2;

export type AgentChatContext = {
  agent: { name: string; prompt: string; parsed_intent: ParsedIntent };
  latestAgentOutput: string;
  sourceRefs: unknown[];
  recentUserMessages: string[];
  userText: string;
};

export async function createAgentChatReply(
  context: AgentChatContext
): Promise<string> {
  if (!anthropicConfigured()) {
    return fallbackAgentReply(context);
  }

  try {
    const messages = buildMessages(context);
    const system = agentChatSystemPrompt(context);
    let response = await createAnthropicMessage({
      maxTokens: 700,
      system,
      messages
    });
    const allContent: AnthropicContentBlock[] = [...response.content];

    for (let i = 0; response.stop_reason === "pause_turn"; i += 1) {
      if (i >= maxContinuationTurns) {
        break;
      }
      messages.push({ role: "assistant", content: response.content });
      response = await createAnthropicMessage({
        maxTokens: 700,
        system,
        messages
      });
      allContent.push(...response.content);
    }

    const reply =
      extractAnthropicText(response.content) ||
      extractAnthropicText(allContent);
    return reply || fallbackAgentReply(context);
  } catch {
    return fallbackAgentReply(context);
  }
}

function buildMessages(context: AgentChatContext): AnthropicTextMessage[] {
  const messages: AnthropicTextMessage[] = [];

  // Inject the latest agent output as the first assistant turn
  // so the LLM knows what data the user is referring to.
  if (context.latestAgentOutput) {
    messages.push({
      role: "assistant",
      content: context.latestAgentOutput
    });
  }

  // Add last 2 user messages as prior turns for continuity.
  for (const prior of context.recentUserMessages) {
    messages.push({ role: "user", content: prior });
    // Minimal ack so message alternation is maintained.
    messages.push({
      role: "assistant",
      content: "Understood."
    });
  }

  // Current user follow-up question.
  messages.push({ role: "user", content: context.userText });

  return messages;
}

function agentChatSystemPrompt(context: AgentChatContext): string {
  const { agent, sourceRefs } = context;
  const parts = [
    `You are ${agent.name}, a specialized agent inside the Sydney app.`,
    `Your role: ${agent.parsed_intent.action}`,
    "",
    "The user is asking a follow-up question about your most recent output. Your job:",
    "1. Answer questions about the data you delivered.",
    "2. Filter/skim — extract specific items the user asks for (e.g. \"show only urgent ones\").",
    "3. Find/open — when the user says \"open\", \"find\", or \"give me the link\", return the relevant URL or reference from the source references below.",
    "4. Summarize subsets — condense parts of the output on request.",
    "5. Stay grounded — ONLY reference data that actually appears in your output. If the user asks about something not in the output, say you don't have that information and suggest running the agent again.",
    "",
    "Keep replies concise, practical, and scannable. Use short bullets when listing items."
  ];

  if (sourceRefs.length > 0) {
    parts.push(
      "",
      "Source references (URLs, email IDs, links from your output):",
      JSON.stringify(sourceRefs, null, 2)
    );
  }

  return parts.join("\n");
}

function fallbackAgentReply(context: AgentChatContext): string {
  if (!context.latestAgentOutput) {
    return "I don't have any recent output to discuss. Try running me first, and then ask your follow-up.";
  }

  return "I can see the data but I'm unable to process follow-up questions right now. Try running me again for a fresh result.";
}

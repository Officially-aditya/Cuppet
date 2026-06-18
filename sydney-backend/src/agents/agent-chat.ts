import {
  anthropicConfigured,
  createAnthropicMessage,
  extractAnthropicText,
  type AnthropicContentBlock,
  type AnthropicTextMessage
} from "./anthropic.js";
import type { ParsedIntent } from "./parser.js";
import { fetchSourceReferenceDetail } from "../connectors/google-workspace.js";

const maxContinuationTurns = 2;

export type AgentChatContext = {
  userId?: string;
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
    const useWebSearch = shouldUseWebSearch(context.userText);
    
    // Proactively fetch full body/details of referenced documents/emails
    let fetchedReferencesText = "";
    if (context.userId && Array.isArray(context.sourceRefs) && context.sourceRefs.length > 0) {
      const fetchPromises = context.sourceRefs.slice(0, 3).map(async (ref: any) => {
        try {
          const detailText = await fetchSourceReferenceDetail(context.userId!, ref);
          if (detailText) {
            const label = ref.label || ref.name || ref.subject || ref.id || "Reference";
            return `Reference [${label}]:\n${detailText.slice(0, 2000)}`;
          }
        } catch {
          // Ignore and continue without detail
        }
        return null;
      });

      const results = await Promise.all(fetchPromises);
      fetchedReferencesText = results.filter(Boolean).join("\n\n---\n\n");
    }

    const messages = buildMessages(context);
    const system = agentChatSystemPrompt(context, useWebSearch, fetchedReferencesText);
    let response = await createAnthropicMessage({
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
    const allContent: AnthropicContentBlock[] = [...response.content];

    for (let i = 0; response.stop_reason === "pause_turn"; i += 1) {
      if (i >= maxContinuationTurns) {
        break;
      }
      messages.push({ role: "assistant", content: response.content });
      response = await createAnthropicMessage({
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

function agentChatSystemPrompt(
  context: AgentChatContext,
  useWebSearch: boolean,
  fetchedReferencesText?: string
): string {
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
    useWebSearch
      ? "5. Use the web_search tool to find more details, background, or latest updates regarding topics mentioned in the output when the user asks for more information."
      : "5. Stay grounded — ONLY reference data that actually appears in your output or the fetched reference contents below. If the user asks for sources, links, or new information not present in the output or fetched references, politely explain that you cannot browse the web or provide new sources in this mode, rather than fabricating or defaulting to unrelated news topics.",
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

  if (fetchedReferencesText) {
    parts.push(
      "",
      "Fetched full contents of referenced documents/emails:",
      fetchedReferencesText
    );
  }

  return parts.join("\n");
}

function shouldUseWebSearch(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(?:latest|current|recent|today|news|headline|update|what happened|pull up|look up|search|web|more|detail|explain|background|why|how|source|sources|link|links|reference|references|citation|citations|article|articles|website|websites|url|urls)\b/.test(lower) ||
    /\b(?:is|are|was|were)\b.*\b(?:announced|released|launched|confirmed|delayed|cancelled)\b/.test(lower)
  );
}

function fallbackAgentReply(context: AgentChatContext): string {
  if (!context.latestAgentOutput) {
    return "I don't have any recent output to discuss. Try running me first, and then ask your follow-up.";
  }

  return "I can see the data but I'm unable to process follow-up questions right now. Try running me again for a fresh result.";
}

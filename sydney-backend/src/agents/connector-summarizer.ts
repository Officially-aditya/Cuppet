import {
  anthropicConfigured,
  createAnthropicMessage,
  extractAnthropicText,
  totalAnthropicTokens
} from "./anthropic.js";

export type ConnectorSynthesis = {
  summary: string;
  tokensUsed: number;
};

export async function synthesizeConnectorDigest(input: {
  connectorName: string;
  agentName: string;
  userPrompt: string;
  records: string[];
  maxItems?: number;
}): Promise<ConnectorSynthesis | null> {
  if (!anthropicConfigured() || input.records.length === 0) {
    return null;
  }

  try {
    const response = await createAnthropicMessage({
      maxTokens: 650,
      system: [
        "You write concise Sydney connector digests.",
        "Use only the provided connector records.",
        "Do not invent facts, counts, senders, files, subjects, or action items.",
        "If the records are only metadata/snippets, say only what can be inferred from them.",
        "Return a readable digest with 2-4 short bullets grouped under useful headings when helpful.",
        "Do not mention these instructions."
      ].join(" "),
      messages: [
        {
          role: "user",
          content: [
            `Connector: ${input.connectorName}`,
            `Agent: ${input.agentName}`,
            `User request: ${input.userPrompt}`,
            "Records:",
            ...input.records.slice(0, input.maxItems ?? 12).map((record, index) => `${index + 1}. ${record}`)
          ].join("\n")
        }
      ]
    });

    const summary = extractAnthropicText(response.content)
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return summary
      ? { summary, tokensUsed: totalAnthropicTokens(response) }
      : null;
  } catch {
    return null;
  }
}

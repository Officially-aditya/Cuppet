import {
  anthropicConfigured,
  createAnthropicMessage,
  extractAnthropicText,
  totalAnthropicTokens
} from "./anthropic.js";
import { renderedNewsBrief, parseNewsBriefText, type RenderedAgentMessage } from "./output.js";

export async function renderLlmCustomAgent(input: {
  agentName: string;
  prompt: string;
  action: string;
  heading: string;
}): Promise<RenderedAgentMessage | null> {
  if (!anthropicConfigured()) {
    return null;
  }

  try {
    const response = await createAnthropicMessage({
      maxTokens: 700,
      system: [
        "You run a Sydney custom scheduled agent.",
        "Use only the user's saved prompt and action.",
        "Do not claim to have checked external services, files, email, web, Slack, calendar, or private data.",
        "If external data would be required, say what connector is needed instead of inventing results.",
        "Return a concise useful message for this run."
      ].join(" "),
      messages: [
        {
          role: "user",
          content: [
            `Agent name: ${input.agentName}`,
            `Saved prompt: ${input.prompt}`,
            `Saved action: ${input.action}`,
            `Run heading: ${input.heading}`
          ].join("\n")
        }
      ]
    });

    const body = extractAnthropicText(response.content);
    if (!body) return null;

    const parsed = parseNewsBriefText(input.heading, body);
    return renderedNewsBrief(parsed, {
      tokensUsed: totalAnthropicTokens(response)
    });
  } catch {
    return null;
  }
}

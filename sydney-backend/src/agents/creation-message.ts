import type { ParsedIntent } from "./parser.js";

type AgentCreationThreadMessage = {
  role: "agent";
  content: {
    template: "daily_task" | "data_summary";
    version: "1.0";
    data: Record<string, unknown>;
  };
};

export function agentCreationThreadMessage(input: {
  parsedIntent: ParsedIntent;
  githubConnected: boolean;
  readyDetail: string;
}): AgentCreationThreadMessage {
  const needsGitHub = input.parsedIntent.connector_ids.includes("github");
  if (needsGitHub && !input.githubConnected) {
    return {
      role: "agent",
      content: {
        template: "daily_task",
        version: "1.0",
        data: {
          title: `Finish setting up ${input.parsedIntent.name}`,
          task: [
            input.parsedIntent.action,
            agentVoiceReadyDetail(input.readyDetail)
          ].join("\n\n"),
          context:
            "I’ve been created, but I can’t read repository activity until you authorize GitHub.",
          estimated_minutes: 1,
          actions: [
            {
              id: "connect_github",
              type: "connector_connect",
              connector_id: "github",
              connector_name: "GitHub",
              run_after_connect: true,
              label: "Connect GitHub",
              style: "primary"
            }
          ]
        }
      }
    };
  }

  return {
    role: "agent",
    content: {
      template: "data_summary",
      version: "1.0",
      data: {
        kind: "agent_introduction",
        title: input.parsedIntent.name,
        text: `Hi, I’m ${input.parsedIntent.name}. I’m set up and ready to help.`,
        summary: agentIntroductionSummary(
          input.parsedIntent,
          input.readyDetail
        )
      }
    }
  };
}

function agentIntroductionSummary(
  parsedIntent: ParsedIntent,
  readyDetail: string
): string {
  const permissions = [...new Set(parsedIntent.permissions_needed)]
    .map((permission) => `- ${permission}`)
    .join("\n");
  return [
    "What I do:",
    parsedIntent.action,
    "",
    "When I run:",
    agentVoiceReadyDetail(readyDetail),
    "",
    "Access and safety:",
    permissions || "- No connected-account access is required.",
    `- ${safetyDescription(parsedIntent.safety_level)}`,
    "",
    "Controls:",
    "You can ask me to run now, or ask the Assistant to pause, update, rename, or delete me."
  ].join("\n");
}

function agentVoiceReadyDetail(detail: string): string {
  return detail
    .replace(/^It will react\b/, "I’ll react")
    .replace(/^It will run\b/, "I’ll run")
    .replace(/^It is ready\b/, "I’m ready");
}

function safetyDescription(level: ParsedIntent["safety_level"]): string {
  switch (level) {
    case "read":
      return "I only read data and prepare updates.";
    case "suggest":
      return "I can prepare suggestions, but I won’t apply changes automatically.";
    case "act":
      return "I can take approved actions within the permissions you grant.";
  }
}

export function agentCreationReadyDetail(
  parsedIntent: ParsedIntent,
  describeSchedule: (cron: string) => string = (cron) => `on schedule ${cron}`
): string {
  if (parsedIntent.realtime_enabled) {
    return "It will react to matching activity and notify you immediately.";
  }
  if (parsedIntent.schedule_cron) {
    return `It will run ${describeSchedule(parsedIntent.schedule_cron)}.`;
  }
  return "It is ready for manual runs.";
}

import type { ParsedIntent } from "./parser.js";

type AgentCreationThreadMessage = {
  role: "agent" | "system";
  content: {
    template: "daily_task" | "system";
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
          title: "Connect GitHub to run this agent",
          task: "To run this agent, you need to connect GitHub.",
          context:
            `${input.parsedIntent.name} was created, but it cannot read repository activity until you authorize GitHub.`,
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
    role: "system",
    content: {
      template: "system",
      version: "1.0",
      data: {
        type: "agent_created",
        icon: "check",
        message: `${input.parsedIntent.name} is ready.`,
        detail: input.readyDetail,
        action: null
      }
    }
  };
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

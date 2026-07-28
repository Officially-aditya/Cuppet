import type { ParsedIntent } from "./parser.js";
import { describeSchedule } from "./schedule-description.js";
import { resolveAccess } from "../access/resolver.js";
import { accessRequirementsForConnectorIds } from "../access/requirements.js";

export type MissingCreationAccess = {
  connectorId: string;
  connectorName: string;
};

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
  missingAccess?: readonly MissingCreationAccess[] | null;
  readyDetail: string;
}): AgentCreationThreadMessage {
  const needsGitHub = input.parsedIntent.connector_ids.includes("github");
  const missingAccess = [...(input.missingAccess ?? [])];
  if (
    needsGitHub &&
    !input.githubConnected &&
    !missingAccess.some((access) => access.connectorId === "github")
  ) {
    missingAccess.unshift({ connectorId: "github", connectorName: "GitHub" });
  }

  if (
    needsGitHub &&
    !input.githubConnected &&
    missingAccess.length === 1 &&
    missingAccess[0]?.connectorId === "github"
  ) {
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

  if (missingAccess.length > 0) {
    const accessNames = missingAccess
      .map((access) => access.connectorName)
      .join(" and ");
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
            missingAccess.length === 1
              ? `I’ve been created, but I can’t read ${accessNames} context until you authorize ${accessNames}.`
              : `I’ve been created, but I need access to ${accessNames} before I can run.`,
          estimated_minutes: 1,
          actions: missingAccess.map((access) => ({
            id: `connect_${access.connectorId.replace(/[^a-z0-9]+/gi, "_")}`,
            type: "connector_connect",
            connector_id: access.connectorId,
            connector_name: access.connectorName,
            run_after_connect: missingAccess.length === 1,
            label: `Connect ${access.connectorName}`,
            style: "primary"
          }))
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

export async function missingAccessForCreation(
  userId: string,
  parsedIntent: ParsedIntent
): Promise<MissingCreationAccess[]> {
  const explicitRequirements = parsedIntent.required_access ?? [];
  const requirements = (explicitRequirements.length > 0
    ? explicitRequirements
    : accessRequirementsForConnectorIds(parsedIntent.connector_ids)
  ).filter(
    (requirement) => requirement.required
  );
  if (requirements.length === 0) return [];

  try {
    const resolution = await resolveAccess(userId, requirements);
    const seen = new Set<string>();
    return resolution.items.flatMap((item) => {
      if (item.status !== "needs_connection" || !item.provider) return [];
      const connectorId = item.provider.connectorId ?? item.provider.providerId;
      if (seen.has(connectorId)) return [];
      seen.add(connectorId);
      return [{
        connectorId,
        connectorName: item.provider.displayName
      }];
    });
  } catch {
    // Agent creation should not fail if access status cannot be checked.
    return [];
  }
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
  scheduleDescription: (cron: string) => string = describeSchedule
): string {
  if (parsedIntent.realtime_enabled) {
    return "It will react to matching activity and notify you immediately.";
  }
  if (parsedIntent.schedule_cron) {
    return `It will run ${scheduleDescription(parsedIntent.schedule_cron)}.`;
  }
  return "It is ready for manual runs.";
}

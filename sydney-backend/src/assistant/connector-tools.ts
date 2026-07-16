import { readGitHubForAssistant } from "../connectors/github.js";
import {
  readCalendarForAssistant,
  readDriveForAssistant,
  readGmailForAssistant
} from "../connectors/google-workspace.js";
import { readNotionForAssistant } from "../connectors/notion.js";
import { readSlackForAssistant } from "../connectors/slack.js";
import {
  isConnectorAuthRequiredError,
  type ConnectorAuthRequiredError
} from "../connectors/errors.js";

export type AssistantConnectorId =
  | "gmail"
  | "calendar"
  | "drive"
  | "github"
  | "slack"
  | "notion";

export type AssistantConnectorEvidence = {
  connector: AssistantConnectorId;
  summary: string;
  sourceRefs: unknown[];
};

export type AssistantConnectorReadResult = {
  evidence: AssistantConnectorEvidence[];
  failures: Array<{
    connector: AssistantConnectorId;
    authRequired: boolean;
    connectorName: string;
    reason: string;
  }>;
  sourceRefs: unknown[];
};

export async function executeAssistantConnectorReads(
  userId: string,
  text: string,
  connectors: AssistantConnectorId[]
): Promise<AssistantConnectorReadResult> {
  const selected = [...new Set(connectors)].slice(0, 3);
  const results = await Promise.allSettled(
    selected.map(async (connector): Promise<AssistantConnectorEvidence> => {
      const value = await executeOne(userId, text, connector);
      return { connector, ...value };
    })
  );
  const evidence: AssistantConnectorEvidence[] = [];
  const failures: AssistantConnectorReadResult["failures"] = [];
  results.forEach((result, index) => {
    const connector = selected[index]!;
    if (result.status === "fulfilled") {
      evidence.push(result.value);
      return;
    }
    const error = result.reason;
    failures.push({
      connector,
      authRequired: isConnectorAuthRequiredError(error),
      connectorName: isConnectorAuthRequiredError(error)
        ? error.connectorName
        : connectorName(connector),
      reason: error instanceof Error ? error.message : "connector_read_failed"
    });
  });
  return {
    evidence,
    failures,
    sourceRefs: evidence.flatMap((item) => item.sourceRefs).slice(0, 30)
  };
}

async function executeOne(
  userId: string,
  text: string,
  connector: AssistantConnectorId
): Promise<{ summary: string; sourceRefs: unknown[] }> {
  switch (connector) {
    case "gmail":
      return readGmailForAssistant(userId, {
        query: gmailQuery(text),
        limit: 8
      });
    case "calendar": {
      const range = calendarRange(text);
      return readCalendarForAssistant(userId, { ...range, limit: 16 });
    }
    case "drive":
      return readDriveForAssistant(userId, {
        query: searchSubject(text, ["drive", "file", "files", "document", "documents"]),
        limit: 8
      });
    case "github":
      return readGitHubForAssistant(userId, {
        query: searchSubject(text, ["github", "repo", "repository", "activity", "recent"]),
        limit: 8
      });
    case "slack":
      return readSlackForAssistant(userId, {
        channel: text.match(/#([a-z0-9_-]+)/i)?.[1],
        oldest: Math.floor((Date.now() - lookbackDays(text) * 86400_000) / 1000),
        limit: 15
      });
    case "notion":
      return readNotionForAssistant(userId, {
        query: searchSubject(text, ["notion", "page", "pages", "find", "search", "shared"]),
        limit: 8
      });
  }
}

function gmailQuery(text: string): string {
  const quoted = text.match(/["“](.+?)["”]/)?.[1]?.trim();
  if (quoted) return `${quoted} newer_than:${lookbackDays(text)}d`;
  const subject = searchSubject(text, [
    "gmail", "email", "emails", "inbox", "mail", "show", "find", "search",
    "recent", "latest", "summarize", "summarise", "my", "me", "what", "which"
  ]);
  return `${subject ? `${subject} ` : ""}newer_than:${lookbackDays(text)}d`.trim();
}

function lookbackDays(text: string): number {
  const lower = text.toLowerCase();
  if (/\btoday\b/.test(lower)) return 1;
  if (/\bthis week|past week|last week\b/.test(lower)) return 7;
  const match = lower.match(/\b(?:last|past)\s+(\d{1,2})\s+days?\b/);
  return match ? Math.min(Math.max(Number(match[1]), 1), 30) : 7;
}

function calendarRange(text: string): { timeMin: Date; timeMax: Date } {
  const lower = text.toLowerCase();
  const explicitDates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  if (explicitDates[0]) {
    const timeMin = new Date(`${explicitDates[0]}T00:00:00.000Z`);
    const timeMax = explicitDates[1]
      ? new Date(`${explicitDates[1]}T23:59:59.999Z`)
      : new Date(timeMin.getTime() + 86400_000);
    if (!Number.isNaN(timeMin.getTime()) && !Number.isNaN(timeMax.getTime())) {
      return { timeMin, timeMax };
    }
  }
  const start = new Date();
  let end: Date;
  if (/\btomorrow\b/.test(lower)) {
    start.setUTCDate(start.getUTCDate() + 1);
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
  } else if (/\btoday\b/.test(lower)) {
    start.setUTCHours(0, 0, 0, 0);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
  } else {
    const nextDays = lower.match(/\bnext\s+(\d{1,2})\s+days?\b/);
    const days = nextDays
      ? Math.min(Math.max(Number(nextDays[1]), 1), 30)
      : /\bthis week\b/.test(lower)
        ? 7
        : 7;
    end = new Date(start.getTime() + days * 86400_000);
  }
  return { timeMin: start, timeMax: end };
}

function searchSubject(text: string, stopWords: string[]): string | undefined {
  const quoted = text.match(/["“](.+?)["”]/)?.[1]?.trim();
  if (quoted) return quoted.slice(0, 120);
  const stops = new Set([
    ...stopWords,
    "a", "an", "the", "in", "on", "from", "for", "to", "do", "i", "have",
    "please", "could", "you", "about", "latest", "recent", "activity", "my"
  ]);
  const tokens = text.toLowerCase().match(/[a-z0-9_-]+/g) ?? [];
  const subject = tokens.filter((token) => !stops.has(token)).slice(0, 8).join(" ");
  return subject || undefined;
}

export function connectorActionContent(
  failures: AssistantConnectorReadResult["failures"]
) {
  const first = failures[0]!;
  const connector = first.connector;
  const name = first.connectorName || connectorName(connector);
  return {
    template: "daily_task",
    version: "1.0",
    data: {
      title: `${name} access needed`,
      task: `Connect or reconnect ${name} so Cuppet can answer this question.`,
      context:
        "Cuppet did not substitute public web results for your private data.",
      actions: [{
        id: `connect_${connector}`,
        type: "connector_connect",
        connector_id: connector,
        connector_name: name,
        run_after_connect: false,
        label: `Connect ${name}`,
        style: "primary"
      }]
    }
  };
}

function connectorName(connector: AssistantConnectorId): string {
  return ({
    gmail: "Gmail",
    calendar: "Google Calendar",
    drive: "Google Drive",
    github: "GitHub",
    slack: "Slack",
    notion: "Notion"
  })[connector];
}

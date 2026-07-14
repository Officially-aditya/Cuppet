import { renderGoogleWorkspaceAgent } from "../connectors/google-workspace.js";
import { renderGitHubAgent } from "../connectors/github.js";
import { renderNotionAgent } from "../connectors/notion.js";
import { renderSlackAgent } from "../connectors/slack.js";
import {
  renderedBriefingCard,
  type BriefingCardMessageContent,
  type RenderedAgentMessage
} from "../agents/output.js";
import type { AgentRunTrigger } from "../queue/index.js";
import type { AgentRow } from "./agent-types.js";
import { scheduledIntro, scheduledTitle } from "./schedule-labels.js";

type BriefingIntent =
  | "daily_executive_briefing"
  | "project_pulse"
  | "meeting_intelligence"
  | "weekly_accomplishment_report";

type SourceSpec = {
  id: string;
  label: string;
  intent: string;
  tone: "neutral" | "info" | "attention" | "positive";
  render: (agent: AgentRow, trigger: AgentRunTrigger) => Promise<RenderedAgentMessage | null>;
};

const workspaceRender = (agent: AgentRow, trigger: AgentRunTrigger) =>
  renderGoogleWorkspaceAgent(agent, renderOptions(trigger));
const slackRender = (agent: AgentRow, trigger: AgentRunTrigger) =>
  renderSlackAgent(agent, renderOptions(trigger));
const githubRender = (agent: AgentRow, trigger: AgentRunTrigger) =>
  renderGitHubAgent(agent, renderOptions(trigger));
const notionRender = (agent: AgentRow, trigger: AgentRunTrigger) =>
  renderNotionAgent(agent, renderOptions(trigger));

const configurations: Record<BriefingIntent, {
  eyebrow: string;
  title: string;
  sources: SourceSpec[];
}> = {
  daily_executive_briefing: {
    eyebrow: "DAILY BRIEFING",
    title: "Your day, distilled",
    sources: [
      source("calendar", "Calendar", "calendar_agenda", "info", workspaceRender),
      source("gmail", "Gmail", "email_digest", "attention", workspaceRender),
      source("slack", "Slack", "slack_digest", "neutral", slackRender)
    ]
  },
  project_pulse: {
    eyebrow: "PROJECT PULSE",
    title: "What moved and what needs attention",
    sources: [
      source("github", "GitHub", "github_activity_digest", "positive", githubRender),
      source("slack", "Slack", "weekly_progress_report", "attention", slackRender),
      source("notion", "Notion", "notion_workspace_digest", "info", notionRender),
      source("drive", "Drive", "drive_summary", "neutral", workspaceRender)
    ]
  },
  meeting_intelligence: {
    eyebrow: "MEETING INTELLIGENCE",
    title: "Context before the conversation",
    sources: [
      source("calendar", "Calendar", "calendar_agenda", "info", workspaceRender),
      source("gmail", "Gmail", "email_digest", "attention", workspaceRender),
      source("drive", "Meeting notes", "meeting_recap", "neutral", workspaceRender),
      source("notion", "Notion", "notion_workspace_digest", "positive", notionRender)
    ]
  },
  weekly_accomplishment_report: {
    eyebrow: "WEEKLY REVIEW",
    title: "Your week in evidence",
    sources: [
      source("slack", "Slack", "weekly_progress_report", "attention", slackRender),
      source("github", "GitHub", "github_activity_digest", "positive", githubRender),
      source("drive", "Drive", "drive_summary", "neutral", workspaceRender),
      source("notion", "Notion", "notion_workspace_digest", "info", notionRender)
    ]
  }
};

export function isBriefingIntent(value: string): value is BriefingIntent {
  return value in configurations;
}

export async function renderBriefingAgent(
  agent: AgentRow,
  trigger: AgentRunTrigger
): Promise<RenderedAgentMessage> {
  const intent = String(agent.parsed_intent.intent ?? "");
  if (!isBriefingIntent(intent)) throw new Error("unsupported_briefing_intent");
  const config = configurations[intent];

  const settled = await Promise.allSettled(
    config.sources.map(async (spec) => ({
      spec,
      message: await spec.render(withIntent(agent, spec.intent), trigger)
    }))
  );

  const sections: BriefingCardMessageContent["data"]["sections"] = [];
  const missingSources: string[] = [];
  const sourceRefs: unknown[] = [];
  let tokensUsed = 0;

  settled.forEach((result, index) => {
    const spec = config.sources[index]!;
    if (result.status === "rejected" || !result.value.message) {
      missingSources.push(spec.label);
      return;
    }
    const message = result.value.message;
    sections.push({
      id: spec.id,
      title: spec.label,
      source: spec.label,
      tone: spec.tone,
      items: briefingItems(message)
    });
    sourceRefs.push(...message.sourceRefs);
    tokensUsed += message.tokensUsed;
  });

  const highlightCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  return renderedBriefingCard(
    {
      eyebrow: config.eyebrow,
      title: config.title,
      summary: sections.length === 0
        ? "Connect the suggested services to build this briefing."
        : `${sections.length} connected sources checked · ${highlightCount} highlights surfaced`,
      sections,
      missing_sources: missingSources
    },
    { sourceRefs, tokensUsed }
  );
}

function source(
  id: string,
  label: string,
  intent: string,
  tone: SourceSpec["tone"],
  render: SourceSpec["render"]
): SourceSpec {
  return { id, label, intent, tone, render };
}

function renderOptions(trigger: AgentRunTrigger) {
  return {
    scheduledIntro: (agent: AgentRow, label: string) => scheduledIntro(agent, label, trigger),
    scheduledTitle: (agent: AgentRow, label: string) => scheduledTitle(agent, label, trigger)
  };
}

function withIntent(agent: AgentRow, intent: string): AgentRow {
  return {
    ...agent,
    parsed_intent: { ...agent.parsed_intent, intent }
  };
}

export function briefingItems(message: RenderedAgentMessage): Array<{
  title: string;
  detail?: string;
  meta?: string;
}> {
  const data = message.content.data as Record<string, unknown>;
  const items: Array<{ title: string; detail?: string; meta?: string }> = [];
  const rawItems = Array.isArray(data.items) ? data.items : [];

  for (const raw of rawItems.slice(0, 4)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const title = firstText(item, ["label", "headline", "title", "name", "summary"]);
    if (!title) continue;
    const detail = firstText(item, ["preview", "detail", "description", "summary"]);
    const meta = firstText(item, ["due", "urgency", "timestamp"]);
    items.push({ title, ...(detail && detail !== title ? { detail } : {}), ...(meta ? { meta } : {}) });
  }

  if (items.length === 0 && Array.isArray(data.metrics)) {
    for (const raw of data.metrics.slice(0, 4)) {
      if (!raw || typeof raw !== "object") continue;
      const metric = raw as Record<string, unknown>;
      const label = firstText(metric, ["label"]);
      const value = firstText(metric, ["value"]);
      if (label && value) items.push({ title: `${label}: ${value}`, detail: firstText(metric, ["sublabel"]) });
    }
  }

  if (items.length === 0) {
    const summary = firstText(data, ["summary", "message", "text", "body", "description", "insight"]);
    if (summary) items.push({ title: summary });
  }

  return items.length > 0 ? items : [{ title: "No notable updates found." }];
}

function firstText(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 700);
  }
  return undefined;
}

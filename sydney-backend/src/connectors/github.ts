import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  digestSection,
  renderedAllClear,
  renderedDataSummary,
  type RenderedAgentMessage
} from "../agents/output.js";
import { resolveOutcomeCopy } from "../agents/runtime/outcome-copy.js";
import {
  connectorRecipeContext,
  synthesizeConnectorDigest
} from "../agents/connector-summarizer.js";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import { ConnectorAuthRequiredError } from "./errors.js";
import { upsertConnectorInstallation } from "../events/engine.js";
import {
  githubRepositoryMatches,
  githubRepositoryScope
} from "../agents/github-scope.js";
import type { AgentRunTrigger } from "../queue/index.js";
import {
  decryptConnectorSecret,
  encryptConnectorSecret
} from "./token-vault.js";

const githubAuthorizationEndpoint = "https://github.com/login/oauth/authorize";
const githubAppBase = "https://github.com/apps";
const githubTokenEndpoint = "https://github.com/login/oauth/access_token";
const githubApiBase = "https://api.github.com";
const githubApiVersion = "2022-11-28";

type GitHubTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GitHubTokenRow = {
  access_token_enc: string;
  refresh_token_enc: string;
  token_expires_at: Date | string;
};

type GitHubUser = {
  id?: number;
  login: string;
  html_url?: string;
};

type GitHubRepository = {
  id: number;
  full_name: string;
  private: boolean;
  html_url: string;
  description?: string | null;
  language?: string | null;
  updated_at?: string;
  pushed_at?: string | null;
  open_issues_count?: number;
};

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  updated_at?: string;
  repository_url?: string;
  pull_request?: Record<string, unknown>;
};

type GitHubSearchResponse = {
  total_count?: number;
  items?: GitHubIssue[];
};

type GitHubAgent = {
  id: string;
  user_id: string;
  name: string;
  prompt: string;
  parsed_intent: Record<string, unknown>;
  connector_ids: string[];
  schedule_cron: string | null;
  is_assistant: boolean;
  status: "active" | "paused" | "error";
  safety_level: "read" | "suggest" | "act";
};

type GitHubRenderOptions = {
  scheduledIntro: (agent: GitHubAgent, label: string) => string;
  scheduledTitle: (agent: GitHubAgent, label: string) => string;
  trigger?: AgentRunTrigger;
  eventId?: string;
};

type OAuthState = {
  v: 1;
  userId: string;
  connectorId: "github";
  callbackScheme: string;
  nonce: string;
  iat: number;
  exp: number;
};

export function githubAuthConfigured(): boolean {
  return Boolean(
    config.GITHUB_CLIENT_ID &&
      config.GITHUB_CLIENT_SECRET &&
      config.GITHUB_REDIRECT_URI
  );
}

export function githubAppInstallConfigured(): boolean {
  return Boolean(config.GITHUB_APP_SLUG);
}

export function githubRequestedScopes(): string[] {
  return config.GITHUB_OAUTH_SCOPES
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function githubPrivateRepositoryAccessEnabled(): boolean {
  return githubRequestedScopes().includes("repo");
}

export async function createGitHubAuthUrl(input: {
  userId: string;
  callbackScheme: string;
}): Promise<{ authUrl: string; callbackScheme: string }> {
  ensureGitHubAuthConfigured();

  const callbackScheme = sanitizeCallbackScheme(input.callbackScheme);
  const now = Math.floor(Date.now() / 1000);
  const state = signOAuthState({
    v: 1,
    userId: input.userId,
    connectorId: "github",
    callbackScheme,
    nonce: randomBytes(16).toString("base64url"),
    iat: now,
    exp: now + 10 * 60
  });

  const authUrl = config.GITHUB_APP_SLUG
    ? buildGitHubAppInstallUrl(config.GITHUB_APP_SLUG, state)
    : buildGitHubOAuthUrl(state);

  return { authUrl: authUrl.toString(), callbackScheme };
}

export function buildGitHubAppInstallUrl(slug: string, state: string): URL {
  if (!/^[a-z0-9-]+$/i.test(slug)) {
    throw new Error("invalid_github_app_slug");
  }
  const url = new URL(`${githubAppBase}/${slug}/installations/new`);
  url.searchParams.set("state", state);
  return url;
}

export async function handleGitHubInstallCallback(input: {
  installation_id?: string;
  setup_action?: string;
  state?: string;
}): Promise<URL> {
  if (!input.state) {
    return mobileConnectorRedirect("sydney", { error: "missing_state" });
  }

  const state = verifyOAuthState(input.state);
  if (input.setup_action === "delete") {
    return mobileConnectorRedirect(state.callbackScheme, {
      error: "github_app_installation_removed"
    });
  }
  if (!input.installation_id || !/^\d+$/.test(input.installation_id)) {
    return mobileConnectorRedirect(state.callbackScheme, {
      error: "missing_installation_id"
    });
  }

  await storeGitHubAppInstallation(state.userId, input.installation_id);

  const oauthState = createOAuthState(state.userId, state.callbackScheme);
  return buildGitHubOAuthUrl(oauthState);
}

export async function handleGitHubOAuthCallback(input: {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}): Promise<URL> {
  if (!input.state) {
    return mobileConnectorRedirect("sydney", {
      error: input.error ?? "missing_state"
    });
  }

  const state = verifyOAuthState(input.state);
  if (input.error) {
    return mobileConnectorRedirect(state.callbackScheme, {
      error: input.error_description ?? input.error
    });
  }
  if (!input.code) {
    return mobileConnectorRedirect(state.callbackScheme, {
      error: "missing_code"
    });
  }

  try {
    const token = await exchangeAuthorizationCode(input.code);
    const identity = await validateGitHubIdentity(token.access_token!);
    await storeGitHubToken(state.userId, token);
    await storeGitHubIdentityMapping(state.userId, identity);
    return mobileConnectorRedirect(state.callbackScheme, {
      status: "connected"
    });
  } catch (error) {
    return mobileConnectorRedirect(state.callbackScheme, {
      error: errorCode(error)
    });
  }
}

export function parseGitHubCallbackUrl(
  callbackUrl: string
): { connectorId: "github"; error?: string } {
  const url = new URL(callbackUrl);
  const allowedSchemes = new Set([
    "sydney:",
    `${config.MOBILE_AUTH_CALLBACK_SCHEME}:`
  ]);
  if (!allowedSchemes.has(url.protocol)) {
    throw new Error("Invalid connector callback scheme.");
  }
  if (url.hostname !== "connectors" || url.pathname !== "/github") {
    throw new Error("Invalid GitHub connector callback URL.");
  }
  if (url.searchParams.get("connector_id") !== "github") {
    throw new Error("Invalid GitHub connector.");
  }

  return {
    connectorId: "github",
    error: url.searchParams.get("error") ?? undefined
  };
}

export async function hasUsableGitHubToken(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM connector_tokens
        WHERE user_id = $1
          AND connector_id = 'github'
          AND status = 'connected'
      ) AS exists
    `,
    [userId]
  );

  return rows[0]?.exists === true;
}

type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
    committer?: {
      name: string;
      date: string;
    };
  };
  html_url: string;
};

type GitHubTimelineItem = {
  title: string;
  repository?: string;
  timestamp?: string;
  url?: string;
  type: "commit" | "repository" | "issue" | "pull_request";
};

export type GitHubInboundEvent = {
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: Date | string;
};

export type GitHubActivityWindow = {
  since: Date;
  until: Date;
  resumedFromPreviousRun: boolean;
};

export type PreparedGitHubWebhookActivity = {
  repository: string;
  summary: string;
  metrics: Array<{ label: string; value: string }>;
  timeline: GitHubTimelineItem[];
  sourceRefs: Array<Record<string, unknown>>;
};

const githubInitialLookbackMs = 24 * 60 * 60 * 1000;
const githubMaximumLookbackMs = 7 * githubInitialLookbackMs;

async function fetchCommits(
  accessToken: string,
  userId: string,
  repoFullName: string,
  sinceIsoString: string,
  untilIsoString: string
): Promise<GitHubCommit[]> {
  try {
    const url = new URL(`${githubApiBase}/repos/${repoFullName}/commits`);
    url.searchParams.set("since", sinceIsoString);
    url.searchParams.set("until", untilIsoString);
    url.searchParams.set("per_page", "5");
    return await githubJson<GitHubCommit[]>(url, accessToken, userId);
  } catch (error) {
    console.error(`Failed to fetch commits for ${repoFullName}:`, error);
    return [];
  }
}

export async function renderGitHubAgent(
  agent: GitHubAgent,
  options: GitHubRenderOptions
): Promise<RenderedAgentMessage | null> {
  if (String(agent.parsed_intent.intent ?? "") !== "github_activity_digest") {
    return null;
  }

  if (options.trigger === "event") {
    if (!options.eventId) {
      throw new Error("github_event_context_missing");
    }
    const event = await loadGitHubInboundEvent(options.eventId, agent.id);
    if (!event) {
      throw new Error("github_event_not_found");
    }
    return renderGitHubInboundEvent(agent, event, options);
  }

  const intent = String(agent.parsed_intent.intent ?? "");
  const accessToken = await githubAccessToken(agent.user_id);
  if (!accessToken) return null;

  const until = new Date();
  const [user, allRepositories, previousRun] = await Promise.all([
    githubJson<GitHubUser>(
      new URL(`${githubApiBase}/user`),
      accessToken,
      agent.user_id
    ),
    fetchRepositories(accessToken, agent.user_id),
    latestSuccessfulGitHubRun(agent.id)
  ]);
  const [issueSearch, pullRequestSearch] = await Promise.all([
    searchAssignedActivity(
      accessToken,
      agent.user_id,
      user.login,
      "issue"
    ),
    searchAssignedActivity(accessToken, agent.user_id, user.login, "pr")
  ]);
  const window = resolveGitHubActivityWindow(previousRun, until);
  const repositoryScope = githubRepositoryScope(
    agent.parsed_intent,
    agent.prompt
  );
  const repositories = allRepositories.filter((repository) =>
    githubRepositoryMatches(repositoryScope, repository.full_name)
  );
  const issues = (issueSearch.items ?? []).filter(
    (issue) =>
      githubRepositoryMatches(repositoryScope, repositoryName(issue)) &&
      githubTimestampInWindow(issue.updated_at, window)
  );
  const pullRequests = (pullRequestSearch.items ?? []).filter(
    (pullRequest) =>
      githubRepositoryMatches(repositoryScope, repositoryName(pullRequest)) &&
      githubTimestampInWindow(pullRequest.updated_at, window)
  );
  const recentRepositories = repositories.filter((repository) =>
    githubTimestampInWindow(
      repository.pushed_at || repository.updated_at,
      window
    )
  );

  const includeLatestCommitHistory = options.trigger === "manual";

  const commitRecords: string[] = [];
  const commitSourceRefs: any[] = [];
  const timeline: GitHubTimelineItem[] = [];
  const commitsLists = await Promise.all(
    repositories.slice(0, 5).map((repo) =>
      includeLatestCommitHistory
        ? fetchLatestCommits(accessToken, agent.user_id, repo.full_name, 5)
        : fetchCommits(
            accessToken,
            agent.user_id,
            repo.full_name,
            window.since.toISOString(),
            window.until.toISOString()
          )
    )
  );
  const deliveredShas = new Set<string>();
  for (let i = 0; i < commitsLists.length; i++) {
    const repoCommits = commitsLists[i]!;
    const repoName = repositories[i]!.full_name;
    for (const c of repoCommits) {
      const timestamp = githubCommitTimestamp(c);
      if (
        deliveredShas.has(c.sha) ||
        (!includeLatestCommitHistory && !githubTimestampInWindow(timestamp, window))
      ) {
        continue;
      }
      deliveredShas.add(c.sha);
      commitRecords.push(
        `Commit: ${repoName} | Message: ${c.commit.message} | Author: ${c.commit.author.name} | Date: ${timestamp}`
      );
      commitSourceRefs.push({
        type: "github_commit",
        source: "GitHub",
        id: c.sha,
        name: c.commit.message,
        url: c.html_url
      });
      timeline.push({
        title: c.commit.message.split("\n")[0]?.trim() || "Commit pushed",
        repository: repoName,
        timestamp,
        url: c.html_url,
        type: "commit"
      });
    }
  }

  timeline.push(
    ...pullRequests.map((pullRequest) => ({
      title: pullRequest.title,
      repository: repositoryName(pullRequest),
      timestamp: pullRequest.updated_at,
      url: pullRequest.html_url,
      type: "pull_request" as const
    })),
    ...issues.map((issue) => ({
      title: issue.title,
      repository: repositoryName(issue),
      timestamp: issue.updated_at,
      url: issue.html_url,
      type: "issue" as const
    }))
  );
  timeline.sort((left, right) =>
    String(right.timestamp ?? "").localeCompare(String(left.timestamp ?? ""))
  );

  const records = [
    ...commitRecords,
    ...issues.map((issue) => issueRecord(issue, "Issue")),
    ...pullRequests.map((issue) => issueRecord(issue, "Pull request")),
    ...recentRepositories.map(repositoryRecord)
  ];
  const synthesized =
    records.length > 0
      ? await synthesizeConnectorDigest({
          connectorName: "GitHub",
          agentName: agent.name,
          userPrompt: agent.prompt,
          records,
          ...connectorRecipeContext(agent.parsed_intent)
        })
      : null;
  const fallbackSummary = [
    commitRecords.length > 0
      ? digestSection("Recent commits", commitRecords.map((r) => r.replace(/^Commit:\s*/i, "")))
      : digestSection(
          "Recently updated repositories",
          recentRepositories.map(repositoryLine)
        ),
    digestSection("Open issues involving you", issues.map(issueLine)),
    digestSection("Open pull requests involving you", pullRequests.map(issueLine))
  ]
    .filter(Boolean)
    .join("\n\n");
  const sourceRefs = [
    ...recentRepositories.map((repository) => ({
      type: "github_repository",
      source: "GitHub",
      id: String(repository.id),
      name: repository.full_name,
      url: repository.html_url
    })),
    ...issues.map((issue) => githubIssueSourceRef(issue, "issue")),
    ...pullRequests.map((issue) => githubIssueSourceRef(issue, "pull_request")),
    ...commitSourceRefs
  ];

  if (records.length === 0) {
    return renderedAllClear(
      resolveOutcomeCopy(intent, "no_relevant_items"),
      {
        sourceRefs: [],
        details: {
          source: "GitHub",
          itemsChecked: 0,
          readOnly: true
        }
      }
    );
  }

  return renderedDataSummary(
    {
      title: options.scheduledTitle(agent, "GitHub activity"),
      text: options.scheduledIntro(agent, "GitHub activity"),
      summary:
        synthesized?.summary ||
        fallbackSummary ||
        resolveOutcomeCopy(intent, "no_relevant_items"),
      metrics: [
        { label: "Repositories", value: String(recentRepositories.length) },
        { label: "Open issues", value: String(issues.length) },
        {
          label: "Open PRs",
          value: String(pullRequests.length)
        },
        { label: "Commits", value: String(commitSourceRefs.length) }
      ],
      footer: window.resumedFromPreviousRun
        ? "Read-only activity since this agent's previous successful run."
        : "Read-only activity from the previous 24 hours.",
      kind: "github_activity",
      timeline: timeline.slice(0, 10)
    },
    { sourceRefs, tokensUsed: synthesized?.tokensUsed ?? 0 }
  );
}

async function loadGitHubInboundEvent(
  eventId: string,
  agentId: string
): Promise<GitHubInboundEvent | null> {
  const { rows } = await pool.query<GitHubInboundEvent>(
    `
      SELECT event.event_type, event.payload, event.occurred_at
      FROM inbound_events event
      JOIN event_deliveries delivery ON delivery.event_id = event.id
      WHERE event.id = $1
        AND delivery.agent_id = $2
        AND event.source = 'github'
      LIMIT 1
    `,
    [eventId, agentId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    payload: githubPayloadRecord(row.payload)
  };
}

function renderGitHubInboundEvent(
  agent: GitHubAgent,
  event: GitHubInboundEvent,
  options: GitHubRenderOptions
): RenderedAgentMessage {
  const scope = githubRepositoryScope(agent.parsed_intent, agent.prompt);
  if (!githubRepositoryMatches(scope, event.payload.repository)) {
    throw new Error("github_event_repository_mismatch");
  }
  const activity = prepareGitHubWebhookActivity(event);

  return renderedDataSummary(
    {
      title: options.scheduledTitle(agent, "GitHub activity"),
      text: options.scheduledIntro(agent, "GitHub activity"),
      summary: activity.summary,
      metrics: activity.metrics,
      footer: "Realtime update delivered from GitHub.",
      kind: "github_activity",
      timeline: activity.timeline
    },
    { sourceRefs: activity.sourceRefs, tokensUsed: 0 }
  );
}

export function prepareGitHubWebhookActivity(
  event: GitHubInboundEvent
): PreparedGitHubWebhookActivity {
  const payload = githubPayloadRecord(event.payload);
  const repository =
    githubString(payload.repository) ?? "GitHub repository";
  const occurredAt = githubEventTimestamp(event.occurred_at);
  const eventType = event.event_type.replace(/^github\./, "");
  const action = githubString(payload.action);
  const repositoryUrl = githubString(payload.repository_url);

  if (eventType === "push") {
    const commits = githubCommitPayloads(payload);
    const timeline: GitHubTimelineItem[] = commits.map((commit) => ({
      title:
        githubFirstLine(githubString(commit.message)) ??
        `Commit ${githubString(commit.sha)?.slice(0, 7) ?? "pushed"}`,
      repository,
      timestamp: githubString(commit.timestamp) ?? occurredAt,
      url: githubString(commit.url),
      type: "commit"
    }));
    const sourceRefs = commits.map((commit) => ({
      type: "github_commit",
      source: "GitHub",
      id: githubString(commit.sha)!,
      name:
        githubFirstLine(githubString(commit.message)) ??
        `Commit ${githubString(commit.sha)!.slice(0, 7)}`,
      url: githubString(commit.url),
      repository
    }));
    const branch = githubBranchName(githubString(payload.ref));
    if (timeline.length === 0) {
      timeline.push({
        title: branch ? `Push to ${branch}` : "Repository push received",
        repository,
        timestamp: occurredAt,
        url: githubString(payload.compare) ?? repositoryUrl,
        type: "repository"
      });
      sourceRefs.push({
        type: "github_repository",
        source: "GitHub",
        id: repository,
        name: repository,
        url: repositoryUrl,
        repository
      });
    }
    const reportedCount = githubNumber(payload.commit_count) ?? commits.length;
    const truncated = payload.commits_truncated === true;
    const target = branch ? `${repository} on ${branch}` : repository;
    return {
      repository,
      summary:
        reportedCount === 0
          ? `A push updated ${target}.`
          : `${reportedCount} ${reportedCount === 1 ? "commit was" : "commits were"} pushed to ${target}.${
              truncated ? " The webhook contained additional commits." : ""
            }`,
      metrics: [
        { label: "Commits", value: String(reportedCount) },
        ...(branch ? [{ label: "Branch", value: branch }] : [])
      ],
      timeline,
      sourceRefs
    };
  }

  if (eventType === "pull_request") {
    const pullRequest = githubPayloadRecord(payload.pull_request);
    const number = githubNumber(pullRequest.number);
    const title = githubString(pullRequest.title) ?? "Pull request updated";
    const state = githubString(pullRequest.state) ?? action ?? "updated";
    const url = githubString(pullRequest.url);
    return githubSingleEventActivity({
      repository,
      summary: `${number ? `Pull request #${number}` : "A pull request"} was ${action ?? state} in ${repository}.`,
      metricLabel: "Pull request",
      metricValue: number ? `#${number}` : state,
      timeline: {
        title,
        repository,
        timestamp:
          githubString(pullRequest.updated_at) ??
          githubString(pullRequest.created_at) ??
          occurredAt,
        url,
        type: "pull_request"
      },
      sourceRef: {
        type: "github_pull_request",
        source: "GitHub",
        id: String(githubString(pullRequest.id) ?? number ?? title),
        number,
        repository,
        title,
        url
      }
    });
  }

  if (eventType === "issues") {
    const issue = githubPayloadRecord(payload.issue);
    const number = githubNumber(issue.number);
    const title = githubString(issue.title) ?? "Issue updated";
    const state = githubString(issue.state) ?? action ?? "updated";
    const url = githubString(issue.url);
    return githubSingleEventActivity({
      repository,
      summary: `${number ? `Issue #${number}` : "An issue"} was ${action ?? state} in ${repository}.`,
      metricLabel: "Issue",
      metricValue: number ? `#${number}` : state,
      timeline: {
        title,
        repository,
        timestamp:
          githubString(issue.updated_at) ??
          githubString(issue.created_at) ??
          occurredAt,
        url,
        type: "issue"
      },
      sourceRef: {
        type: "github_issue",
        source: "GitHub",
        id: String(githubString(issue.id) ?? number ?? title),
        number,
        repository,
        title,
        url
      }
    });
  }

  if (eventType === "release") {
    const release = githubPayloadRecord(payload.release);
    const tag = githubString(release.tag_name);
    const title = githubString(release.name) ?? tag ?? "Release updated";
    const url = githubString(release.url);
    return githubSingleEventActivity({
      repository,
      summary: `${tag ? `Release ${tag}` : "A release"} was ${action ?? "updated"} in ${repository}.`,
      metricLabel: "Release",
      metricValue: tag ?? action ?? "Updated",
      timeline: {
        title,
        repository,
        timestamp:
          githubString(release.published_at) ??
          githubString(release.created_at) ??
          occurredAt,
        url,
        type: "repository"
      },
      sourceRef: {
        type: "github_release",
        source: "GitHub",
        id: String(githubString(release.id) ?? tag ?? title),
        repository,
        name: title,
        url
      }
    });
  }

  if (eventType === "workflow_run") {
    const workflow = githubPayloadRecord(payload.workflow_run);
    const name = githubString(workflow.name) ?? "Workflow run";
    const conclusion =
      githubString(workflow.conclusion) ??
      githubString(workflow.status) ??
      action ??
      "updated";
    const url = githubString(workflow.url);
    return githubSingleEventActivity({
      repository,
      summary: `${name} ${conclusion} in ${repository}.`,
      metricLabel: "Workflow",
      metricValue: conclusion,
      timeline: {
        title: name,
        repository,
        timestamp:
          githubString(workflow.updated_at) ??
          githubString(workflow.run_started_at) ??
          occurredAt,
        url,
        type: "repository"
      },
      sourceRef: {
        type: "github_workflow_run",
        source: "GitHub",
        id: String(githubString(workflow.id) ?? name),
        repository,
        name,
        url
      }
    });
  }

  return githubSingleEventActivity({
    repository,
    summary: `GitHub reported ${eventType.replaceAll("_", " ")} activity in ${repository}.`,
    metricLabel: "Event",
    metricValue: eventType.replaceAll("_", " "),
    timeline: {
      title: action ? `${eventType.replaceAll("_", " ")} ${action}` : "Repository activity",
      repository,
      timestamp: occurredAt,
      url: repositoryUrl,
      type: "repository"
    },
    sourceRef: {
      type: "github_repository",
      source: "GitHub",
      id: repository,
      repository,
      name: repository,
      url: repositoryUrl
    }
  });
}

function githubSingleEventActivity(input: {
  repository: string;
  summary: string;
  metricLabel: string;
  metricValue: string;
  timeline: GitHubTimelineItem;
  sourceRef: Record<string, unknown>;
}): PreparedGitHubWebhookActivity {
  return {
    repository: input.repository,
    summary: input.summary,
    metrics: [{ label: input.metricLabel, value: input.metricValue }],
    timeline: [input.timeline],
    sourceRefs: [input.sourceRef]
  };
}

function githubCommitPayloads(
  payload: Record<string, unknown>
): Array<Record<string, unknown>> {
  const candidates = Array.isArray(payload.commits)
    ? payload.commits.map(githubPayloadRecord)
    : [];
  const headCommit = githubPayloadRecord(payload.head_commit);
  if (Object.keys(headCommit).length > 0) candidates.push(headCommit);

  const seen = new Set<string>();
  return candidates.filter((commit) => {
    const sha = githubString(commit.sha);
    if (!sha || seen.has(sha)) return false;
    seen.add(sha);
    return true;
  });
}

function githubPayloadRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return githubPayloadRecord(parsed);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function githubString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function githubNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function githubFirstLine(value: string | undefined): string | undefined {
  return githubString(value?.split("\n")[0]);
}

function githubBranchName(ref: string | undefined): string | undefined {
  return githubString(ref?.replace(/^refs\/heads\//, ""));
}

function githubEventTimestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

async function latestSuccessfulGitHubRun(
  agentId: string
): Promise<Date | string | null> {
  const { rows } = await pool.query<{ completed_at: Date | string }>(
    `
      SELECT completed_at
      FROM agent_runs
      WHERE agent_id = $1
        AND status IN ('success', 'partial')
        AND completed_at IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 1
    `,
    [agentId]
  );
  return rows[0]?.completed_at ?? null;
}

export function resolveGitHubActivityWindow(
  previousCompletedAt: Date | string | null,
  runStartedAt: Date = new Date()
): GitHubActivityWindow {
  const until = Number.isNaN(runStartedAt.getTime())
    ? new Date()
    : new Date(runStartedAt);
  const fallback = new Date(until.getTime() - githubInitialLookbackMs);
  const lowerBound = new Date(until.getTime() - githubMaximumLookbackMs);
  const previous = previousCompletedAt
    ? new Date(previousCompletedAt)
    : null;
  const usablePrevious =
    previous &&
    !Number.isNaN(previous.getTime()) &&
    previous.getTime() < until.getTime()
      ? previous
      : null;
  const since = usablePrevious
    ? new Date(Math.max(usablePrevious.getTime(), lowerBound.getTime()))
    : fallback;

  return {
    since,
    until,
    resumedFromPreviousRun: usablePrevious !== null
  };
}

export function githubTimestampInWindow(
  value: string | null | undefined,
  window: GitHubActivityWindow
): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return (
    Number.isFinite(timestamp) &&
    timestamp > window.since.getTime() &&
    timestamp <= window.until.getTime()
  );
}

function githubCommitTimestamp(commit: GitHubCommit): string {
  return commit.commit.committer?.date ?? commit.commit.author.date;
}

async function exchangeAuthorizationCode(code: string): Promise<GitHubTokenResponse> {
  ensureGitHubAuthConfigured();
  const response = await fetch(githubTokenEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID!,
      client_secret: config.GITHUB_CLIENT_SECRET!,
      code,
      redirect_uri: config.GITHUB_REDIRECT_URI!
    })
  });
  const body = (await response.json()) as GitHubTokenResponse;
  if (!response.ok || body.error || !body.access_token) {
    throw new Error(
      body.error_description ?? body.error ?? "github_token_exchange_failed"
    );
  }
  return body;
}

async function refreshGitHubToken(
  userId: string,
  refreshToken: string
): Promise<string> {
  ensureGitHubAuthConfigured();
  const response = await fetch(githubTokenEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID!,
      client_secret: config.GITHUB_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  });
  const body = (await response.json()) as GitHubTokenResponse;
  if (!response.ok || body.error || !body.access_token) {
    await markGitHubActionRequired(userId);
    throw githubAuthRequired(
      body.error_description ?? body.error ?? "github_token_refresh_failed"
    );
  }

  await pool.query(
    `
      UPDATE connector_tokens
      SET access_token_enc = $2,
          refresh_token_enc = $3,
          token_expires_at = $4,
          scopes = $5,
          status = 'connected',
          updated_at = NOW()
      WHERE user_id = $1 AND connector_id = 'github'
    `,
    [
      userId,
      encryptConnectorSecret(body.access_token),
      encryptConnectorSecret(body.refresh_token ?? refreshToken),
      tokenExpiry(body.expires_in),
      parseScopes(body.scope)
    ]
  );

  return body.access_token;
}

async function validateGitHubIdentity(accessToken: string): Promise<GitHubUser> {
  const response = await fetch(`${githubApiBase}/user`, {
    headers: githubHeaders(accessToken)
  });
  const body = (await response.json()) as GitHubUser & {
    message?: string;
  };
  if (!response.ok || !body.login) {
    throw new Error(body.message ?? "github_identity_validation_failed");
  }
  return body;
}

async function storeGitHubToken(
  userId: string,
  token: GitHubTokenResponse
): Promise<void> {
  if (!token.access_token) throw new Error("missing_access_token");
  const refreshToken = token.refresh_token ?? token.access_token;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `
        INSERT INTO connector_tokens
          (user_id, connector_id, access_token_enc, refresh_token_enc,
           token_expires_at, scopes, status)
        VALUES ($1, 'github', $2, $3, $4, $5, 'connected')
        ON CONFLICT (user_id, connector_id)
        DO UPDATE SET
          access_token_enc = EXCLUDED.access_token_enc,
          refresh_token_enc = EXCLUDED.refresh_token_enc,
          token_expires_at = EXCLUDED.token_expires_at,
          scopes = EXCLUDED.scopes,
          status = 'connected',
          updated_at = NOW()
      `,
      [
        userId,
        encryptConnectorSecret(token.access_token),
        encryptConnectorSecret(refreshToken),
        tokenExpiry(token.expires_in),
        parseScopes(token.scope)
      ]
    );
    await client.query(
      `
        INSERT INTO connector_statuses (user_id, connector_id, status)
        VALUES ($1, 'github', 'connected')
        ON CONFLICT (user_id, connector_id)
        DO UPDATE SET status = 'connected', updated_at = NOW()
      `,
      [userId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function githubAccessToken(userId: string): Promise<string | null> {
  const { rows } = await pool.query<GitHubTokenRow>(
    `
      SELECT access_token_enc, refresh_token_enc, token_expires_at
      FROM connector_tokens
      WHERE user_id = $1
        AND connector_id = 'github'
        AND status = 'connected'
    `,
    [userId]
  );
  const token = rows[0];
  if (!token) return null;

  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = decryptConnectorSecret(token.access_token_enc);
    refreshToken = decryptConnectorSecret(token.refresh_token_enc);
  } catch {
    await markGitHubActionRequired(userId);
    throw githubAuthRequired("connector_token_decryption_failed");
  }

  const expiresAt = new Date(token.token_expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt > Date.now() + 60_000) {
    return accessToken;
  }
  if (refreshToken === accessToken) {
    await markGitHubActionRequired(userId);
    throw githubAuthRequired("github_token_expired");
  }
  return refreshGitHubToken(userId, refreshToken);
}

async function fetchRepositories(
  accessToken: string,
  userId: string
): Promise<GitHubRepository[]> {
  const url = new URL(`${githubApiBase}/user/repos`);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("direction", "desc");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("affiliation", "owner,collaborator,organization_member");
  return githubJson<GitHubRepository[]>(url, accessToken, userId);
}

export async function readGitHubForAssistant(
  userId: string,
  input: { query?: string; limit?: number; latestCommit?: boolean }
): Promise<{ summary: string; sourceRefs: unknown[] }> {
  const accessToken = await githubAccessToken(userId);
  if (!accessToken) throw githubAuthRequired("github_not_connected");
  const query = input.query?.trim().toLowerCase();
  const repos = (await fetchRepositories(accessToken, userId))
    .filter((repo) =>
      !query ||
      repo.full_name.toLowerCase().includes(query) ||
      repo.description?.toLowerCase().includes(query)
    )
    .slice(0, Math.min(input.limit ?? 8, 10));
  if (input.latestCommit) {
    if (repos.length === 0) {
      return {
        summary: resolveOutcomeCopy("github_digest", "no_relevant_items"),
        sourceRefs: []
      };
    }
    const commitsByRepository = await Promise.all(
      repos.slice(0, 3).map(async (repo) => ({
        repo,
        commits: await fetchLatestCommits(
          accessToken,
          userId,
          repo.full_name,
          1
        )
      }))
    );
    const latest = commitsByRepository
      .flatMap(({ repo, commits }) =>
        commits.map((commit) => ({ repo, commit }))
      )
      .sort((left, right) =>
        githubCommitTimestamp(right.commit).localeCompare(
          githubCommitTimestamp(left.commit)
        )
      )[0];
    if (!latest) {
      return {
        summary: `No commits were found in ${repos.map((repo) => repo.full_name).join(", ")}.`,
        sourceRefs: repos.map((repo) => ({
          type: "github_repository",
          source: "GitHub",
          id: String(repo.id),
          name: repo.full_name,
          url: repo.html_url
        }))
      };
    }
    const firstLine =
      latest.commit.commit.message.split("\n")[0]?.trim() || "Untitled commit";
    const timestamp = githubCommitTimestamp(latest.commit);
    return {
      summary: [
        `Repository: ${latest.repo.full_name}`,
        `Commit: ${firstLine}`,
        `SHA: ${latest.commit.sha}`,
        `Author: ${latest.commit.commit.author.name}`,
        `Date: ${timestamp}`,
        `URL: ${latest.commit.html_url}`
      ].join("\n"),
      sourceRefs: [{
        type: "github_commit",
        source: "GitHub",
        id: latest.commit.sha,
        name: firstLine,
        url: latest.commit.html_url,
        repository: latest.repo.full_name
      }]
    };
  }
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const until = new Date().toISOString();
  const commits = await Promise.all(
    repos.slice(0, 3).map((repo) =>
      fetchCommits(accessToken, userId, repo.full_name, since, until)
    )
  );
  return {
    summary: repos.length === 0
      ? resolveOutcomeCopy("github_digest", "no_relevant_items")
      : repos.map((repo, index) => {
          const recent = (commits[index] ?? []).slice(0, 3)
            .map((commit) => commit.commit.message.split("\n")[0])
            .join("; ");
          return `- ${repo.full_name}${repo.description ? ` — ${repo.description}` : ""}${recent ? `\n  Recent commits: ${recent}` : ""}`;
        }).join("\n"),
    sourceRefs: repos.map((repo) => ({
      type: "github_repository",
      source: "GitHub",
      id: String(repo.id),
      name: repo.full_name,
      url: repo.html_url
    }))
  };
}

async function fetchLatestCommits(
  accessToken: string,
  userId: string,
  repoFullName: string,
  limit: number
): Promise<GitHubCommit[]> {
  try {
    const url = new URL(`${githubApiBase}/repos/${repoFullName}/commits`);
    url.searchParams.set("per_page", String(Math.min(Math.max(limit, 1), 5)));
    return await githubJson<GitHubCommit[]>(url, accessToken, userId);
  } catch (error) {
    console.error(`Failed to fetch latest commits for ${repoFullName}:`, error);
    return [];
  }
}

async function searchAssignedActivity(
  accessToken: string,
  userId: string,
  login: string,
  kind: "issue" | "pr"
): Promise<GitHubSearchResponse> {
  const url = new URL(`${githubApiBase}/search/issues`);
  url.searchParams.set("q", `is:open is:${kind} involves:${login}`);
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", "6");
  return githubJson<GitHubSearchResponse>(url, accessToken, userId);
}

async function githubJson<T>(
  url: URL,
  accessToken: string,
  userId: string
): Promise<T> {
  const response = await fetch(url, { headers: githubHeaders(accessToken) });
  const body = (await response.json()) as T & {
    message?: string;
    documentation_url?: string;
  };
  if (response.status === 401) {
    await markGitHubActionRequired(userId);
    throw githubAuthRequired(body.message ?? "github_api_auth_failed");
  }
  if (!response.ok) {
    throw new Error(body.message ?? `github_api_failed_${response.status}`);
  }
  return body;
}

function githubHeaders(accessToken: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "X-GitHub-Api-Version": githubApiVersion,
    "User-Agent": "Sydney-Agent"
  };
}

async function markGitHubActionRequired(userId: string): Promise<void> {
  await Promise.all([
    pool.query(
      `
        UPDATE connector_tokens
        SET status = 'action_required', updated_at = NOW()
        WHERE user_id = $1 AND connector_id = 'github'
      `,
      [userId]
    ),
    pool.query(
      `
        INSERT INTO connector_statuses (user_id, connector_id, status)
        VALUES ($1, 'github', 'action_required')
        ON CONFLICT (user_id, connector_id)
        DO UPDATE SET status = 'action_required', updated_at = NOW()
      `,
      [userId]
    )
  ]);
}

function repositoryLine(repository: GitHubRepository): string {
  const details = [
    repository.language,
    repository.private ? "private" : "public",
    repository.updated_at ? `updated ${formatDate(repository.updated_at)}` : null
  ].filter(Boolean);
  return `${repository.full_name}${details.length > 0 ? ` — ${details.join(", ")}` : ""}`;
}

function repositoryRecord(repository: GitHubRepository): string {
  return [
    `Repository: ${repository.full_name}`,
    `Visibility: ${repository.private ? "private" : "public"}`,
    repository.language ? `Language: ${repository.language}` : null,
    repository.updated_at ? `Updated: ${repository.updated_at}` : null,
    `Open issues count: ${repository.open_issues_count ?? 0}`
  ]
    .filter(Boolean)
    .join(" | ");
}

function issueLine(issue: GitHubIssue): string {
  return `${repositoryName(issue)}#${issue.number} — ${issue.title}`;
}

function issueRecord(issue: GitHubIssue, label: string): string {
  return [
    `${label}: ${repositoryName(issue)}#${issue.number}`,
    `Title: ${issue.title}`,
    issue.updated_at ? `Updated: ${issue.updated_at}` : null
  ]
    .filter(Boolean)
    .join(" | ");
}

function githubIssueSourceRef(
  issue: GitHubIssue,
  type: "issue" | "pull_request"
) {
  return {
    type: `github_${type}`,
    source: "GitHub",
    id: String(issue.id),
    number: issue.number,
    repository: repositoryName(issue),
    title: issue.title,
    url: issue.html_url
  };
}

function repositoryName(issue: GitHubIssue): string {
  return issue.repository_url?.split("/repos/")[1] ?? "repository";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseScopes(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function tokenExpiry(expiresIn: number | undefined): Date {
  if (expiresIn && Number.isFinite(expiresIn) && expiresIn > 0) {
    return new Date(Date.now() + expiresIn * 1000);
  }
  return new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000);
}

function signOAuthState(payload: OAuthState): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${hmac(encodedPayload)}`;
}

function createOAuthState(userId: string, callbackScheme: string): string {
  const now = Math.floor(Date.now() / 1000);
  return signOAuthState({
    v: 1,
    userId,
    connectorId: "github",
    callbackScheme: sanitizeCallbackScheme(callbackScheme),
    nonce: randomBytes(16).toString("base64url"),
    iat: now,
    exp: now + 10 * 60
  });
}

function buildGitHubOAuthUrl(state: string): URL {
  const authUrl = new URL(githubAuthorizationEndpoint);
  authUrl.searchParams.set("client_id", config.GITHUB_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", config.GITHUB_REDIRECT_URI!);
  authUrl.searchParams.set("state", state);
  const scopes = githubRequestedScopes();
  if (scopes.length > 0) authUrl.searchParams.set("scope", scopes.join(" "));
  return authUrl;
}

async function storeGitHubIdentityMapping(
  userId: string,
  identity: GitHubUser
): Promise<void> {
  const existing = await pool.query<{
    external_account_id: string;
    metadata: Record<string, unknown> | null;
  }>(
    `
      SELECT external_account_id, metadata
      FROM connector_installations
      WHERE user_id = $1 AND connector_id = 'github'
      LIMIT 1
    `,
    [userId]
  );
  const installation = existing.rows[0];
  const installationId = installation?.metadata?.installation_id;
  await upsertConnectorInstallation({
    userId,
    connectorId: "github",
    externalAccountId:
      installation && installationId !== undefined
        ? installation.external_account_id
        : identity.login,
    externalAccountName: identity.login,
    metadata: {
      ...(installation?.metadata ?? {}),
      github_user_id: identity.id,
      github_login: identity.login
    }
  });
}

async function storeGitHubAppInstallation(
  userId: string,
  installationId: string
): Promise<void> {
  const existing = await pool.query<{
    external_account_name: string | null;
    metadata: Record<string, unknown> | null;
  }>(
    `
      SELECT external_account_name, metadata
      FROM connector_installations
      WHERE user_id = $1 AND connector_id = 'github'
      LIMIT 1
    `,
    [userId]
  );
  const current = existing.rows[0];
  const previousIds = Array.isArray(current?.metadata?.installation_ids)
    ? current.metadata.installation_ids.map(String)
    : current?.metadata?.installation_id === undefined
      ? []
      : [String(current.metadata.installation_id)];
  const installationIds = [...new Set([...previousIds, installationId])];

  await upsertConnectorInstallation({
    userId,
    connectorId: "github",
    externalAccountId: installationId,
    externalAccountName: current?.external_account_name ?? undefined,
    metadata: {
      ...(current?.metadata ?? {}),
      installation_id: installationId,
      installation_ids: installationIds
    }
  });
}

function verifyOAuthState(state: string): OAuthState {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) throw new Error("invalid_state");
  const expected = Buffer.from(hmac(encodedPayload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("invalid_state_signature");
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8")
  ) as OAuthState;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("expired_state");
  }
  if (payload.connectorId !== "github") {
    throw new Error("invalid_state_connector");
  }
  return {
    ...payload,
    callbackScheme: sanitizeCallbackScheme(payload.callbackScheme)
  };
}

function hmac(value: string): string {
  return createHmac("sha256", config.BETTER_AUTH_SECRET)
    .update(value)
    .digest("base64url");
}

function sanitizeCallbackScheme(value: string): string {
  if (!/^[a-z][a-z0-9+.-]*$/i.test(value)) {
    throw new Error("Invalid connector callback scheme.");
  }
  return value;
}

function mobileConnectorRedirect(
  callbackScheme: string,
  params: Record<string, string>
): URL {
  const url = new URL(`${sanitizeCallbackScheme(callbackScheme)}://connectors/github`);
  url.searchParams.set("connector_id", "github");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function ensureGitHubAuthConfigured(): void {
  if (!githubAuthConfigured()) {
    throw new Error("github_oauth_not_configured");
  }
}

function githubAuthRequired(reason: string): ConnectorAuthRequiredError {
  return new ConnectorAuthRequiredError({
    connectorId: "github",
    connectorName: "GitHub",
    reason
  });
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "github_oauth_failed";
}

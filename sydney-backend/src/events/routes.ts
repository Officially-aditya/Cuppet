import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { ingestAgentEvent } from "./engine.js";
import {
  type GooglePushConnector,
  verifiedGoogleSubscription
} from "./google-subscriptions.js";

const slackEnvelopeSchema = z
  .object({
    type: z.string(),
    challenge: z.string().max(1000).optional(),
    event_id: z.string().max(300).optional(),
    team_id: z.string().max(200).optional(),
    event_time: z.number().optional(),
    event: z
      .object({
        type: z.string().max(100),
        subtype: z.string().max(100).optional(),
        text: z.string().max(20_000).optional(),
        channel: z.string().max(200).optional(),
        user: z.string().max(200).optional(),
        bot_id: z.string().max(200).optional(),
        ts: z.string().max(100).optional(),
        event_ts: z.string().max(100).optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

const githubAccountSchema = z
  .object({
    login: z.string().max(1_000).optional()
  })
  .passthrough();

const githubGitActorSchema = z
  .object({
    name: z.string().max(1_000).optional(),
    username: z.string().max(1_000).nullable().optional()
  })
  .passthrough();

const githubPushCommitSchema = z
  .object({
    id: z.string().max(100).optional(),
    message: z.string().max(100_000).optional(),
    timestamp: z.string().max(200).optional(),
    url: z.string().max(5_000).optional(),
    distinct: z.boolean().optional(),
    author: githubGitActorSchema.optional(),
    committer: githubGitActorSchema.optional(),
    added: z.array(z.string().max(5_000)).optional(),
    removed: z.array(z.string().max(5_000)).optional(),
    modified: z.array(z.string().max(5_000)).optional()
  })
  .passthrough();

const githubPullRequestSchema = z
  .object({
    id: z.number().or(z.string()).optional(),
    number: z.number().int().nonnegative().optional(),
    title: z.string().max(20_000).optional(),
    state: z.string().max(100).optional(),
    draft: z.boolean().optional(),
    merged: z.boolean().optional(),
    merge_commit_sha: z.string().max(100).nullable().optional(),
    html_url: z.string().max(5_000).optional(),
    created_at: z.string().max(200).optional(),
    updated_at: z.string().max(200).optional(),
    closed_at: z.string().max(200).nullable().optional(),
    merged_at: z.string().max(200).nullable().optional(),
    user: githubAccountSchema.optional(),
    base: z
      .object({
        ref: z.string().max(1_000).optional(),
        sha: z.string().max(100).optional()
      })
      .passthrough()
      .optional(),
    head: z
      .object({
        ref: z.string().max(1_000).optional(),
        sha: z.string().max(100).optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

const githubIssueSchema = z
  .object({
    id: z.number().or(z.string()).optional(),
    number: z.number().int().nonnegative().optional(),
    title: z.string().max(20_000).optional(),
    state: z.string().max(100).optional(),
    state_reason: z.string().max(200).nullable().optional(),
    html_url: z.string().max(5_000).optional(),
    created_at: z.string().max(200).optional(),
    updated_at: z.string().max(200).optional(),
    closed_at: z.string().max(200).nullable().optional(),
    user: githubAccountSchema.optional(),
    labels: z
      .array(
        z
          .object({ name: z.string().max(1_000).optional() })
          .passthrough()
      )
      .optional()
  })
  .passthrough();

const githubReleaseSchema = z
  .object({
    id: z.number().or(z.string()).optional(),
    tag_name: z.string().max(1_000).optional(),
    target_commitish: z.string().max(1_000).optional(),
    name: z.string().max(20_000).nullable().optional(),
    draft: z.boolean().optional(),
    prerelease: z.boolean().optional(),
    html_url: z.string().max(5_000).optional(),
    created_at: z.string().max(200).optional(),
    published_at: z.string().max(200).nullable().optional(),
    author: githubAccountSchema.optional()
  })
  .passthrough();

const githubWorkflowRunSchema = z
  .object({
    id: z.number().or(z.string()).optional(),
    name: z.string().max(20_000).nullable().optional(),
    event: z.string().max(200).optional(),
    status: z.string().max(200).nullable().optional(),
    conclusion: z.string().max(200).nullable().optional(),
    head_branch: z.string().max(1_000).nullable().optional(),
    head_sha: z.string().max(100).optional(),
    html_url: z.string().max(5_000).optional(),
    run_number: z.number().int().nonnegative().optional(),
    run_attempt: z.number().int().nonnegative().optional(),
    created_at: z.string().max(200).optional(),
    updated_at: z.string().max(200).optional(),
    run_started_at: z.string().max(200).optional(),
    actor: githubAccountSchema.optional()
  })
  .passthrough();

const githubPayloadSchema = z
  .object({
    action: z.string().max(1_000).optional(),
    ref: z.string().max(2_000).optional(),
    base_ref: z.string().max(2_000).nullable().optional(),
    before: z.string().max(100).optional(),
    after: z.string().max(100).optional(),
    compare: z.string().max(5_000).optional(),
    created: z.boolean().optional(),
    deleted: z.boolean().optional(),
    forced: z.boolean().optional(),
    size: z.number().int().nonnegative().optional(),
    distinct_size: z.number().int().nonnegative().optional(),
    pusher: githubGitActorSchema.optional(),
    commits: z.array(githubPushCommitSchema).optional(),
    head_commit: githubPushCommitSchema.nullable().optional(),
    number: z.number().int().nonnegative().optional(),
    pull_request: githubPullRequestSchema.optional(),
    issue: githubIssueSchema.optional(),
    release: githubReleaseSchema.optional(),
    workflow_run: githubWorkflowRunSchema.optional(),
    installation: z
      .object({
        id: z.number().or(z.string()),
        account: githubAccountSchema.optional()
      })
      .passthrough()
      .optional(),
    repository: z
      .object({
        id: z.number().or(z.string()),
        full_name: z.string().max(2_000).optional(),
        html_url: z.string().max(5_000).optional(),
        default_branch: z.string().max(1_000).optional(),
        private: z.boolean().optional()
      })
      .passthrough()
      .optional(),
    sender: githubAccountSchema.optional()
  })
  .passthrough();

export const GITHUB_WEBHOOK_COMMIT_LIMIT = 20;
const githubWebhookFileLimit = 50;
const githubWebhookLabelLimit = 20;

type NormalizedGitHubWebhook = {
  eventName: string;
  externalAccountId: string | null;
  externalAccountAliases?: string[];
  subjectId?: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
};

/**
 * Converts GitHub's broad webhook envelopes into a small, stable event shape.
 * Text remains untrusted and is bounded here before it is persisted or later
 * supplied to an agent renderer.
 */
export function normalizeGitHubWebhookPayload(
  eventName: string,
  input: unknown,
  occurredAt: Date = new Date()
): NormalizedGitHubWebhook | null {
  const normalizedEventName = githubText(eventName, 100);
  if (!normalizedEventName || !/^[a-z][a-z0-9_]*$/.test(normalizedEventName)) {
    return null;
  }

  const parsed = githubPayloadSchema.safeParse(input);
  if (!parsed.success) return null;

  const data = parsed.data;
  const repository = githubText(data.repository?.full_name, 2_000);
  const repositoryId = githubIdentifier(data.repository?.id);
  const installationId = githubIdentifier(data.installation?.id);
  const installationLogin = githubText(data.installation?.account?.login, 300);
  const payload = definedValues({
    action: githubText(data.action, 100),
    repository,
    repository_id: repositoryId,
    repository_url: githubUrl(data.repository?.html_url),
    default_branch: githubText(data.repository?.default_branch, 1_000),
    repository_private: data.repository?.private,
    sender: githubText(data.sender?.login, 300),
    installation_id: installationId
  });

  if (normalizedEventName === "push") {
    const allCommits = data.commits ?? [];
    const commits = allCommits
      .slice(0, GITHUB_WEBHOOK_COMMIT_LIMIT)
      .map((commit) => normalizeGitHubPushCommit(commit, repository))
      .filter((commit): commit is Record<string, unknown> => commit !== null);
    const headCommit = data.head_commit
      ? normalizeGitHubPushCommit(data.head_commit, repository)
      : null;

    Object.assign(
      payload,
      definedValues({
        ref: githubText(data.ref, 2_000),
        base_ref: githubText(data.base_ref, 2_000),
        before: githubSha(data.before),
        after: githubSha(data.after),
        compare: githubUrl(data.compare),
        created: data.created,
        deleted: data.deleted,
        forced: data.forced,
        size: data.size,
        distinct_size: data.distinct_size,
        pusher: normalizeGitHubActor(data.pusher),
        commit_count: allCommits.length,
        commits_truncated: allCommits.length > GITHUB_WEBHOOK_COMMIT_LIMIT,
        commits,
        head_commit: headCommit ?? undefined
      })
    );
  } else if (normalizedEventName === "pull_request" && data.pull_request) {
    payload.pull_request = normalizeGitHubPullRequest(
      data.pull_request,
      data.number
    );
  } else if (normalizedEventName === "issues" && data.issue) {
    payload.issue = normalizeGitHubIssue(data.issue, data.number);
  } else if (normalizedEventName === "release" && data.release) {
    payload.release = normalizeGitHubRelease(data.release);
  } else if (normalizedEventName === "workflow_run" && data.workflow_run) {
    payload.workflow_run = normalizeGitHubWorkflowRun(data.workflow_run);
  }

  const safeOccurredAt = Number.isNaN(occurredAt.getTime())
    ? new Date()
    : new Date(occurredAt);
  return {
    eventName: normalizedEventName,
    externalAccountId: installationId ?? installationLogin ?? null,
    ...(installationLogin
      ? { externalAccountAliases: [installationLogin] }
      : {}),
    ...(repositoryId ? { subjectId: repositoryId } : {}),
    payload,
    occurredAt: safeOccurredAt
  };
}

function normalizeGitHubPushCommit(
  commit: z.infer<typeof githubPushCommitSchema>,
  repository: string | undefined
): Record<string, unknown> | null {
  const sha = githubSha(commit.id);
  if (!sha) return null;

  return definedValues({
    sha,
    message: githubText(commit.message, 4_000, false),
    timestamp: githubTimestamp(commit.timestamp),
    url: githubUrl(commit.url),
    distinct: commit.distinct,
    repository,
    author: normalizeGitHubActor(commit.author),
    committer: normalizeGitHubActor(commit.committer),
    added: githubStringList(commit.added, githubWebhookFileLimit, 2_000),
    removed: githubStringList(commit.removed, githubWebhookFileLimit, 2_000),
    modified: githubStringList(commit.modified, githubWebhookFileLimit, 2_000)
  });
}

function normalizeGitHubPullRequest(
  pullRequest: z.infer<typeof githubPullRequestSchema>,
  envelopeNumber: number | undefined
): Record<string, unknown> {
  return definedValues({
    id: githubIdentifier(pullRequest.id),
    number: pullRequest.number ?? envelopeNumber,
    title: githubText(pullRequest.title, 4_000, false),
    state: githubText(pullRequest.state, 100),
    draft: pullRequest.draft,
    merged: pullRequest.merged,
    merge_commit_sha: githubSha(pullRequest.merge_commit_sha),
    url: githubUrl(pullRequest.html_url),
    created_at: githubTimestamp(pullRequest.created_at),
    updated_at: githubTimestamp(pullRequest.updated_at),
    closed_at: githubTimestamp(pullRequest.closed_at),
    merged_at: githubTimestamp(pullRequest.merged_at),
    author: githubText(pullRequest.user?.login, 300),
    base_ref: githubText(pullRequest.base?.ref, 1_000),
    base_sha: githubSha(pullRequest.base?.sha),
    head_ref: githubText(pullRequest.head?.ref, 1_000),
    head_sha: githubSha(pullRequest.head?.sha)
  });
}

function normalizeGitHubIssue(
  issue: z.infer<typeof githubIssueSchema>,
  envelopeNumber: number | undefined
): Record<string, unknown> {
  const labels = githubStringList(
    issue.labels?.map((label) => label.name).filter((name): name is string => Boolean(name)),
    githubWebhookLabelLimit,
    1_000
  );
  return definedValues({
    id: githubIdentifier(issue.id),
    number: issue.number ?? envelopeNumber,
    title: githubText(issue.title, 4_000, false),
    state: githubText(issue.state, 100),
    state_reason: githubText(issue.state_reason, 200),
    url: githubUrl(issue.html_url),
    created_at: githubTimestamp(issue.created_at),
    updated_at: githubTimestamp(issue.updated_at),
    closed_at: githubTimestamp(issue.closed_at),
    author: githubText(issue.user?.login, 300),
    labels,
    labels_truncated:
      issue.labels === undefined
        ? undefined
        : issue.labels.length > githubWebhookLabelLimit
  });
}

function normalizeGitHubRelease(
  release: z.infer<typeof githubReleaseSchema>
): Record<string, unknown> {
  return definedValues({
    id: githubIdentifier(release.id),
    tag_name: githubText(release.tag_name, 1_000),
    target_commitish: githubText(release.target_commitish, 1_000),
    name: githubText(release.name, 4_000, false),
    draft: release.draft,
    prerelease: release.prerelease,
    url: githubUrl(release.html_url),
    created_at: githubTimestamp(release.created_at),
    published_at: githubTimestamp(release.published_at),
    author: githubText(release.author?.login, 300)
  });
}

function normalizeGitHubWorkflowRun(
  workflowRun: z.infer<typeof githubWorkflowRunSchema>
): Record<string, unknown> {
  return definedValues({
    id: githubIdentifier(workflowRun.id),
    name: githubText(workflowRun.name, 4_000, false),
    event: githubText(workflowRun.event, 200),
    status: githubText(workflowRun.status, 200),
    conclusion: githubText(workflowRun.conclusion, 200),
    head_branch: githubText(workflowRun.head_branch, 1_000),
    head_sha: githubSha(workflowRun.head_sha),
    url: githubUrl(workflowRun.html_url),
    run_number: workflowRun.run_number,
    run_attempt: workflowRun.run_attempt,
    created_at: githubTimestamp(workflowRun.created_at),
    updated_at: githubTimestamp(workflowRun.updated_at),
    run_started_at: githubTimestamp(workflowRun.run_started_at),
    actor: githubText(workflowRun.actor?.login, 300)
  });
}

function normalizeGitHubActor(
  actor: z.infer<typeof githubGitActorSchema> | undefined
): Record<string, unknown> | undefined {
  if (!actor) return undefined;
  const normalized = definedValues({
    name: githubText(actor.name, 300),
    username: githubText(actor.username, 300)
  });
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function githubStringList(
  values: string[] | undefined,
  limit: number,
  itemLength: number
): string[] | undefined {
  if (!values) return undefined;
  return values
    .slice(0, limit)
    .map((value) => githubText(value, itemLength))
    .filter((value): value is string => Boolean(value));
}

function githubIdentifier(value: string | number | undefined): string | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  return githubText(value, 200);
}

function githubSha(value: string | null | undefined): string | undefined {
  const sha = githubText(value, 100);
  return sha && /^[0-9a-f]{7,64}$/i.test(sha) ? sha : undefined;
}

function githubTimestamp(value: string | null | undefined): string | undefined {
  const timestamp = githubText(value, 200);
  return timestamp && Number.isFinite(Date.parse(timestamp)) ? timestamp : undefined;
}

function githubUrl(value: string | undefined): string | undefined {
  const candidate = githubText(value, 5_000);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:"
      ? candidate
      : undefined;
  } catch {
    return undefined;
  }
}

function githubText(
  value: string | null | undefined,
  maxLength: number,
  trim = true
): string | undefined {
  if (typeof value !== "string") return undefined;
  const withoutUnsafeControls = value.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
    ""
  );
  const normalized = trim ? withoutUnsafeControls.trim() : withoutUnsafeControls;
  return normalized.length > 0 ? normalized.slice(0, maxLength) : undefined;
}

function definedValues(
  values: Record<string, unknown | undefined>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter((entry) => entry[1] !== undefined)
  );
}

const gmailPushSchema = z.object({
  message: z.object({
    data: z.string().max(20_000),
    messageId: z.string().max(500),
    publishTime: z.string().datetime().optional()
  }),
  subscription: z.string().max(1000).optional()
});

const gmailDataSchema = z.object({
  emailAddress: z.string().email().max(500),
  historyId: z.string().max(200)
});

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  app.post("/events/slack", { bodyLimit: 256 * 1024 }, async (request, reply) => {
    if (!config.SLACK_SIGNING_SECRET) {
      return reply.code(503).send({ error: "slack_events_not_configured" });
    }
    if (!verifySlackRequest(request, config.SLACK_SIGNING_SECRET)) {
      return reply.code(401).send({ error: "invalid_slack_signature" });
    }

    const parsed = slackEnvelopeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_slack_event" });
    }
    if (parsed.data.type === "url_verification") {
      if (!parsed.data.challenge) {
        return reply.code(400).send({ error: "missing_slack_challenge" });
      }
      return reply.send({ challenge: parsed.data.challenge });
    }
    const event = parsed.data.event;
    if (
      parsed.data.type !== "event_callback" ||
      !parsed.data.event_id ||
      !parsed.data.team_id ||
      !event
    ) {
      return reply.code(202).send({ accepted: true, ignored: true });
    }
    if (event.bot_id || event.subtype === "bot_message") {
      return reply.code(202).send({ accepted: true, ignored: true });
    }

    const result = await ingestAgentEvent({
      source: "slack",
      externalEventId: parsed.data.event_id,
      eventType: `slack.${event.type}`,
      externalAccountId: parsed.data.team_id,
      subjectId: event.channel,
      payload: {
        text: event.text ?? "",
        channel: event.channel,
        user: event.user,
        timestamp: event.ts ?? event.event_ts,
        subtype: event.subtype
      },
      occurredAt: new Date((parsed.data.event_time ?? Date.now() / 1000) * 1000)
    });
    return reply.code(202).send(eventResponse(result));
  });

  app.post("/events/github", { bodyLimit: 1024 * 1024 }, async (request, reply) => {
    if (!config.GITHUB_WEBHOOK_SECRET) {
      return reply.code(503).send({ error: "github_events_not_configured" });
    }
    if (!verifyGitHubRequest(request, config.GITHUB_WEBHOOK_SECRET)) {
      return reply.code(401).send({ error: "invalid_github_signature" });
    }
    const deliveryId = header(request, "x-github-delivery");
    const eventName = header(request, "x-github-event");
    const normalized = eventName
      ? normalizeGitHubWebhookPayload(eventName, request.body)
      : null;
    if (!deliveryId || !normalized) {
      return reply.code(400).send({ error: "invalid_github_event" });
    }
    if (normalized.eventName === "ping") {
      return reply.code(202).send({ accepted: true, ping: true });
    }
    if (!normalized.externalAccountId) {
      return reply.code(202).send({ accepted: true, ignored: true });
    }

    const result = await ingestAgentEvent({
      source: "github",
      externalEventId: deliveryId,
      eventType: `github.${normalized.eventName}`,
      externalAccountId: normalized.externalAccountId,
      externalAccountAliases: normalized.externalAccountAliases,
      subjectId: normalized.subjectId,
      payload: normalized.payload,
      occurredAt: normalized.occurredAt
    });
    return reply.code(202).send(eventResponse(result));
  });

  app.post("/events/gmail", async (request, reply) => {
    const token = (request.query as { token?: string }).token;
    if (
      !config.GMAIL_PUBSUB_VERIFICATION_TOKEN ||
      !token ||
      !safeEqual(token, config.GMAIL_PUBSUB_VERIFICATION_TOKEN)
    ) {
      return reply.code(401).send({ error: "invalid_gmail_push_token" });
    }
    const push = gmailPushSchema.safeParse(request.body);
    if (!push.success) {
      return reply.code(400).send({ error: "invalid_gmail_push" });
    }
    let data: unknown;
    try {
      data = JSON.parse(Buffer.from(push.data.message.data, "base64").toString("utf8"));
    } catch {
      return reply.code(400).send({ error: "invalid_gmail_push_data" });
    }
    const gmail = gmailDataSchema.safeParse(data);
    if (!gmail.success) {
      return reply.code(400).send({ error: "invalid_gmail_notification" });
    }

    const result = await ingestAgentEvent({
      source: "gmail",
      externalEventId: push.data.message.messageId,
      eventType: "gmail.mailbox_changed",
      externalAccountId: gmail.data.emailAddress,
      subjectId: gmail.data.historyId,
      payload: { history_id: gmail.data.historyId },
      occurredAt: push.data.message.publishTime
        ? new Date(push.data.message.publishTime)
        : new Date()
    });
    return reply.code(202).send(eventResponse(result));
  });

  app.post("/events/google/:connectorId", async (request, reply) => {
    const connectorId = (request.params as { connectorId?: string }).connectorId;
    if (connectorId !== "calendar" && connectorId !== "drive") {
      return reply.code(404).send({ error: "unsupported_google_event_source" });
    }
    const channelId = header(request, "x-goog-channel-id");
    const channelToken = header(request, "x-goog-channel-token");
    const messageNumber = header(request, "x-goog-message-number");
    const resourceState = header(request, "x-goog-resource-state");
    if (!channelId || !channelToken || !messageNumber || !resourceState) {
      return reply.code(400).send({ error: "invalid_google_notification" });
    }
    const subscription = await verifiedGoogleSubscription({
      connectorId: connectorId as GooglePushConnector,
      channelId,
      channelToken
    });
    if (!subscription) {
      return reply.code(401).send({ error: "invalid_google_channel" });
    }
    if (resourceState === "sync") {
      return reply.code(204).send();
    }
    const result = await ingestAgentEvent({
      source: connectorId,
      externalEventId: `${channelId}:${messageNumber}`,
      eventType: `${connectorId}.${resourceState}`,
      externalAccountId: subscription.userId,
      subjectId: subscription.resourceId,
      targetUserIds: [subscription.userId],
      payload: {
        resource_state: resourceState,
        changed: header(request, "x-goog-changed"),
        resource_uri: header(request, "x-goog-resource-uri")
      },
      occurredAt: new Date()
    });
    return reply.code(202).send(eventResponse(result));
  });
}

export function verifySlackSignature(input: {
  rawBody: Buffer;
  timestamp: string;
  signature: string;
  signingSecret: string;
  nowSeconds?: number;
}): boolean {
  const timestamp = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > 5 * 60) {
    return false;
  }
  const expected = `v0=${createHmac("sha256", input.signingSecret)
    .update(`v0:${input.timestamp}:`)
    .update(input.rawBody)
    .digest("hex")}`;
  return safeEqual(expected, input.signature);
}

export function verifyGitHubSignature(input: {
  rawBody: Buffer;
  signature: string;
  webhookSecret: string;
}): boolean {
  const expected = `sha256=${createHmac("sha256", input.webhookSecret)
    .update(input.rawBody)
    .digest("hex")}`;
  return safeEqual(expected, input.signature);
}

function verifySlackRequest(request: FastifyRequest, secret: string): boolean {
  const timestamp = header(request, "x-slack-request-timestamp");
  const signature = header(request, "x-slack-signature");
  return Boolean(
    request.rawBody &&
      timestamp &&
      signature &&
      verifySlackSignature({
        rawBody: request.rawBody,
        timestamp,
        signature,
        signingSecret: secret
      })
  );
}

function verifyGitHubRequest(request: FastifyRequest, secret: string): boolean {
  const signature = header(request, "x-hub-signature-256");
  return Boolean(
    request.rawBody &&
      signature &&
      verifyGitHubSignature({
        rawBody: request.rawBody,
        signature,
        webhookSecret: secret
      })
  );
}

function header(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function eventResponse(result: {
  duplicate: boolean;
  queuedAgentIds: string[];
  suppressedAgentIds: string[];
}) {
  return {
    accepted: true,
    duplicate: result.duplicate,
    queued: result.queuedAgentIds.length,
    suppressed: result.suppressedAgentIds.length
  };
}

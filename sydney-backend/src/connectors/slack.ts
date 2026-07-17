import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  digestSection,
  renderedDataSummary,
  type RenderedAgentMessage
} from "../agents/output.js";
import {
  connectorRecipeContext,
  synthesizeConnectorDigest
} from "../agents/connector-summarizer.js";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import { ConnectorAuthRequiredError } from "./errors.js";
import { upsertConnectorInstallation } from "../events/engine.js";
import {
  decryptConnectorSecret,
  encryptConnectorSecret
} from "./token-vault.js";

const slackAuthorizationEndpoint = "https://slack.com/oauth/v2/authorize";
const slackTokenEndpoint = "https://slack.com/api/oauth.v2.access";
const slackApiBase = "https://slack.com/api";
const slackRequestTimeoutMs = 15_000;
const slackIntents = new Set([
  "slack_digest",
  "slack_urgent_watcher",
  "eod_task_report",
  "weekly_progress_report"
]);
const urgentPattern = /\b(urgent|asap|blocker|blocked|critical|incident|outage|deadline)\b/i;

type SlackTokenResponse = {
  ok?: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  team?: { id?: string; name?: string };
};

type SlackTokenRow = {
  access_token_enc: string;
  refresh_token_enc: string;
  token_expires_at: Date | string;
};

type SlackApiResponse = {
  ok?: boolean;
  error?: string;
  response_metadata?: { next_cursor?: string };
};

export type SlackChannel = {
  id: string;
  name?: string;
  is_member?: boolean;
  is_archived?: boolean;
};

export type SlackMessage = {
  type?: string;
  subtype?: string;
  user?: string;
  bot_id?: string;
  username?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  reply_count?: number;
};

type SlackUser = {
  id: string;
  name?: string;
  real_name?: string;
  deleted?: boolean;
  profile?: { display_name?: string; real_name?: string };
};

export type SlackActivityItem = {
  channelId: string;
  channelName: string;
  message: SlackMessage;
  authorName: string;
};

type SlackAgent = {
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

type SlackRenderOptions = {
  scheduledIntro: (agent: SlackAgent, label: string) => string;
  scheduledTitle: (agent: SlackAgent, label: string) => string;
};

type OAuthState = {
  v: 1;
  userId: string;
  connectorId: "slack";
  callbackScheme: string;
  nonce: string;
  iat: number;
  exp: number;
};

export function slackAuthConfigured(): boolean {
  return Boolean(
    config.SLACK_CLIENT_ID &&
      config.SLACK_CLIENT_SECRET &&
      config.SLACK_REDIRECT_URI
  );
}

export function slackRequestedScopes(): string[] {
  return config.SLACK_OAUTH_SCOPES.split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function slackScopesCoverReadAccess(scopes: string[]): boolean {
  const granted = new Set(scopes);
  return (
    granted.has("users:read") &&
    granted.has("channels:read") &&
    granted.has("channels:history")
  );
}

export async function createSlackAuthUrl(input: {
  userId: string;
  callbackScheme: string;
}): Promise<{ authUrl: string; callbackScheme: string }> {
  ensureSlackAuthConfigured();
  const callbackScheme = sanitizeCallbackScheme(input.callbackScheme);
  const now = Math.floor(Date.now() / 1000);
  const state = signOAuthState({
    v: 1,
    userId: input.userId,
    connectorId: "slack",
    callbackScheme,
    nonce: randomBytes(16).toString("base64url"),
    iat: now,
    exp: now + 10 * 60
  });

  const authUrl = new URL(slackAuthorizationEndpoint);
  authUrl.searchParams.set("client_id", config.SLACK_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", config.SLACK_REDIRECT_URI!);
  authUrl.searchParams.set("scope", slackRequestedScopes().join(","));
  authUrl.searchParams.set("state", state);
  return { authUrl: authUrl.toString(), callbackScheme };
}

export async function handleSlackOAuthCallback(input: {
  code?: string;
  state?: string;
  error?: string;
}): Promise<URL> {
  if (!input.state) {
    return mobileConnectorRedirect(config.MOBILE_AUTH_CALLBACK_SCHEME, {
      error: input.error ?? "missing_state"
    });
  }

  const state = verifyOAuthState(input.state);
  if (input.error) {
    return mobileConnectorRedirect(state.callbackScheme, { error: input.error });
  }
  if (!input.code) {
    return mobileConnectorRedirect(state.callbackScheme, { error: "missing_code" });
  }

  try {
    const token = await exchangeAuthorizationCode(input.code);
    if (!slackScopesCoverReadAccess(parseScopes(token.scope))) {
      throw new Error("slack_required_scopes_not_granted");
    }
    await validateSlackIdentity(token.access_token!);
    await storeSlackToken(state.userId, token);
    if (token.team?.id) {
      await upsertConnectorInstallation({
        userId: state.userId,
        connectorId: "slack",
        externalAccountId: token.team.id,
        externalAccountName: token.team.name,
        metadata: { team_id: token.team.id }
      });
    }
    return mobileConnectorRedirect(state.callbackScheme, { status: "connected" });
  } catch (error) {
    return mobileConnectorRedirect(state.callbackScheme, {
      error: errorCode(error)
    });
  }
}

export function parseSlackCallbackUrl(
  callbackUrl: string
): { connectorId: "slack"; error?: string } {
  const url = new URL(callbackUrl);
  const allowedSchemes = new Set([
    "sydney:",
    `${config.MOBILE_AUTH_CALLBACK_SCHEME}:`
  ]);
  if (!allowedSchemes.has(url.protocol)) {
    throw new Error("Invalid connector callback scheme.");
  }
  if (url.hostname !== "connectors" || url.pathname !== "/slack") {
    throw new Error("Invalid Slack connector callback URL.");
  }
  if (url.searchParams.get("connector_id") !== "slack") {
    throw new Error("Invalid Slack connector.");
  }
  return {
    connectorId: "slack",
    error: url.searchParams.get("error") ?? undefined
  };
}

export async function hasUsableSlackToken(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM connector_tokens
        WHERE user_id = $1
          AND connector_id = 'slack'
          AND status = 'connected'
      ) AS exists
    `,
    [userId]
  );
  return rows[0]?.exists === true;
}

export async function renderSlackAgent(
  agent: SlackAgent,
  options: SlackRenderOptions
): Promise<RenderedAgentMessage | null> {
  const intent = String(agent.parsed_intent.intent ?? "");
  if (!slackIntents.has(intent)) return null;

  const accessToken = await slackAccessToken(agent.user_id);
  if (!accessToken) return null;

  const sinceHours = intent === "weekly_progress_report" ? 7 * 24 : 24;
  const activity = await fetchSlackActivity(accessToken, {
    userId: agent.user_id,
    oldest: Math.floor((Date.now() - sinceHours * 60 * 60 * 1000) / 1000)
  });
  const selected =
    intent === "slack_urgent_watcher"
      ? activity.filter((item) => urgentPattern.test(item.message.text ?? ""))
      : activity;
  const records = selected.map(activityRecord);
  const synthesized = await synthesizeConnectorDigest({
    connectorName: "Slack",
    agentName: agent.name,
    userPrompt: agent.prompt,
    records,
    maxItems: 20,
    ...connectorRecipeContext(agent.parsed_intent)
  });
  const channels = new Set(selected.map((item) => item.channelId));
  const urgentCount = activity.filter((item) =>
    urgentPattern.test(item.message.text ?? "")
  ).length;
  const label = slackDigestLabel(intent);
  const fallback = digestSection(
    intent === "slack_urgent_watcher" ? "Urgent Slack activity" : "Recent Slack activity",
    selected.slice(0, 15).map(activityLine)
  );

  return renderedDataSummary(
    {
      title: options.scheduledTitle(agent, label),
      text: options.scheduledIntro(agent, label),
      summary:
        synthesized?.summary ||
        fallback ||
        (intent === "slack_urgent_watcher"
          ? "No urgent Slack messages were found in the channels Cuppet can access."
          : "No recent Slack messages were found in the channels Cuppet can access."),
      metrics: [
        { label: "Messages", value: String(selected.length) },
        { label: "Channels", value: String(channels.size) },
        { label: "Urgent", value: String(urgentCount) }
      ],
      footer: "Read-only digest from Slack channels where the Cuppet app is a member."
    },
    {
      sourceRefs: selected.slice(0, 20).map((item) => ({
        type: "slack_message",
        source: "Slack",
        id: item.message.ts ?? `${item.channelId}-message`,
        channel_id: item.channelId,
        channel_name: item.channelName,
        author: item.authorName
      })),
      tokensUsed: synthesized?.tokensUsed ?? 0
    }
  );
}

export async function fetchSlackActivity(
  accessToken: string,
  input: { oldest: number; userId?: string; maxChannels?: number }
): Promise<SlackActivityItem[]> {
  const [channels, users] = await Promise.all([
    fetchSlackChannels(accessToken, input.userId),
    fetchSlackUsers(accessToken, input.userId)
  ]);
  const userNames = new Map(
    users.map((user) => [
      user.id,
      user.profile?.display_name ||
        user.profile?.real_name ||
        user.real_name ||
        user.name ||
        user.id
    ])
  );
  const readableChannels = channels
    .filter((channel) => channel.is_member !== false && !channel.is_archived)
    .slice(0, input.maxChannels ?? 8);
  const items: SlackActivityItem[] = [];

  for (const channel of readableChannels) {
    try {
      const messages = await fetchSlackChannelHistory(
        accessToken,
        channel.id,
        input.oldest,
        input.userId
      );
      for (const message of messages) {
        const text = message.text?.trim();
        if (!text || message.subtype === "message_deleted") continue;
        items.push({
          channelId: channel.id,
          channelName: channel.name ?? channel.id,
          message,
          authorName:
            (message.user && userNames.get(message.user)) ||
            message.username ||
            (message.bot_id ? "Slack app" : "Unknown member")
        });
      }
    } catch (error) {
      if (error instanceof ConnectorAuthRequiredError) throw error;
      if (!isSkippableChannelError(error)) throw error;
      // A channel can become inaccessible between listing and history lookup.
    }
  }

  return items.sort(
    (a, b) => Number(b.message.ts ?? 0) - Number(a.message.ts ?? 0)
  );
}

export async function readSlackForAssistant(
  userId: string,
  input: { oldest?: number; channel?: string; limit?: number }
): Promise<{ summary: string; sourceRefs: unknown[] }> {
  const accessToken = await slackAccessToken(userId);
  if (!accessToken) throw slackAuthRequired("slack_not_connected");
  const channel = input.channel?.replace(/^#/, "").toLowerCase();
  const activity = (await fetchSlackActivity(accessToken, {
    userId,
    oldest: input.oldest ?? Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
  }))
    .filter((item) => !channel || item.channelName.toLowerCase().includes(channel))
    .slice(0, Math.min(input.limit ?? 12, 20));
  return {
    summary: activity.length === 0
      ? "No matching recent Slack activity was found."
      : activity.map((item) =>
          `- #${item.channelName} · ${item.authorName}: ${(item.message.text ?? "").slice(0, 360)}`
        ).join("\n"),
    sourceRefs: activity.map((item) => ({
      type: "slack_message",
      source: "Slack",
      id: item.message.ts ?? `${item.channelId}-message`,
      channel_id: item.channelId,
      channel_name: item.channelName,
      author: item.authorName
    }))
  };
}

async function fetchSlackChannels(
  accessToken: string,
  userId?: string
): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];
  let cursor = "";
  for (let page = 0; page < 3; page += 1) {
    const url = new URL(`${slackApiBase}/conversations.list`);
    url.searchParams.set("types", "public_channel,private_channel");
    url.searchParams.set("exclude_archived", "true");
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);
    const body = await slackJson<SlackApiResponse & { channels?: SlackChannel[] }>(
      url,
      accessToken,
      userId
    );
    channels.push(...(body.channels ?? []));
    cursor = body.response_metadata?.next_cursor?.trim() ?? "";
    if (!cursor) break;
  }
  return channels;
}

async function fetchSlackUsers(
  accessToken: string,
  userId?: string
): Promise<SlackUser[]> {
  const url = new URL(`${slackApiBase}/users.list`);
  url.searchParams.set("limit", "200");
  const body = await slackJson<SlackApiResponse & { members?: SlackUser[] }>(
    url,
    accessToken,
    userId
  );
  return (body.members ?? []).filter((user) => !user.deleted);
}

async function fetchSlackChannelHistory(
  accessToken: string,
  channelId: string,
  oldest: number,
  userId?: string
): Promise<SlackMessage[]> {
  const url = new URL(`${slackApiBase}/conversations.history`);
  url.searchParams.set("channel", channelId);
  url.searchParams.set("oldest", String(oldest));
  url.searchParams.set("limit", "15");
  const body = await slackJson<SlackApiResponse & { messages?: SlackMessage[] }>(
    url,
    accessToken,
    userId
  );
  return body.messages ?? [];
}

async function exchangeAuthorizationCode(code: string): Promise<SlackTokenResponse> {
  ensureSlackAuthConfigured();
  return slackTokenRequest({
    client_id: config.SLACK_CLIENT_ID!,
    client_secret: config.SLACK_CLIENT_SECRET!,
    code,
    redirect_uri: config.SLACK_REDIRECT_URI!
  });
}

async function refreshSlackToken(
  userId: string,
  refreshToken: string
): Promise<string> {
  ensureSlackAuthConfigured();
  let token: SlackTokenResponse;
  try {
    token = await slackTokenRequest({
      client_id: config.SLACK_CLIENT_ID!,
      client_secret: config.SLACK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    });
  } catch (error) {
    await markSlackActionRequired(userId);
    throw slackAuthRequired(errorCode(error));
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
      WHERE user_id = $1 AND connector_id = 'slack'
    `,
    [
      userId,
      encryptConnectorSecret(token.access_token!),
      encryptConnectorSecret(token.refresh_token ?? refreshToken),
      tokenExpiry(token.expires_in),
      parseScopes(token.scope)
    ]
  );
  return token.access_token!;
}

async function slackTokenRequest(params: Record<string, string>): Promise<SlackTokenResponse> {
  const response = await fetch(slackTokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(slackRequestTimeoutMs)
  });
  const body = (await response.json()) as SlackTokenResponse;
  if (!response.ok || body.ok !== true || !body.access_token) {
    throw new Error(body.error ?? `slack_token_exchange_failed_${response.status}`);
  }
  return body;
}

async function validateSlackIdentity(accessToken: string): Promise<void> {
  await slackJson(new URL(`${slackApiBase}/auth.test`), accessToken);
}

async function storeSlackToken(
  userId: string,
  token: SlackTokenResponse
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
        VALUES ($1, 'slack', $2, $3, $4, $5, 'connected')
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
        VALUES ($1, 'slack', 'connected')
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

async function slackAccessToken(userId: string): Promise<string | null> {
  const { rows } = await pool.query<SlackTokenRow>(
    `
      SELECT access_token_enc, refresh_token_enc, token_expires_at
      FROM connector_tokens
      WHERE user_id = $1
        AND connector_id = 'slack'
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
    await markSlackActionRequired(userId);
    throw slackAuthRequired("connector_token_decryption_failed");
  }

  const expiresAt = new Date(token.token_expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt > Date.now() + 60_000) {
    return accessToken;
  }
  if (refreshToken === accessToken) {
    await markSlackActionRequired(userId);
    throw slackAuthRequired("slack_token_expired");
  }
  return refreshSlackToken(userId, refreshToken);
}

async function slackJson<T>(
  url: URL,
  accessToken: string,
  userId?: string
): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(slackRequestTimeoutMs)
  });
  const body = (await response.json()) as T & SlackApiResponse;
  if (
    response.status === 401 ||
    ["invalid_auth", "account_inactive", "token_revoked", "token_expired"].includes(
      body.error ?? ""
    )
  ) {
    if (userId) await markSlackActionRequired(userId);
    throw slackAuthRequired(body.error ?? "slack_api_auth_failed");
  }
  if (response.status === 429) {
    throw new Error(
      `slack_rate_limited_retry_after_${response.headers.get("retry-after") ?? "unknown"}`
    );
  }
  if (!response.ok || body.ok !== true) {
    throw new Error(body.error ?? `slack_api_failed_${response.status}`);
  }
  return body;
}

async function markSlackActionRequired(userId: string): Promise<void> {
  await Promise.all([
    pool.query(
      `UPDATE connector_tokens SET status = 'action_required', updated_at = NOW()
       WHERE user_id = $1 AND connector_id = 'slack'`,
      [userId]
    ),
    pool.query(
      `INSERT INTO connector_statuses (user_id, connector_id, status)
       VALUES ($1, 'slack', 'action_required')
       ON CONFLICT (user_id, connector_id)
       DO UPDATE SET status = 'action_required', updated_at = NOW()`,
      [userId]
    )
  ]);
}

function activityRecord(item: SlackActivityItem): string {
  return [
    `Channel: #${item.channelName}`,
    `Author: ${item.authorName}`,
    `Message: ${truncate(item.message.text ?? "", 1000)}`,
    item.message.reply_count ? `Replies: ${item.message.reply_count}` : null,
    item.message.ts ? `Timestamp: ${item.message.ts}` : null
  ]
    .filter(Boolean)
    .join(" | ");
}

function activityLine(item: SlackActivityItem): string {
  return `#${item.channelName} — ${item.authorName}: ${truncate(item.message.text ?? "", 220)}`;
}

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function isSkippableChannelError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ["not_in_channel", "channel_not_found", "is_archived"].includes(error.message)
  );
}

function slackDigestLabel(intent: string): string {
  if (intent === "slack_urgent_watcher") return "urgent Slack activity";
  if (intent === "eod_task_report") return "Slack EOD report";
  if (intent === "weekly_progress_report") return "weekly Slack progress";
  return "Slack digest";
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
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${hmac(encoded)}`;
}

function verifyOAuthState(state: string): OAuthState {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) throw new Error("invalid_state");
  const expected = Buffer.from(hmac(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("invalid_state_signature");
  }
  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8")
  ) as OAuthState;
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("expired_state");
  if (payload.connectorId !== "slack") throw new Error("invalid_state_connector");
  return { ...payload, callbackScheme: sanitizeCallbackScheme(payload.callbackScheme) };
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
  const url = new URL(`${sanitizeCallbackScheme(callbackScheme)}://connectors/slack`);
  url.searchParams.set("connector_id", "slack");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

function ensureSlackAuthConfigured(): void {
  if (!slackAuthConfigured()) throw new Error("slack_oauth_not_configured");
}

function slackAuthRequired(reason: string): ConnectorAuthRequiredError {
  return new ConnectorAuthRequiredError({
    connectorId: "slack",
    connectorName: "Slack",
    reason
  });
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "slack_oauth_failed";
}

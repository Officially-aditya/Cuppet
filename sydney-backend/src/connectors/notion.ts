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
import { upsertConnectorInstallation } from "../events/engine.js";
import { ConnectorAuthRequiredError } from "./errors.js";
import {
  decryptConnectorSecret,
  encryptConnectorSecret
} from "./token-vault.js";

const notionApiBase = "https://api.notion.com/v1";
const notionTokenEndpoint = `${notionApiBase}/oauth/token`;

type OAuthState = {
  v: 1;
  userId: string;
  connectorId: "notion";
  callbackScheme: string;
  nonce: string;
  iat: number;
  exp: number;
};

type NotionTokenResponse = {
  access_token?: string;
  refresh_token?: string | null;
  expires_in?: number;
  bot_id?: string;
  workspace_id?: string;
  workspace_name?: string | null;
  workspace_icon?: string | null;
  owner?: Record<string, unknown>;
  error?: string;
  error_description?: string;
  message?: string;
};

type NotionTokenRow = {
  access_token_enc: string;
  refresh_token_enc: string;
  token_expires_at: Date | string;
};

type NotionPage = {
  object: "page";
  id: string;
  url?: string;
  created_time?: string;
  last_edited_time?: string;
  archived?: boolean;
  in_trash?: boolean;
  properties?: Record<
    string,
    {
      type?: string;
      title?: Array<{ plain_text?: string; text?: { content?: string } }>;
    }
  >;
};

type NotionSearchResponse = {
  results?: NotionPage[];
  has_more?: boolean;
  next_cursor?: string | null;
  message?: string;
  code?: string;
};

type NotionMarkdownResponse = {
  markdown?: string;
  truncated?: boolean;
  message?: string;
  code?: string;
};

type NotionAgent = {
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

type NotionRenderOptions = {
  scheduledIntro: (agent: NotionAgent, label: string) => string;
  scheduledTitle: (agent: NotionAgent, label: string) => string;
};

export function notionAuthConfigured(): boolean {
  return Boolean(
    config.NOTION_CLIENT_ID &&
      config.NOTION_CLIENT_SECRET &&
      config.NOTION_AUTHORIZATION_URL &&
      notionRedirectUri()
  );
}

export async function createNotionAuthUrl(input: {
  userId: string;
  callbackScheme: string;
}): Promise<{ authUrl: string; callbackScheme: string }> {
  ensureNotionAuthConfigured();
  const callbackScheme = sanitizeCallbackScheme(input.callbackScheme);
  const now = Math.floor(Date.now() / 1000);
  const state = signOAuthState({
    v: 1,
    userId: input.userId,
    connectorId: "notion",
    callbackScheme,
    nonce: randomBytes(16).toString("base64url"),
    iat: now,
    exp: now + 10 * 60
  });
  const authUrl = new URL(config.NOTION_AUTHORIZATION_URL!);
  authUrl.searchParams.set("client_id", config.NOTION_CLIENT_ID!);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("owner", "user");
  authUrl.searchParams.set("state", state);
  return { authUrl: authUrl.toString(), callbackScheme };
}

export async function handleNotionOAuthCallback(input: {
  code?: string;
  state?: string;
  error?: string;
}): Promise<URL> {
  if (!input.state) {
    return mobileConnectorRedirect("sydney", {
      error: input.error ?? "missing_state"
    });
  }
  const state = verifyOAuthState(input.state);
  if (input.error) {
    return mobileConnectorRedirect(state.callbackScheme, { error: input.error });
  }
  if (!input.code) {
    return mobileConnectorRedirect(state.callbackScheme, {
      error: "missing_code"
    });
  }

  try {
    const token = await exchangeAuthorizationCode(input.code);
    await storeNotionToken(state.userId, token);
    if (token.workspace_id) {
      await upsertConnectorInstallation({
        userId: state.userId,
        connectorId: "notion",
        externalAccountId: token.workspace_id,
        externalAccountName: token.workspace_name ?? undefined,
        metadata: { bot_id: token.bot_id, workspace_icon: token.workspace_icon }
      });
    }
    return mobileConnectorRedirect(state.callbackScheme, {
      status: "connected"
    });
  } catch (error) {
    return mobileConnectorRedirect(state.callbackScheme, {
      error: errorCode(error)
    });
  }
}

export function parseNotionCallbackUrl(
  callbackUrl: string
): { connectorId: "notion"; error?: string } {
  const url = new URL(callbackUrl);
  const allowedSchemes = new Set([
    "sydney:",
    `${config.MOBILE_AUTH_CALLBACK_SCHEME}:`
  ]);
  if (!allowedSchemes.has(url.protocol)) {
    throw new Error("Invalid connector callback scheme.");
  }
  if (url.hostname !== "connectors" || url.pathname !== "/notion") {
    throw new Error("Invalid Notion connector callback URL.");
  }
  if (url.searchParams.get("connector_id") !== "notion") {
    throw new Error("Invalid Notion connector.");
  }
  return {
    connectorId: "notion",
    error: url.searchParams.get("error") ?? undefined
  };
}

export async function hasUsableNotionToken(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM connector_tokens
       WHERE user_id = $1 AND connector_id = 'notion' AND status = 'connected'
     ) AS exists`,
    [userId]
  );
  return rows[0]?.exists === true;
}

export async function renderNotionAgent(
  agent: NotionAgent,
  options: NotionRenderOptions
): Promise<RenderedAgentMessage | null> {
  if (String(agent.parsed_intent.intent ?? "") !== "notion_workspace_digest") {
    return null;
  }
  const accessToken = await notionAccessToken(agent.user_id);
  if (!accessToken) return null;

  const search = await notionJson<NotionSearchResponse>(
    `${notionApiBase}/search`,
    accessToken,
    agent.user_id,
    {
      method: "POST",
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 10
      })
    }
  );
  const pages = (search.results ?? []).filter(
    (page) => !page.archived && !page.in_trash
  );
  const pageDetails = await Promise.all(
    pages.slice(0, 5).map(async (page) => ({
      page,
      markdown: await fetchPageMarkdown(page, accessToken, agent.user_id)
    }))
  );
  const records = pageDetails.map(({ page, markdown }) =>
    [
      `Page: ${notionPageTitle(page)}`,
      page.last_edited_time ? `Last edited: ${page.last_edited_time}` : null,
      markdown ? `Content: ${markdown.slice(0, 4_000)}` : null
    ]
      .filter(Boolean)
      .join(" | ")
  );
  const synthesized = await synthesizeConnectorDigest({
    connectorName: "Notion",
    agentName: agent.name,
    userPrompt: agent.prompt,
    records,
    ...connectorRecipeContext(agent.parsed_intent)
  });
  const recentlyEdited = pages.filter((page) => {
    const edited = new Date(page.last_edited_time ?? "").getTime();
    return Number.isFinite(edited) && edited > Date.now() - 7 * 86_400_000;
  }).length;
  const fallbackSummary = digestSection(
    "Recently edited Notion pages",
    pages.map(
      (page) =>
        `${notionPageTitle(page)}${
          page.last_edited_time ? ` — edited ${formatDate(page.last_edited_time)}` : ""
        }`
    )
  );

  if (pages.length === 0) {
    return renderedAllClear(
      resolveOutcomeCopy("notion_digest", "no_relevant_items"),
      {
        sourceRefs: [],
        details: {
          source: "Notion",
          itemsChecked: 0,
          readOnly: true
        }
      }
    );
  }

  return renderedDataSummary(
    {
      title: options.scheduledTitle(agent, "Notion workspace"),
      text: options.scheduledIntro(agent, "Notion workspace"),
      summary:
        synthesized?.summary ||
        fallbackSummary ||
        resolveOutcomeCopy("notion_digest", "no_relevant_items"),
      metrics: [
        { label: "Shared pages", value: String(pages.length) },
        { label: "Edited this week", value: String(recentlyEdited) },
        {
          label: "Content loaded",
          value: String(pageDetails.filter((item) => item.markdown).length)
        }
      ],
      footer: "Read-only digest generated from pages shared with the Cuppet Notion connection."
    },
    {
      sourceRefs: pages.map((page) => ({
        type: "notion_page",
        source: "Notion",
        id: page.id,
        name: notionPageTitle(page),
        url: page.url
      })),
      tokensUsed: synthesized?.tokensUsed ?? 0
    }
  );
}

async function fetchPageMarkdown(
  page: NotionPage,
  accessToken: string,
  userId: string
): Promise<string> {
  try {
    const result = await notionJson<NotionMarkdownResponse>(
      `${notionApiBase}/pages/${page.id}/markdown`,
      accessToken,
      userId
    );
    return result.markdown?.trim() ?? "";
  } catch (error) {
    if (error instanceof ConnectorAuthRequiredError) throw error;
    return "";
  }
}

export async function readNotionForAssistant(
  userId: string,
  input: { query?: string; limit?: number }
): Promise<{ summary: string; sourceRefs: unknown[] }> {
  const accessToken = await notionAccessToken(userId);
  if (!accessToken) throw notionAuthRequired("notion_not_connected");
  const body: Record<string, unknown> = {
    filter: { property: "object", value: "page" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
    page_size: Math.min(input.limit ?? 8, 10)
  };
  if (input.query?.trim()) body.query = input.query.trim().slice(0, 200);
  const search = await notionJson<NotionSearchResponse>(
    `${notionApiBase}/search`,
    accessToken,
    userId,
    { method: "POST", body: JSON.stringify(body) }
  );
  const pages = (search.results ?? []).filter(
    (page) => !page.archived && !page.in_trash
  );
  const excerpts = await Promise.all(
    pages.slice(0, 5).map((page) => fetchPageMarkdown(page, accessToken, userId))
  );
  return {
    summary: pages.length === 0
      ? resolveOutcomeCopy("notion_digest", "no_relevant_items")
      : pages.map((page, index) =>
          `- ${notionPageTitle(page)}${excerpts[index] ? `: ${excerpts[index]!.replace(/\s+/g, " ").slice(0, 1200)}` : ""}`
        ).join("\n"),
    sourceRefs: pages.map((page) => ({
      type: "notion_page",
      source: "Notion",
      id: page.id,
      name: notionPageTitle(page),
      url: page.url
    }))
  };
}

async function exchangeAuthorizationCode(
  code: string
): Promise<NotionTokenResponse> {
  return notionTokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: notionRedirectUri()!
  });
}

async function refreshNotionToken(
  userId: string,
  refreshToken: string
): Promise<string> {
  let token: NotionTokenResponse;
  try {
    token = await notionTokenRequest({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    });
  } catch (error) {
    await markNotionActionRequired(userId);
    throw notionAuthRequired(errorCode(error));
  }
  if (!token.access_token) {
    await markNotionActionRequired(userId);
    throw notionAuthRequired("notion_token_refresh_failed");
  }
  await pool.query(
    `UPDATE connector_tokens
     SET access_token_enc = $2, refresh_token_enc = $3,
         token_expires_at = $4, status = 'connected', updated_at = NOW()
     WHERE user_id = $1 AND connector_id = 'notion'`,
    [
      userId,
      encryptConnectorSecret(token.access_token),
      encryptConnectorSecret(token.refresh_token ?? refreshToken),
      tokenExpiry(token.expires_in)
    ]
  );
  return token.access_token;
}

async function notionTokenRequest(
  body: Record<string, string>
): Promise<NotionTokenResponse> {
  ensureNotionAuthConfigured();
  const credentials = Buffer.from(
    `${config.NOTION_CLIENT_ID}:${config.NOTION_CLIENT_SECRET}`
  ).toString("base64");
  const response = await fetch(notionTokenEndpoint, {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
      "Notion-Version": config.NOTION_API_VERSION
    },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as NotionTokenResponse;
  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(
      payload.error_description ??
        payload.message ??
        payload.error ??
        `notion_token_exchange_failed_${response.status}`
    );
  }
  return payload;
}

async function storeNotionToken(
  userId: string,
  token: NotionTokenResponse
): Promise<void> {
  if (!token.access_token) throw new Error("missing_access_token");
  const refreshToken = token.refresh_token ?? token.access_token;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO connector_tokens
         (user_id, connector_id, access_token_enc, refresh_token_enc,
          token_expires_at, scopes, status)
       VALUES ($1, 'notion', $2, $3, $4, ARRAY['read_content'], 'connected')
       ON CONFLICT (user_id, connector_id)
       DO UPDATE SET access_token_enc = EXCLUDED.access_token_enc,
         refresh_token_enc = EXCLUDED.refresh_token_enc,
         token_expires_at = EXCLUDED.token_expires_at,
         scopes = EXCLUDED.scopes, status = 'connected', updated_at = NOW()`,
      [
        userId,
        encryptConnectorSecret(token.access_token),
        encryptConnectorSecret(refreshToken),
        tokenExpiry(token.expires_in)
      ]
    );
    await client.query(
      `INSERT INTO connector_statuses (user_id, connector_id, status)
       VALUES ($1, 'notion', 'connected')
       ON CONFLICT (user_id, connector_id)
       DO UPDATE SET status = 'connected', updated_at = NOW()`,
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

async function notionAccessToken(userId: string): Promise<string | null> {
  const { rows } = await pool.query<NotionTokenRow>(
    `SELECT access_token_enc, refresh_token_enc, token_expires_at
     FROM connector_tokens
     WHERE user_id = $1 AND connector_id = 'notion' AND status = 'connected'`,
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
    await markNotionActionRequired(userId);
    throw notionAuthRequired("connector_token_decryption_failed");
  }
  const expiresAt = new Date(token.token_expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now() + 60_000) {
    if (refreshToken === accessToken) {
      await markNotionActionRequired(userId);
      throw notionAuthRequired("notion_token_expired");
    }
    return refreshNotionToken(userId, refreshToken);
  }
  return accessToken;
}

async function notionJson<T>(
  url: string,
  accessToken: string,
  userId: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": config.NOTION_API_VERSION,
      "Content-Type": "application/json",
      ...init.headers
    }
  });
  const body = (await response.json()) as T & { message?: string; code?: string };
  if (response.status === 401) {
    await markNotionActionRequired(userId);
    throw notionAuthRequired(body.message ?? body.code ?? "notion_api_auth_failed");
  }
  if (!response.ok) {
    throw new Error(body.message ?? body.code ?? `notion_api_failed_${response.status}`);
  }
  return body;
}

async function markNotionActionRequired(userId: string): Promise<void> {
  await Promise.all([
    pool.query(
      `UPDATE connector_tokens SET status = 'action_required', updated_at = NOW()
       WHERE user_id = $1 AND connector_id = 'notion'`,
      [userId]
    ),
    pool.query(
      `INSERT INTO connector_statuses (user_id, connector_id, status)
       VALUES ($1, 'notion', 'action_required')
       ON CONFLICT (user_id, connector_id)
       DO UPDATE SET status = 'action_required', updated_at = NOW()`,
      [userId]
    )
  ]);
}

function notionPageTitle(page: NotionPage): string {
  for (const property of Object.values(page.properties ?? {})) {
    if (property.type !== "title" || !property.title) continue;
    const title = property.title
      .map((item) => item.plain_text ?? item.text?.content ?? "")
      .join("")
      .trim();
    if (title) return title;
  }
  return "Untitled page";
}

function notionRedirectUri(): string | null {
  if (!config.NOTION_AUTHORIZATION_URL) return null;
  try {
    return new URL(config.NOTION_AUTHORIZATION_URL).searchParams.get(
      "redirect_uri"
    );
  } catch {
    return null;
  }
}

function tokenExpiry(expiresIn: number | undefined): Date {
  const seconds = expiresIn && expiresIn > 0 ? expiresIn : 60 * 60;
  return new Date(Date.now() + seconds * 1000);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("expired_state");
  }
  if (payload.connectorId !== "notion") {
    throw new Error("invalid_state_connector");
  }
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
  const url = new URL(`${sanitizeCallbackScheme(callbackScheme)}://connectors/notion`);
  url.searchParams.set("connector_id", "notion");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function ensureNotionAuthConfigured(): void {
  if (!notionAuthConfigured()) throw new Error("notion_oauth_not_configured");
}

function notionAuthRequired(reason: string): ConnectorAuthRequiredError {
  return new ConnectorAuthRequiredError({
    connectorId: "notion",
    connectorName: "Notion",
    reason
  });
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "notion_oauth_failed";
}

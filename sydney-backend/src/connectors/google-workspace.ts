import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import {
  renderedChecklist,
  renderedDataSummary,
  renderedPlainText,
  renderedUrgencyList,
  type RenderedAgentMessage
} from "../agents/output.js";
import { ConnectorAuthRequiredError } from "./errors.js";

export type GoogleWorkspaceConnectorId = "gmail" | "drive";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenRow = {
  connector_id: string;
  access_token_enc: string;
  refresh_token_enc: string;
  token_expires_at: Date | string;
  scopes: string[];
};

type WorkspaceAgent = {
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

type WorkspaceRenderOptions = {
  scheduledIntro: (agent: WorkspaceAgent, label: string) => string;
  scheduledTitle: (agent: WorkspaceAgent, label: string) => string;
};

type GmailMessage = {
  id: string;
  threadId?: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name?: string; value?: string }>;
  };
  internalDate?: string;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: Array<{ displayName?: string }>;
  size?: string;
};

const googleAuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
const gmailApiBase = "https://gmail.googleapis.com/gmail/v1";
const driveApiBase = "https://www.googleapis.com/drive/v3";

const gmailScopes = ["https://www.googleapis.com/auth/gmail.readonly"];
const driveScopes = ["https://www.googleapis.com/auth/drive.readonly"];

const connectorScopes: Record<GoogleWorkspaceConnectorId, string[]> = {
  gmail: gmailScopes,
  drive: driveScopes
};

export function isGoogleWorkspaceConnector(
  connectorId: string
): connectorId is GoogleWorkspaceConnectorId {
  return connectorId === "gmail" || connectorId === "drive";
}

export function googleWorkspaceAuthConfigured(): boolean {
  return Boolean(
    config.GOOGLE_CLIENT_ID &&
      config.GOOGLE_CLIENT_SECRET &&
      config.GOOGLE_REDIRECT_URI
  );
}

export async function createGoogleWorkspaceAuthUrl(input: {
  userId: string;
  connectorId: GoogleWorkspaceConnectorId;
  callbackScheme: string;
}): Promise<{ authUrl: string; callbackScheme: string }> {
  ensureGoogleWorkspaceAuthConfigured();

  const scopes = await requestedScopes(input.userId, input.connectorId);
  const state = signOAuthState({
    v: 1,
    userId: input.userId,
    connectorId: input.connectorId,
    callbackScheme: sanitizeCallbackScheme(input.callbackScheme),
    nonce: randomBytes(16).toString("base64url"),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 10 * 60
  });

  const authUrl = new URL(googleAuthorizationEndpoint);
  authUrl.searchParams.set("client_id", config.GOOGLE_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", config.GOOGLE_REDIRECT_URI!);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes.join(" "));
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return { authUrl: authUrl.toString(), callbackScheme: input.callbackScheme };
}

export async function handleGoogleWorkspaceOAuthCallback(input: {
  code?: string;
  state?: string;
  error?: string;
}): Promise<URL> {
  if (!input.state) {
    return mobileConnectorRedirect("sydney", "gmail", {
      error: "missing_state"
    });
  }

  const state = verifyOAuthState(input.state);
  if (input.error) {
    return mobileConnectorRedirect(state.callbackScheme, state.connectorId, {
      error: input.error
    });
  }

  if (!input.code) {
    return mobileConnectorRedirect(state.callbackScheme, state.connectorId, {
      error: "missing_code"
    });
  }

  try {
    const token = await exchangeAuthorizationCode(input.code);
    await storeGoogleWorkspaceToken({
      userId: state.userId,
      requestedConnectorId: state.connectorId,
      token
    });

    return mobileConnectorRedirect(state.callbackScheme, state.connectorId, {
      status: "connected"
    });
  } catch (error) {
    return mobileConnectorRedirect(state.callbackScheme, state.connectorId, {
      error: errorCode(error)
    });
  }
}

export function parseGoogleWorkspaceCallbackUrl(
  callbackUrl: string
): { connectorId: GoogleWorkspaceConnectorId; error?: string } {
  const url = new URL(callbackUrl);
  if (url.protocol !== "sydney:" && url.protocol !== `${config.MOBILE_AUTH_CALLBACK_SCHEME}:`) {
    throw new Error("Invalid connector callback scheme.");
  }
  if (url.hostname !== "connectors" || url.pathname !== "/google") {
    throw new Error("Invalid connector callback URL.");
  }

  const connectorId = url.searchParams.get("connector_id");
  if (!connectorId || !isGoogleWorkspaceConnector(connectorId)) {
    throw new Error("Invalid Google Workspace connector.");
  }

  return {
    connectorId,
    error: url.searchParams.get("error") ?? undefined
  };
}

export async function hasUsableGoogleWorkspaceToken(
  userId: string,
  connectorId: GoogleWorkspaceConnectorId
): Promise<boolean> {
  const { rows } = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM connector_tokens
        WHERE user_id = $1
          AND connector_id = $2
          AND status = 'connected'
      ) AS exists
    `,
    [userId, connectorId]
  );

  return rows[0]?.exists === true;
}

export async function renderGoogleWorkspaceAgent(
  agent: WorkspaceAgent,
  options: WorkspaceRenderOptions
): Promise<RenderedAgentMessage | null> {
  const intent = String(agent.parsed_intent.intent ?? "");
  if (intent === "project_deadline_watcher") {
    const gmailToken = await googleAccessToken(agent.user_id, "gmail");
    const driveToken = await googleAccessToken(agent.user_id, "drive");
    if (!gmailToken || !driveToken) return null;
    return renderProjectDeadlineWatcher(agent, gmailToken, driveToken, options);
  }

  if (gmailIntent(intent)) {
    const token = await googleAccessToken(agent.user_id, "gmail");
    if (!token) return null;
    return renderGmailAgent(agent, token, options);
  }

  if (driveIntent(intent)) {
    const token = await googleAccessToken(agent.user_id, "drive");
    if (!token) return null;
    return renderDriveAgent(agent, token, options);
  }

  return null;
}

async function renderProjectDeadlineWatcher(
  agent: WorkspaceAgent,
  gmailAccessToken: string,
  driveAccessToken: string,
  options: WorkspaceRenderOptions
): Promise<RenderedAgentMessage> {
  const [messages, files] = await Promise.all([
    fetchGmailMessages(
      gmailAccessToken,
      "newer_than:30d (deadline OR due OR launch OR milestone)",
      5
    ),
    fetchDriveFiles(
      driveAccessToken,
      "trashed = false and (name contains 'deadline' or name contains 'plan' or name contains 'roadmap' or name contains 'milestone')",
      5
    )
  ]);

  const emailItems = messages.map((message) => ({
    id: `gmail_${message.id}`,
    label: `Gmail: ${subjectOrFallback(message)}`,
    checked: false
  }));
  const driveItems = files.map((file) => ({
    id: `drive_${file.id}`,
    label: `Drive: ${driveFileLine(file)}`,
    checked: false
  }));
  const items = [...emailItems, ...driveItems];

  return renderedChecklist(
    {
      title: options.scheduledTitle(agent, "deadline checklist"),
      message:
        items.length > 0
          ? "Workspace items that may mention deadlines:"
          : "No recent Gmail or Drive items matched deadline terms.",
      items:
        items.length > 0
          ? items
          : [
              {
                id: "none_found",
                label: "No matching Workspace deadline items found",
                checked: true
              }
            ],
      footer: "Review each source before treating it as a committed deadline."
    },
    {
      sourceRefs: [
        ...messages.map((message) => ({
          source: "Gmail",
          id: message.id,
          thread_id: message.threadId,
          subject: header(message, "Subject")
        })),
        ...files.map((file) => ({
          source: "Google Drive",
          id: file.id,
          name: file.name,
          url: file.webViewLink
        }))
      ]
    }
  );
}

async function renderGmailAgent(
  agent: WorkspaceAgent,
  accessToken: string,
  options: WorkspaceRenderOptions
): Promise<RenderedAgentMessage> {
  const intent = String(agent.parsed_intent.intent ?? "");
  const messages = await fetchGmailMessages(accessToken, gmailQuery(intent), 8);
  const title = options.scheduledTitle(agent, gmailOutputLabel(intent));
  const sourceRefs = messages.map((message) => ({
    source: "Gmail",
    id: message.id,
    thread_id: message.threadId,
    subject: header(message, "Subject")
  }));

  if (messages.length === 0) {
    return renderedDataSummary(
      {
        title,
        text: options.scheduledIntro(agent, gmailOutputLabel(intent)),
        summary: "No matching Gmail messages were found for this run.",
        metrics: [
          { label: "Messages", value: "0" },
          { label: "Source", value: "Gmail" }
        ],
        footer: "No email content was invented."
      },
      { sourceRefs }
    );
  }

  if (intent === "travel_sentinel") {
    return renderedChecklist(
      {
        title,
        message: "Travel-related Gmail messages found.",
        items: messages.slice(0, 5).map((message) => ({
          id: message.id,
          label: compactMessageLine(message),
          checked: false
        })),
        footer: "Review these messages before acting on booking details."
      },
      { sourceRefs }
    );
  }

  if (
    intent === "invoice_tracker" ||
    intent === "email_followup_watcher" ||
    intent === "lead_response_monitor"
  ) {
    return renderedUrgencyList(
      {
        title,
        source: "Gmail",
        timestamp: new Date().toISOString(),
        items: messages.slice(0, 6).map((message) => ({
          label: subjectOrFallback(message),
          urgency: intent === "invoice_tracker" ? "medium" : "low",
          due: messageDate(message),
          preview: message.snippet ?? header(message, "From") ?? "Gmail message"
        }))
      },
      { sourceRefs }
    );
  }

  return renderedDataSummary(
    {
      title,
      text: options.scheduledIntro(agent, gmailOutputLabel(intent)),
      summary: messages.slice(0, 5).map(compactMessageLine).join("\n"),
      metrics: [
        { label: "Messages", value: String(messages.length) },
        { label: "Source", value: "Gmail" }
      ],
      footer: "Summarized from Gmail metadata and snippets."
    },
    { sourceRefs }
  );
}

async function renderDriveAgent(
  agent: WorkspaceAgent,
  accessToken: string,
  options: WorkspaceRenderOptions
): Promise<RenderedAgentMessage> {
  const intent = String(agent.parsed_intent.intent ?? "");
  const files = await fetchDriveFiles(accessToken, driveQuery(intent), 8);
  const title = options.scheduledTitle(agent, driveOutputLabel(intent));
  const sourceRefs = files.map((file) => ({
    source: "Google Drive",
    id: file.id,
    name: file.name,
    url: file.webViewLink
  }));

  if (files.length === 0) {
    return renderedDataSummary(
      {
        title,
        text: options.scheduledIntro(agent, driveOutputLabel(intent)),
        summary: "No matching Google Drive files were found for this run.",
        metrics: [
          { label: "Files", value: "0" },
          { label: "Source", value: "Drive" }
        ],
        footer: "No document content was invented."
      },
      { sourceRefs }
    );
  }

  if (intent === "meeting_recap") {
    const excerpts = await fetchDriveDocExcerpts(accessToken, files.slice(0, 3));
    return renderedPlainText(
      [
        options.scheduledIntro(agent, "meeting recap"),
        ...files.slice(0, 5).map((file) => `- ${driveFileLine(file)}`),
        excerpts.length > 0
          ? `\nDoc excerpts:\n${excerpts.join("\n\n")}`
          : "\nNo Google Docs text was available to export in this run."
      ].join("\n"),
      { sourceRefs }
    );
  }

  if (intent === "pdf_summary") {
    return renderedPlainText(
      [
        options.scheduledIntro(agent, "PDF summary"),
        ...files.slice(0, 6).map((file) => `- ${driveFileLine(file)}`),
        "",
        "PDF text extraction is not enabled yet, so this run lists matching real Drive PDFs without inventing their contents."
      ].join("\n"),
      { sourceRefs }
    );
  }

  return renderedDataSummary(
    {
      title,
      text: options.scheduledIntro(agent, driveOutputLabel(intent)),
      summary: files.slice(0, 6).map(driveFileLine).join("\n"),
      metrics: [
        { label: "Files", value: String(files.length) },
        { label: "Source", value: "Drive" }
      ],
      footer: "Based on Google Drive file metadata."
    },
    { sourceRefs }
  );
}

async function requestedScopes(
  userId: string,
  connectorId: GoogleWorkspaceConnectorId
): Promise<string[]> {
  const existing = await connectedGoogleScopes(userId);
  return [...new Set([...existing, ...connectorScopes[connectorId]])];
}

async function connectedGoogleScopes(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ scopes: string[] }>(
    `
      SELECT scopes
      FROM connector_tokens
      WHERE user_id = $1
        AND connector_id = ANY($2::text[])
        AND status = 'connected'
    `,
    [userId, Object.keys(connectorScopes)]
  );

  return rows.flatMap((row) => row.scopes ?? []);
}

async function exchangeAuthorizationCode(code: string): Promise<GoogleTokenResponse> {
  ensureGoogleWorkspaceAuthConfigured();

  const response = await fetch(googleTokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID!,
      client_secret: config.GOOGLE_CLIENT_SECRET!,
      redirect_uri: config.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code"
    })
  });

  const body = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || body.error || !body.access_token) {
    throw new Error(body.error ?? "google_token_exchange_failed");
  }

  return body;
}

async function refreshGoogleToken(
  userId: string,
  connectorId: GoogleWorkspaceConnectorId,
  refreshToken: string
): Promise<string> {
  ensureGoogleWorkspaceAuthConfigured();

  const response = await fetch(googleTokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID!,
      client_secret: config.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });

  const body = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || body.error || !body.access_token) {
    await markConnectorActionRequired(
      userId,
      connectorId,
      body.error ?? "google_token_refresh_failed"
    );
    throw connectorAuthRequired(
      connectorId,
      body.error ?? "google_token_refresh_failed"
    );
  }

  await pool.query(
    `
      UPDATE connector_tokens
      SET access_token_enc = $3,
          token_expires_at = $4,
          scopes = CASE
            WHEN cardinality($5::text[]) > 0 THEN $5::text[]
            ELSE scopes
          END,
          updated_at = NOW()
      WHERE user_id = $1 AND connector_id = $2
    `,
    [
      userId,
      connectorId,
      encryptSecret(body.access_token),
      tokenExpiry(body.expires_in),
      parseScopes(body.scope)
    ]
  );

  return body.access_token;
}

async function storeGoogleWorkspaceToken(input: {
  userId: string;
  requestedConnectorId: GoogleWorkspaceConnectorId;
  token: GoogleTokenResponse;
}): Promise<void> {
  if (!input.token.access_token) {
    throw new Error("missing_access_token");
  }

  const grantedScopes = parseScopes(input.token.scope);
  const connectorIds = coveredConnectors(grantedScopes, input.requestedConnectorId);
  const refreshToken =
    input.token.refresh_token ??
    (await existingGoogleRefreshToken(input.userId, input.requestedConnectorId));

  if (!refreshToken) {
    throw new Error("missing_refresh_token");
  }

  for (const connectorId of connectorIds) {
    await pool.query(
      `
        INSERT INTO connector_tokens
          (user_id, connector_id, access_token_enc, refresh_token_enc,
           token_expires_at, scopes, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'connected')
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
        input.userId,
        connectorId,
        encryptSecret(input.token.access_token),
        encryptSecret(refreshToken),
        tokenExpiry(input.token.expires_in),
        grantedScopes
      ]
    );

    await pool.query(
      `
        INSERT INTO connector_statuses (user_id, connector_id, status)
        VALUES ($1, $2, 'connected')
        ON CONFLICT (user_id, connector_id)
        DO UPDATE SET status = 'connected', updated_at = NOW()
      `,
      [input.userId, connectorId]
    );
  }
}

async function googleAccessToken(
  userId: string,
  connectorId: GoogleWorkspaceConnectorId
): Promise<string | null> {
  const { rows } = await pool.query<GoogleTokenRow>(
    `
      SELECT connector_id, access_token_enc, refresh_token_enc, token_expires_at, scopes
      FROM connector_tokens
      WHERE user_id = $1
        AND connector_id = $2
        AND status = 'connected'
    `,
    [userId, connectorId]
  );
  const token = rows[0];
  if (!token) return null;

  const accessToken = decryptSecret(token.access_token_enc);
  const refreshToken = decryptSecret(token.refresh_token_enc);
  const expiresAt = new Date(token.token_expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return accessToken;
  }

  return refreshGoogleToken(userId, connectorId, refreshToken);
}

async function existingGoogleRefreshToken(
  userId: string,
  requestedConnectorId: GoogleWorkspaceConnectorId
): Promise<string | null> {
  const { rows } = await pool.query<{ refresh_token_enc: string }>(
    `
      SELECT refresh_token_enc
      FROM connector_tokens
      WHERE user_id = $1
        AND connector_id = ANY($2::text[])
      ORDER BY
        CASE WHEN connector_id = $3 THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 1
    `,
    [userId, Object.keys(connectorScopes), requestedConnectorId]
  );

  return rows[0] ? decryptSecret(rows[0].refresh_token_enc) : null;
}

async function fetchGmailMessages(
  accessToken: string,
  query: string,
  maxResults: number
): Promise<GmailMessage[]> {
  const listUrl = new URL(`${gmailApiBase}/users/me/messages`);
  listUrl.searchParams.set("maxResults", String(maxResults));
  if (query) listUrl.searchParams.set("q", query);

  const list = await googleJson<{ messages?: Array<{ id?: string }> }>(
    listUrl,
    accessToken
  );
  const ids = (list.messages ?? []).map((message) => message.id).filter(Boolean);

  return Promise.all(
    ids.map((id) => fetchGmailMessage(accessToken, id!))
  );
}

async function fetchGmailMessage(
  accessToken: string,
  id: string
): Promise<GmailMessage> {
  const url = new URL(`${gmailApiBase}/users/me/messages/${id}`);
  url.searchParams.set("format", "metadata");
  for (const headerName of ["Subject", "From", "Date"]) {
    url.searchParams.append("metadataHeaders", headerName);
  }

  return googleJson<GmailMessage>(url, accessToken);
}

async function fetchDriveFiles(
  accessToken: string,
  query: string,
  pageSize: number
): Promise<DriveFile[]> {
  const url = new URL(`${driveApiBase}/files`);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("orderBy", "modifiedTime desc");
  url.searchParams.set(
    "fields",
    "files(id,name,mimeType,modifiedTime,webViewLink,owners(displayName),size)"
  );
  url.searchParams.set("q", query);

  const body = await googleJson<{ files?: DriveFile[] }>(url, accessToken);
  return body.files ?? [];
}

async function fetchDriveDocExcerpts(
  accessToken: string,
  files: DriveFile[]
): Promise<string[]> {
  const docs = files.filter(
    (file) => file.mimeType === "application/vnd.google-apps.document"
  );
  const excerpts: string[] = [];

  for (const file of docs) {
    const url = new URL(`${driveApiBase}/files/${file.id}/export`);
    url.searchParams.set("mimeType", "text/plain");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) continue;

    const text = (await response.text()).replace(/\s+/g, " ").trim();
    if (text) {
      excerpts.push(`${file.name}: ${text.slice(0, 360)}`);
    }
  }

  return excerpts;
}

async function googleJson<T>(url: URL, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const body = (await response.json()) as T & {
    error?: { message?: string; status?: string };
  };

  if (response.status === 401 || response.status === 403) {
    throw new ConnectorAuthRequiredError({
      connectorId: googleConnectorIdFromUrl(url),
      connectorName: googleConnectorName(googleConnectorIdFromUrl(url)),
      reason: body.error?.status ?? body.error?.message ?? "google_api_auth_failed"
    });
  }

  if (!response.ok) {
    throw new Error(body.error?.status ?? body.error?.message ?? "google_api_failed");
  }

  return body;
}

async function markConnectorActionRequired(
  userId: string,
  connectorId: GoogleWorkspaceConnectorId,
  reason: string
): Promise<void> {
  await Promise.all([
    pool.query(
      `
        UPDATE connector_tokens
        SET status = 'action_required', updated_at = NOW()
        WHERE user_id = $1 AND connector_id = $2
      `,
      [userId, connectorId]
    ),
    pool.query(
      `
        INSERT INTO connector_statuses (user_id, connector_id, status)
        VALUES ($1, $2, 'action_required')
        ON CONFLICT (user_id, connector_id)
        DO UPDATE SET status = 'action_required', updated_at = NOW()
      `,
      [userId, connectorId]
    )
  ]);

  void reason;
}

function connectorAuthRequired(
  connectorId: GoogleWorkspaceConnectorId,
  reason: string
): ConnectorAuthRequiredError {
  return new ConnectorAuthRequiredError({
    connectorId,
    connectorName: googleConnectorName(connectorId),
    reason
  });
}

function googleConnectorName(connectorId: GoogleWorkspaceConnectorId): string {
  return connectorId === "gmail" ? "Gmail" : "Google Drive";
}

function googleConnectorIdFromUrl(url: URL): GoogleWorkspaceConnectorId {
  return url.host.includes("gmail") ? "gmail" : "drive";
}

function gmailIntent(intent: string): boolean {
  return [
    "email_digest",
    "invoice_tracker",
    "subscription_auditor",
    "email_followup_watcher",
    "lead_response_monitor",
    "travel_sentinel"
  ].includes(intent);
}

function driveIntent(intent: string): boolean {
  return [
    "drive_summary",
    "pdf_summary",
    "meeting_recap"
  ].includes(intent);
}

function gmailQuery(intent: string): string {
  switch (intent) {
    case "invoice_tracker":
      return "newer_than:30d (invoice OR receipt OR payment OR due)";
    case "subscription_auditor":
      return "newer_than:90d (subscription OR renewal OR receipt OR recurring)";
    case "email_followup_watcher":
      return "in:sent newer_than:14d";
    case "lead_response_monitor":
      return "newer_than:14d (lead OR inquiry OR demo OR interested)";
    case "travel_sentinel":
      return "newer_than:180d (flight OR hotel OR booking OR itinerary OR travel)";
    default:
      return "newer_than:1d";
  }
}

function driveQuery(intent: string): string {
  switch (intent) {
    case "pdf_summary":
      return "trashed = false and mimeType = 'application/pdf'";
    case "meeting_recap":
      return "trashed = false and mimeType = 'application/vnd.google-apps.document' and (name contains 'meeting' or name contains 'notes')";
    default:
      return "trashed = false";
  }
}

function gmailOutputLabel(intent: string): string {
  switch (intent) {
    case "invoice_tracker":
      return "invoice tracker";
    case "subscription_auditor":
      return "subscription audit";
    case "email_followup_watcher":
      return "follow-up watcher";
    case "lead_response_monitor":
      return "lead monitor";
    case "travel_sentinel":
      return "travel checklist";
    default:
      return "email digest";
  }
}

function driveOutputLabel(intent: string): string {
  switch (intent) {
    case "pdf_summary":
      return "PDF summary";
    case "meeting_recap":
      return "meeting recap";
    default:
      return "Drive summary";
  }
}

function coveredConnectors(
  scopes: string[],
  fallback: GoogleWorkspaceConnectorId
): GoogleWorkspaceConnectorId[] {
  const covered = (Object.keys(connectorScopes) as GoogleWorkspaceConnectorId[])
    .filter((connectorId) =>
      connectorScopes[connectorId].every((scope) => scopes.includes(scope))
    );

  return covered.length > 0 ? covered : [fallback];
}

function parseScopes(scope: string | undefined): string[] {
  return [...new Set((scope ?? "").split(/\s+/).filter(Boolean))];
}

function tokenExpiry(expiresIn: number | undefined): Date {
  const seconds = Number.isFinite(expiresIn) ? Number(expiresIn) : 3600;
  return new Date(Date.now() + seconds * 1000);
}

function header(message: GmailMessage, name: string): string | null {
  const match = message.payload?.headers?.find(
    (item) => item.name?.toLowerCase() === name.toLowerCase()
  );
  return match?.value ?? null;
}

function subjectOrFallback(message: GmailMessage): string {
  return header(message, "Subject") ?? message.snippet ?? "Gmail message";
}

function compactMessageLine(message: GmailMessage): string {
  const subject = subjectOrFallback(message);
  const from = header(message, "From");
  const date = messageDate(message);
  return [subject, from ? `from ${from}` : null, date].filter(Boolean).join(" - ");
}

function messageDate(message: GmailMessage): string | undefined {
  const date = header(message, "Date");
  if (date) return date;
  if (!message.internalDate) return undefined;

  const parsed = Number(message.internalDate);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("en-US") : undefined;
}

function driveFileLine(file: DriveFile): string {
  const modified = file.modifiedTime
    ? `modified ${new Date(file.modifiedTime).toLocaleDateString("en-US")}`
    : "modified date unavailable";
  return `${file.name} (${modified})`;
}

function signOAuthState(payload: OAuthState): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmac(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifyOAuthState(state: string): OAuthState {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("invalid_state");
  }

  const expected = hmac(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error("invalid_state_signature");
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8")
  ) as OAuthState;
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("expired_state");
  }
  if (!isGoogleWorkspaceConnector(payload.connectorId)) {
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
  connectorId: GoogleWorkspaceConnectorId,
  params: Record<string, string>
): URL {
  const url = new URL(`${callbackScheme}://connectors/google`);
  url.searchParams.set("connector_id", connectorId);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(":");
}

function decryptSecret(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Invalid encrypted connector token.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    vaultKey(),
    Buffer.from(iv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

function vaultKey(): Buffer {
  return Buffer.from(config.VAULT_ENCRYPTION_KEY, "hex");
}

function ensureGoogleWorkspaceAuthConfigured(): void {
  if (!googleWorkspaceAuthConfigured()) {
    throw new Error("google_workspace_oauth_not_configured");
  }
}

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "google_workspace_oauth_failed";
}

type OAuthState = {
  v: 1;
  userId: string;
  connectorId: GoogleWorkspaceConnectorId;
  callbackScheme: string;
  nonce: string;
  iat: number;
  exp: number;
};

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import {
  digestSection,
  renderedChecklist,
  renderedDataSummary,
  renderedPlainText,
  renderedUrgencyList,
  type RenderedAgentMessage
} from "../agents/output.js";
import { synthesizeConnectorDigest } from "../agents/connector-summarizer.js";
import { ConnectorAuthRequiredError } from "./errors.js";

export type GoogleWorkspaceConnectorId = "gmail" | "drive" | "calendar";

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

type GmailDigestItem = {
  subject: string;
  sender: string;
  snippet: string;
  category: "attention" | "reply" | "finance" | "system" | "update";
  line: string;
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

type CalendarEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

type CalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: CalendarEventDate;
  end?: CalendarEventDate;
  organizer?: { displayName?: string; email?: string };
  attendees?: Array<{
    displayName?: string;
    email?: string;
    responseStatus?: string;
    self?: boolean;
  }>;
};

const googleAuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
const gmailApiBase = "https://gmail.googleapis.com/gmail/v1";
const driveApiBase = "https://www.googleapis.com/drive/v3";
const calendarApiBase = "https://www.googleapis.com/calendar/v3";

const gmailScopes = ["https://www.googleapis.com/auth/gmail.readonly"];
const driveScopes = ["https://www.googleapis.com/auth/drive.readonly"];
const calendarScopes = [
  "https://www.googleapis.com/auth/calendar.events.readonly"
];

const connectorScopes: Record<GoogleWorkspaceConnectorId, string[]> = {
  gmail: gmailScopes,
  drive: driveScopes,
  calendar: calendarScopes
};

export function isGoogleWorkspaceConnector(
  connectorId: string
): connectorId is GoogleWorkspaceConnectorId {
  return connectorId === "gmail" || connectorId === "drive" || connectorId === "calendar";
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

  if (calendarIntent(intent)) {
    const token = await googleAccessToken(agent.user_id, "calendar");
    if (!token) return null;
    return renderCalendarAgent(agent, token, options);
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

  const synthesized = await synthesizeConnectorDigest({
    connectorName: "Gmail",
    agentName: agent.name,
    userPrompt: gmailOnlyDigestPrompt(agent.prompt),
    records: messages.map(gmailDigestRecord)
  });

  return renderedDataSummary(
    {
      title: "Mailbox highlights",
      text: options.scheduledIntro(agent, gmailOutputLabel(intent)),
      summary: synthesized?.summary ?? buildEmailDigestSummary(messages),
      metrics: [
        { label: "Messages", value: String(messages.length) },
        { label: "Needs review", value: String(reviewCount(messages)) },
        { label: "Source", value: "Gmail" }
      ],
      footer: "Summarized from Gmail metadata and snippets."
    },
    { sourceRefs, tokensUsed: synthesized?.tokensUsed ?? 0 }
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

  const synthesized = await synthesizeConnectorDigest({
    connectorName: "Google Drive",
    agentName: agent.name,
    userPrompt: agent.prompt,
    records: files.map(driveDigestRecord)
  });

  return renderedDataSummary(
    {
      title: "Drive highlights",
      text: options.scheduledIntro(agent, driveOutputLabel(intent)),
      summary: synthesized?.summary ?? buildDriveSummary(files),
      metrics: [
        { label: "Files", value: String(files.length) },
        { label: "Source", value: "Drive" }
      ],
      footer: "Based on Google Drive file metadata."
    },
    { sourceRefs, tokensUsed: synthesized?.tokensUsed ?? 0 }
  );
}

async function renderCalendarAgent(
  agent: WorkspaceAgent,
  accessToken: string,
  options: WorkspaceRenderOptions
): Promise<RenderedAgentMessage> {
  const now = new Date();
  const through = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const events = await fetchCalendarEvents(accessToken, now, through, 12);
  const sourceRefs = events.map((event) => ({
    type: "calendar_event",
    source: "Google Calendar",
    id: event.id,
    title: calendarEventTitle(event),
    url: event.htmlLink,
    start: event.start,
    end: event.end
  }));

  if (events.length === 0) {
    return renderedDataSummary(
      {
        title: options.scheduledTitle(agent, "calendar agenda"),
        text: options.scheduledIntro(agent, "calendar agenda"),
        summary: "No upcoming events were found on the primary calendar for the next 7 days.",
        metrics: [
          { label: "Events", value: "0" },
          { label: "Window", value: "7 days" },
          { label: "Source", value: "Calendar" }
        ],
        footer: "Read from Google Calendar. No events were created or changed."
      },
      { sourceRefs }
    );
  }

  return renderedDataSummary(
    {
      title: options.scheduledTitle(agent, "calendar agenda"),
      text: options.scheduledIntro(agent, "calendar agenda"),
      summary: digestSection(
        "Upcoming events",
        events.map(calendarEventLine)
      ),
      metrics: [
        { label: "Events", value: String(events.length) },
        { label: "Window", value: "7 days" },
        { label: "Source", value: "Calendar" }
      ],
      footer: "Read-only agenda from the primary Google Calendar."
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
  if (!googleTokenRefreshConfigured()) {
    await markConnectorActionRequired(
      userId,
      connectorId,
      "google_workspace_refresh_not_configured"
    );
    throw connectorAuthRequired(
      connectorId,
      "google_workspace_refresh_not_configured"
    );
  }

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

  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = decryptSecret(token.access_token_enc);
    refreshToken = decryptSecret(token.refresh_token_enc);
  } catch {
    await markConnectorActionRequired(
      userId,
      connectorId,
      "connector_token_decryption_failed"
    );
    throw connectorAuthRequired(connectorId, "connector_token_decryption_failed");
  }

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

async function fetchCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
  maxResults: number
): Promise<CalendarEvent[]> {
  const url = new URL(`${calendarApiBase}/calendars/primary/events`);
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "false");
  url.searchParams.set("maxResults", String(maxResults));

  const response = await googleJson<{ items?: CalendarEvent[] }>(url, accessToken);
  return (response.items ?? []).filter(
    (event): event is CalendarEvent => Boolean(event.id) && event.status !== "cancelled"
  );
}

async function googleJson<T>(url: URL, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const body = (await response.json()) as T & {
    error?: {
      message?: string;
      status?: string;
      errors?: Array<{ reason?: string; message?: string }>;
    };
  };

  if (isGoogleAuthFailure(response.status, body)) {
    throw new ConnectorAuthRequiredError({
      connectorId: googleConnectorIdFromUrl(url),
      connectorName: googleConnectorName(googleConnectorIdFromUrl(url)),
      reason: body.error?.status ?? body.error?.message ?? "google_api_auth_failed"
    });
  }

  if (!response.ok) {
    throw new Error(googleApiErrorReason(body));
  }

  return body;
}

function isGoogleAuthFailure(
  status: number,
  body: { error?: { message?: string; status?: string; errors?: Array<{ reason?: string }> } }
): boolean {
  if (status === 401) return true;
  if (status !== 403) return false;

  const googleStatus = body.error?.status;
  const message = body.error?.message?.toLowerCase() ?? "";
  const reasons = new Set(
    (body.error?.errors ?? [])
      .map((error) => error.reason?.toLowerCase())
      .filter(Boolean)
  );

  return (
    googleStatus === "UNAUTHENTICATED" ||
    reasons.has("autherror") ||
    reasons.has("insufficientpermissions") ||
    message.includes("insufficient authentication scopes") ||
    message.includes("request had insufficient authentication scopes")
  );
}

function googleApiErrorReason(body: {
  error?: {
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
}): string {
  const reason = body.error?.errors?.find((error) => error.reason)?.reason;
  return reason ?? body.error?.status ?? body.error?.message ?? "google_api_failed";
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
  switch (connectorId) {
    case "gmail":
      return "Gmail";
    case "calendar":
      return "Google Calendar";
    default:
      return "Google Drive";
  }
}

function googleConnectorIdFromUrl(url: URL): GoogleWorkspaceConnectorId {
  if (url.host.includes("gmail")) return "gmail";
  if (url.pathname.includes("/calendar/")) return "calendar";
  return "drive";
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

function calendarIntent(intent: string): boolean {
  return intent === "calendar_agenda";
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

function calendarEventTitle(event: CalendarEvent): string {
  return event.summary?.trim() || "Untitled event";
}

function calendarEventLine(event: CalendarEvent): string {
  const start = calendarEventStart(event);
  const location = event.location?.trim();
  return [start, calendarEventTitle(event), location ? `at ${location}` : null]
    .filter(Boolean)
    .join(" — ");
}

function calendarEventStart(event: CalendarEvent): string {
  if (event.start?.dateTime) {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: config.AGENT_SCHEDULE_TIME_ZONE
    }).format(new Date(event.start.dateTime));
  }

  if (event.start?.date) {
    const [year, month, day] = event.start.date.split("-").map(Number);
    if (year && month && day) {
      return new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      }).format(new Date(Date.UTC(year, month - 1, day)));
    }
  }

  return "Time unavailable";
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

function buildEmailDigestSummary(messages: GmailMessage[]): string {
  const items = messages.map(gmailDigestItem);
  const attention = items.filter((item) => item.category === "attention");
  const replies = items.filter((item) => item.category === "reply");
  const finance = items.filter((item) => item.category === "finance");
  const updates = items.filter(
    (item) => item.category === "update" || item.category === "system"
  );
  const sections: string[] = [];

  if (attention.length > 0) {
    sections.push(
      digestSection(
        "Needs attention",
        attention.slice(0, 3).map((item) => item.line)
      )
    );
  }

  if (replies.length > 0) {
    sections.push(
      digestSection(
        "Replies to consider",
        replies.slice(0, 3).map((item) => item.line)
      )
    );
  }

  if (finance.length > 0) {
    sections.push(
      digestSection(
        "Bills and receipts",
        finance.slice(0, 3).map((item) => item.line)
      )
    );
  }

  const remaining = updates
    .filter(
      (item) =>
        !attention.includes(item) &&
        !replies.includes(item) &&
        !finance.includes(item)
    )
    .slice(
      0,
      Math.max(2, 6 - attention.length - replies.length - finance.length)
    );
  if (remaining.length > 0) {
    sections.push(
      digestSection(
        "Other updates",
        remaining.map((item) => item.line)
      )
    );
  }

  const fallback = items
    .filter(
      (item) =>
        !attention.includes(item) &&
        !replies.includes(item) &&
        !finance.includes(item) &&
        !remaining.includes(item)
    )
    .slice(0, 5);
  if (sections.length === 0 && fallback.length > 0) {
    sections.push(
      digestSection(
        "Recent messages",
        fallback.map((item) => item.line)
      )
    );
  }

  return [
    ...sections,
    "Open Gmail for full message bodies before taking action."
  ].join("\n\n");
}

function reviewCount(messages: GmailMessage[]): number {
  return messages.filter((message) =>
    ["attention", "reply", "finance"].includes(
      gmailDigestItem(message).category
    )
  ).length;
}

function gmailDigestItem(message: GmailMessage): GmailDigestItem {
  const subject = cleanSubject(subjectOrFallback(message));
  const sender = senderLabel(header(message, "From"));
  const snippet = cleanSnippet(message.snippet ?? "");
  const category = gmailDigestCategory(subject, sender, snippet);
  const detail = digestDetail(subject, snippet);
  const actionHint = categoryHint(category);

  return {
    subject,
    sender,
    snippet,
    category,
    line: [sender, detail, actionHint].filter(Boolean).join(" - ")
  };
}

function gmailDigestRecord(message: GmailMessage): string {
  const item = gmailDigestItem(message);
  const date = messageDate(message);
  return [
    `Subject: ${item.subject}`,
    `Sender: ${item.sender}`,
    item.snippet ? `Snippet: ${item.snippet}` : null,
    date ? `Date: ${date}` : null,
    `Category hint: ${item.category}`
  ]
    .filter(Boolean)
    .join(" | ");
}

function gmailOnlyDigestPrompt(prompt: string): string {
  const sanitized = prompt
    .replace(/,?\s*calendar-related updates,?/gi, ",")
    .replace(/\s+,/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();

  return [
    sanitized,
    "Data boundary: use only the supplied Gmail message metadata and snippets. Do not infer events or information from external services."
  ]
    .filter(Boolean)
    .join("\n");
}

function gmailDigestCategory(
  subject: string,
  sender: string,
  snippet: string
): GmailDigestItem["category"] {
  const text = `${subject} ${sender} ${snippet}`.toLowerCase();
  if (/\b(failed|failure|urgent|action required|security alert|verify|blocked)\b/.test(text)) {
    return "attention";
  }
  if (/\b(invoice|receipt|payment|paid|bill|e-bill|renewal|subscription|due)\b/.test(text)) {
    return "finance";
  }
  if (
    /\?|\b(?:please (?:reply|confirm|review|send)|can you|could you|let me know|following up|waiting for your)\b/.test(
      text
    )
  ) {
    return "reply";
  }
  if (/\b(build|deploy|system|notification|alert)\b/.test(text)) {
    return "system";
  }
  return "update";
}

function digestDetail(subject: string, snippet: string): string {
  const cleanedSnippet = snippet.replace(new RegExp(escapeRegExp(subject), "i"), "").trim();
  if (cleanedSnippet && cleanedSnippet.length > 18) {
    return `${subject}: ${truncateSentence(cleanedSnippet, 110)}`;
  }
  return subject;
}

function categoryHint(category: GmailDigestItem["category"]): string | null {
  switch (category) {
    case "attention":
      return "check this first";
    case "finance":
      return "review if payment or records matter";
    case "reply":
      return "reply or follow up";
    default:
      return null;
  }
}

function cleanSubject(subject: string): string {
  const cleaned = decodeHtml(subject)
    .replace(/^(re|fw|fwd):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Gmail message";
}

function cleanSnippet(snippet: string): string {
  return decodeHtml(snippet)
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*from\s+.+$/i, "")
    .trim();
}

function senderLabel(from: string | null): string {
  if (!from) return "Unknown sender";
  const decoded = decodeHtml(from).trim();
  const quoted = decoded.match(/^"([^"]+)"/);
  if (quoted?.[1]) return quoted[1];

  const angle = decoded.match(/^([^<]+)</);
  if (angle?.[1]?.trim()) return angle[1].trim().replace(/^'|'$/g, "");

  const email = decoded.match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (email?.[1]) return email[1].replace(/^mail\./, "");

  return decoded;
}

function truncateSentence(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function buildDriveSummary(files: DriveFile[]): string {
  const docs = files
    .filter((file) => file.mimeType?.includes("document"))
    .slice(0, 3)
    .map(driveDigestLine);
  const pdfs = files
    .filter((file) => file.mimeType === "application/pdf")
    .slice(0, 3)
    .map(driveDigestLine);
  const other = files
    .filter(
      (file) =>
        !file.mimeType?.includes("document") &&
        file.mimeType !== "application/pdf"
    )
    .slice(0, Math.max(2, 5 - docs.length - pdfs.length))
    .map(driveDigestLine);

  return [
    digestSection("Documents", docs),
    digestSection("PDFs", pdfs),
    digestSection("Other recent files", other),
    "Open Drive for full document contents before taking action."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function driveDigestLine(file: DriveFile): string {
  const modified = file.modifiedTime
    ? `updated ${new Date(file.modifiedTime).toLocaleDateString("en-US")}`
    : "updated date unavailable";
  const owner = file.owners?.[0]?.displayName
    ? `owner ${file.owners[0].displayName}`
    : null;
  return [file.name, owner, modified].filter(Boolean).join(" - ");
}

function driveDigestRecord(file: DriveFile): string {
  return [
    `Name: ${file.name}`,
    file.mimeType ? `Type: ${file.mimeType}` : null,
    file.modifiedTime
      ? `Modified: ${new Date(file.modifiedTime).toLocaleDateString("en-US")}`
      : null,
    file.owners?.[0]?.displayName ? `Owner: ${file.owners[0].displayName}` : null
  ]
    .filter(Boolean)
    .join(" | ");
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

function googleTokenRefreshConfigured(): boolean {
  return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
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

export async function fetchSourceReferenceDetail(
  userId: string,
  sourceRef: any
): Promise<string> {
  const isGmail = sourceRef.type === "gmail_message" || String(sourceRef.id || "").startsWith("gmail_");

  if (isGmail) {
    const token = await googleAccessToken(userId, "gmail");
    if (!token) throw new Error("Gmail connector is not connected.");

    const rawId = String(sourceRef.id || "").replace(/^gmail_/, "");
    return await fetchGmailMessageBody(token, rawId);
  }

  const isCalendar =
    sourceRef.type === "calendar_event" || sourceRef.source === "Google Calendar";
  if (isCalendar) {
    const token = await googleAccessToken(userId, "calendar");
    if (!token) throw new Error("Google Calendar connector is not connected.");

    const eventId = encodeURIComponent(String(sourceRef.id || ""));
    const url = new URL(`${calendarApiBase}/calendars/primary/events/${eventId}`);
    const event = await googleJson<CalendarEvent>(url, token);
    return [
      `Event: ${calendarEventTitle(event)}`,
      `Starts: ${calendarEventStart(event)}`,
      event.location ? `Location: ${event.location}` : null,
      event.description ? `Description: ${event.description}` : null
    ]
      .filter(Boolean)
      .join("\n");
  }

  // Google Drive / Google Docs
  const token = await googleAccessToken(userId, "drive");
  if (!token) throw new Error("Google Drive connector is not connected.");

  // MimeType is often not in sourceRef, so try to resolve it from the file metadata if missing
  let mimeType = sourceRef.mimeType;
  if (!mimeType && sourceRef.id) {
    try {
      const url = new URL(`${driveApiBase}/files/${sourceRef.id}`);
      url.searchParams.set("fields", "mimeType,name");
      const metadata = await googleJson<{ mimeType?: string, name?: string }>(url, token);
      mimeType = metadata.mimeType;
    } catch {
      // Ignore and fallback
    }
  }

  return await fetchDriveFileContent(token, sourceRef.id, mimeType || "", sourceRef.name || sourceRef.title || "");
}

async function fetchGmailMessageBody(accessToken: string, id: string): Promise<string> {
  const url = new URL(`${gmailApiBase}/users/me/messages/${id}`);
  url.searchParams.set("format", "full");
  const message = await googleJson<any>(url, accessToken);

  let bodyText = "";
  if (message.payload) {
    bodyText = parseGmailBody(message.payload);
    if (!bodyText && message.payload.body?.data) {
      bodyText = Buffer.from(message.payload.body.data, "base64").toString("utf-8");
    }
  }
  return bodyText || message.snippet || "";
}

function parseGmailBody(part: any): string {
  let bodyText = "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    bodyText += Buffer.from(part.body.data, "base64").toString("utf-8");
  }
  if (Array.isArray(part.parts)) {
    for (const subPart of part.parts) {
      bodyText += parseGmailBody(subPart);
    }
  }
  return bodyText;
}

async function fetchDriveFileContent(
  accessToken: string,
  id: string,
  mimeType: string,
  name: string
): Promise<string> {
  if (mimeType === "application/vnd.google-apps.document") {
    const url = new URL(`${driveApiBase}/files/${id}/export`);
    url.searchParams.set("mimeType", "text/plain");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.ok) {
      return await response.text();
    }
  }
  return `File name: ${name} (MimeType: ${mimeType})`;
}

import { createHash, randomBytes } from "node:crypto";
import { config } from "../config.js";
import { ConnectorAuthRequiredError } from "../connectors/errors.js";
import {
  accessProviderForUser
} from "./provider-directory.js";
import { updateCustomMcpProviderAllowedTools } from "./custom-providers.js";
import {
  completeAccessOAuthTransaction,
  claimAccessOAuthTransaction,
  findAccessConnection,
  loadAccessConnectionCredential,
  loadAccessOAuthCompletion,
  loadAccessOAuthTransaction,
  saveAccessOAuthTransaction,
  saveMcpResourceSnapshot,
  saveMcpToolSnapshot,
  setAccessConnectionStatus,
  storeAccessConnectionCredential,
  upsertAccessConnection
} from "./repository.js";
import { mcpOAuthCallbackUrl } from "../mcp/cimd.js";
import { isReadOnlyMcpTool, McpHttpClient } from "../mcp/client.js";
import { discoverMcpOAuthMetadata } from "../mcp/discovery.js";
import {
  assertSafeRemoteMcpUrlWithDns,
  fetchRemoteMcp
} from "../mcp/security.js";
import {
  isAllowedWebOAuthCallback,
  oauthCallbackRedirect,
  sanitizeSupportedCallbackScheme,
  webOAuthCallbackScheme
} from "../security/oauth-callback.js";

export async function startMcpOAuth(input: {
  userId: string;
  providerId: string;
  callbackScheme: string;
}): Promise<{ authUrl: string; callbackScheme: string; providerId: string }> {
  const provider = await accessProviderForUser(input.userId, input.providerId);
  if (!provider || provider.kind !== "mcp" || !provider.endpoint) {
    throw new Error("mcp_provider_not_trusted");
  }
  const callbackScheme = sanitizeCallbackScheme(input.callbackScheme);
  const metadata = await discoverMcpOAuthMetadata(provider);
  await assertSafeRemoteMcpUrlWithDns(metadata.authorizationEndpoint);
  await assertSafeRemoteMcpUrlWithDns(metadata.tokenEndpoint);
  if (metadata.issuer) await assertSafeRemoteMcpUrlWithDns(metadata.issuer);
  if (metadata.resource) await assertSafeRemoteMcpUrlWithDns(metadata.resource);

  const state = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(48).toString("base64url");
  const redirectUri = mcpOAuthCallbackUrl();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await saveAccessOAuthTransaction({
    stateHash: hashState(state),
    userId: input.userId,
    providerId: provider.providerId,
    callbackScheme,
    redirectUri,
    codeVerifier,
    authorizationEndpoint: metadata.authorizationEndpoint,
    tokenEndpoint: metadata.tokenEndpoint,
    ...(metadata.issuer ? { issuer: metadata.issuer } : {}),
    ...(metadata.resource ? { resource: metadata.resource } : {}),
    expiresAt
  });

  const authorizationUrl = new URL(metadata.authorizationEndpoint);
  authorizationUrl.searchParams.set("client_id", config.CIMD_CLIENT_IDENTITY_URL);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge(codeVerifier));
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  if (metadata.scopes.length > 0) {
    authorizationUrl.searchParams.set("scope", metadata.scopes.join(" "));
  }
  if (metadata.resource) authorizationUrl.searchParams.set("resource", metadata.resource);

  return {
    authUrl: authorizationUrl.toString(),
    callbackScheme,
    providerId: provider.providerId
  };
}

export async function handleMcpOAuthCallback(input: {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}): Promise<URL> {
  if (!input.state) {
    return mobileAccessRedirect(config.MOBILE_AUTH_CALLBACK_SCHEME, {
      error: input.error ?? "missing_state"
    });
  }
  const transaction = await claimAccessOAuthTransaction(hashState(input.state));
  if (!transaction) {
    return mobileAccessRedirect(config.MOBILE_AUTH_CALLBACK_SCHEME, {
      error: "invalid_or_expired_state"
    });
  }
  if (input.error) {
    await completeAccessOAuthTransaction({
      id: transaction.id,
      userId: transaction.userId,
      status: "failed"
    });
    return mobileAccessRedirect(transaction.callbackScheme, {
      provider_id: transaction.providerId,
      transaction_id: transaction.id,
      error: safeOAuthError(input.error_description ?? input.error)
    });
  }
  if (!input.code) {
    await completeAccessOAuthTransaction({
      id: transaction.id,
      userId: transaction.userId,
      status: "failed"
    });
    return mobileAccessRedirect(transaction.callbackScheme, {
      provider_id: transaction.providerId,
      transaction_id: transaction.id,
      error: "missing_code"
    });
  }

  try {
    const token = await exchangeCode(transaction, input.code);
    validateTokenBinding(transaction, token);
    const provider = await accessProviderForUser(
      transaction.userId,
      transaction.providerId
    );
    if (!provider?.endpoint) throw new Error("mcp_provider_not_trusted");
    const connection = await upsertAccessConnection({
      userId: transaction.userId,
      providerId: provider.providerId,
      providerKind: "mcp",
      externalAccountId: stringValue(token.account_id ?? token.sub),
      accountLabel: stringValue(token.account_name) ?? provider.displayName,
      capabilities: provider.capabilities,
      endpoint: provider.endpoint,
      metadata: {
        resource: transaction.resource,
        issuer: transaction.issuer ?? token.iss
      },
      status: "connected"
    });
    await storeAccessConnectionCredential({
      connectionId: connection.id,
      accessToken: token.access_token,
      ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
      tokenExpiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000),
      scopes: parseScopes(token.scope),
      metadata: { token_type: token.token_type ?? "Bearer" }
    });

    let status: "connected" | "action_required" = "connected";
    try {
      const client = new McpHttpClient({
        endpoint: provider.endpoint,
        accessToken: token.access_token,
        allowedTools: provider.allowedTools
      });
      await client.initialize();
      const [tools, resources] = await Promise.all([
        client.listTools(),
        client.listResources().catch(() => [])
      ]);
      const readOnlyTools = tools.filter(isReadOnlyMcpTool);
      const approvedTools = provider.allowedTools?.length
        ? readOnlyTools.filter((tool) => provider.allowedTools!.includes(tool.name))
        : readOnlyTools;
      if (approvedTools.length === 0) {
        throw new Error("mcp_no_read_only_tools");
      }
      if (provider.ownerUserId) {
        await updateCustomMcpProviderAllowedTools({
          userId: transaction.userId,
          providerId: provider.providerId,
          allowedTools: approvedTools.map((tool) => tool.name)
        });
      }
      for (const tool of approvedTools) {
        await saveMcpToolSnapshot({
          connectionId: connection.id,
          name: tool.name,
          ...(tool.description ? { description: tool.description } : {}),
          inputSchema: tool.inputSchema ?? {},
          annotations: tool.annotations
        });
      }
      for (const resource of resources) {
        await saveMcpResourceSnapshot({
          connectionId: connection.id,
          uri: resource.uri,
          ...(resource.name ? { name: resource.name } : {}),
          ...(resource.description ? { description: resource.description } : {}),
          ...(resource.mimeType ? { mimeType: resource.mimeType } : {})
        });
      }
    } catch {
      status = "action_required";
      await setAccessConnectionStatus(transaction.userId, connection.id, status);
    }
    await completeAccessOAuthTransaction({
      id: transaction.id,
      userId: transaction.userId,
      status: "completed",
      connectionId: connection.id
    });
    return mobileAccessRedirect(transaction.callbackScheme, {
      provider_id: provider.providerId,
      transaction_id: transaction.id,
      connection_id: connection.id,
      status
    });
  } catch (error) {
    await completeAccessOAuthTransaction({
      id: transaction.id,
      userId: transaction.userId,
      status: "failed"
    });
    return mobileAccessRedirect(transaction.callbackScheme, {
      provider_id: transaction.providerId,
      transaction_id: transaction.id,
      error: errorCode(error)
    });
  }
}

export async function completeMcpOAuth(
  userId: string,
  providerId: string,
  callbackUrl: string
) {
  const url = new URL(callbackUrl);
  if (!isAllowedCallbackUrl(url)) throw new Error("Invalid MCP OAuth callback URL.");
  if (url.searchParams.get("provider_id") !== providerId) {
    throw new Error("MCP OAuth provider callback mismatch.");
  }
  const transactionId = url.searchParams.get("transaction_id");
  if (!transactionId) throw new Error("MCP OAuth transaction is missing.");
  const completion = await loadAccessOAuthCompletion(userId, transactionId);
  if (!completion || completion.providerId !== providerId) {
    throw new Error("MCP OAuth transaction was not found.");
  }
  const error = url.searchParams.get("error");
  if (error || completion.status !== "completed") {
    throw new Error(error ?? "MCP OAuth authorization failed.");
  }
  if (!completion.connectionId) throw new Error("MCP connection was not created.");
  const connection = await findAccessConnection(userId, completion.connectionId);
  if (!connection) throw new Error("MCP connection was not found.");
  return connection;
}

export async function accessTokenForConnection(
  userId: string,
  connectionId: string
): Promise<string> {
  const connection = await findAccessConnection(userId, connectionId);
  if (!connection || connection.providerKind !== "mcp") {
    throw new ConnectorAuthRequiredError({
      connectorId: connection?.providerId ?? connectionId,
      connectorName: connection?.providerId ?? "Access provider",
      reason: "mcp_access_connection_missing"
    });
  }
  let credential;
  try {
    credential = await loadAccessConnectionCredential(userId, connectionId);
  } catch {
    await setAccessConnectionStatus(userId, connectionId, "action_required");
    throw new ConnectorAuthRequiredError({
      connectorId: connection.providerId,
      connectorName: connection.providerId,
      reason: "mcp_access_credential_decryption_failed"
    });
  }
  if (!credential) {
    await setAccessConnectionStatus(userId, connectionId, "action_required");
    throw new ConnectorAuthRequiredError({
      connectorId: connection.providerId,
      connectorName: connection.providerId,
      reason: "mcp_access_credential_missing"
    });
  }
  const expiresAt = new Date(credential.tokenExpiresAt).getTime();
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return credential.accessToken;
  }
  if (!credential.refreshToken) {
    await setAccessConnectionStatus(userId, connectionId, "action_required");
    throw new ConnectorAuthRequiredError({
      connectorId: connection.providerId,
      connectorName: connection.providerId,
      reason: "mcp_access_token_expired"
    });
  }

  const provider = await accessProviderForUser(userId, connection.providerId);
  if (!provider?.endpoint) throw new Error("mcp_provider_not_trusted");
  try {
    const metadata = await discoverMcpOAuthMetadata(provider);
    await assertSafeRemoteMcpUrlWithDns(metadata.tokenEndpoint);
    if (metadata.issuer) await assertSafeRemoteMcpUrlWithDns(metadata.issuer);
    if (metadata.resource) await assertSafeRemoteMcpUrlWithDns(metadata.resource);
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
      client_id: config.CIMD_CLIENT_IDENTITY_URL
    });
    const resource =
      typeof connection.metadata.resource === "string"
        ? connection.metadata.resource
        : metadata.resource;
    if (resource) body.set("resource", resource);
    const { response, body: raw } = await fetchRemoteMcp(metadata.tokenEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
    const token = parseJson(raw);
    if (!response.ok || typeof token.access_token !== "string") {
      throw new Error(String(token.error ?? `mcp_token_refresh_failed_${response.status}`));
    }
    validateTokenBinding(
      {
        issuer: stringValue(connection.metadata.issuer) ?? metadata.issuer,
        resource: stringValue(connection.metadata.resource) ?? metadata.resource
      },
      token
    );
    await storeAccessConnectionCredential({
      connectionId,
      accessToken: token.access_token,
      refreshToken:
        typeof token.refresh_token === "string"
          ? token.refresh_token
          : credential.refreshToken,
      tokenExpiresAt: new Date(Date.now() + (typeof token.expires_in === "number" ? token.expires_in : 3600) * 1000),
      scopes: parseScopes(token.scope).length > 0 ? parseScopes(token.scope) : credential.scopes,
      metadata: credential.metadata
    });
    await setAccessConnectionStatus(userId, connectionId, "connected");
    return token.access_token;
  } catch (error) {
    await setAccessConnectionStatus(userId, connectionId, "action_required");
    throw new ConnectorAuthRequiredError({
      connectorId: connection.providerId,
      connectorName: provider.displayName,
      reason: errorCode(error)
    });
  }
}

export function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

async function exchangeCode(
  transaction: Awaited<ReturnType<typeof loadAccessOAuthTransaction>> & NonNullable<unknown>,
  code: string
): Promise<McpTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: transaction.redirectUri,
    client_id: config.CIMD_CLIENT_IDENTITY_URL,
    code_verifier: transaction.codeVerifier
  });
  if (transaction.resource) body.set("resource", transaction.resource);
  const { response, body: raw } = await fetchRemoteMcp(transaction.tokenEndpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  const token = parseJson(raw);
  if (!response.ok || typeof token.access_token !== "string") {
    throw new Error(String(token.error ?? `mcp_token_exchange_failed_${response.status}`));
  }
  return {
    access_token: token.access_token,
    ...(typeof token.refresh_token === "string" ? { refresh_token: token.refresh_token } : {}),
    ...(typeof token.expires_in === "number" ? { expires_in: token.expires_in } : {}),
    ...(typeof token.scope === "string" ? { scope: token.scope } : {}),
    ...(typeof token.token_type === "string" ? { token_type: token.token_type } : {}),
    ...(typeof token.account_id === "string" ? { account_id: token.account_id } : {}),
    ...(typeof token.account_name === "string" ? { account_name: token.account_name } : {}),
    ...(typeof token.sub === "string" ? { sub: token.sub } : {}),
    ...(typeof token.iss === "string" ? { iss: token.iss } : {}),
    ...(typeof token.resource === "string" ? { resource: token.resource } : {})
  };
}

type McpTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  account_id?: string;
  account_name?: string;
  sub?: string;
  iss?: string;
  resource?: string;
};

function mobileAccessRedirect(callbackScheme: string, params: Record<string, string>): URL {
  return oauthCallbackRedirect({
    callbackScheme: sanitizeCallbackScheme(callbackScheme),
    nativePath: "access/oauth/callback",
    flow: "access",
    params
  });
}

function isAllowedCallbackUrl(url: URL): boolean {
  if (isAllowedWebOAuthCallback(url)) return true;
  return (
    (url.protocol === "sydney:" || url.protocol === `${config.MOBILE_AUTH_CALLBACK_SCHEME}:`) &&
    url.hostname === "access" &&
    url.pathname === "/oauth/callback"
  );
}

function sanitizeCallbackScheme(value: string): string {
  const scheme = value.trim();
  if (scheme === webOAuthCallbackScheme) {
    return sanitizeSupportedCallbackScheme(scheme);
  }
  if (
    !/^[a-z][a-z0-9+.-]*$/i.test(scheme) ||
    scheme.toLowerCase() !== config.MOBILE_AUTH_CALLBACK_SCHEME.toLowerCase()
  ) {
    throw new Error("Invalid callback scheme.");
  }
  return config.MOBILE_AUTH_CALLBACK_SCHEME;
}

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function parseScopes(value: unknown): string[] {
  return typeof value === "string"
    ? value.split(/[\s,]+/).map((scope) => scope.trim()).filter(Boolean)
    : [];
}

function parseJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function errorCode(error: unknown): string {
  if (error instanceof ConnectorAuthRequiredError) return error.reason;
  return safeOAuthError(error instanceof Error ? error.message : "mcp_oauth_failed");
}

function safeOAuthError(value: string): string {
  return value.replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, 160) || "mcp_oauth_failed";
}

export function validateTokenBinding(
  transaction: { issuer?: string; resource?: string },
  token: { iss?: string; resource?: string }
): void {
  if (transaction.issuer && token.iss && !sameUrl(transaction.issuer, token.iss)) {
    throw new Error("mcp_token_issuer_mismatch");
  }
  if (transaction.resource && token.resource && token.resource !== transaction.resource) {
    throw new Error("mcp_token_resource_mismatch");
  }
}

function sameUrl(left: string, right: string): boolean {
  try {
    return normalizeUrl(left) === normalizeUrl(right);
  } catch {
    return false;
  }
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  return url.toString().replace(/\/$/, "");
}

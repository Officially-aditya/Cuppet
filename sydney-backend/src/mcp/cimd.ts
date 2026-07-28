import { config } from "../config.js";

export function mcpOAuthCallbackUrl(): string {
  const callback =
    config.MCP_OAUTH_CALLBACK_URL ??
    new URL("/access/oauth/callback", config.AUTH_BASE_URL).toString();
  if (config.NODE_ENV === "production" && !callback.startsWith("https://")) {
    throw new Error("MCP OAuth callback must use HTTPS in production.");
  }
  return callback;
}

export function cimdClientMetadata(): Record<string, unknown> {
  return {
    client_id: config.CIMD_CLIENT_IDENTITY_URL,
    client_name: "Cuppet",
    client_uri: config.AUTH_BASE_URL,
    redirect_uris: [mcpOAuthCallbackUrl()],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: "mcp"
  };
}

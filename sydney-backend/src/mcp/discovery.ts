import type { AccessProvider } from "../access/types.js";
import { fetchRemoteMcp } from "./security.js";

export type OAuthServerMetadata = {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  scopes_supported?: string[];
  code_challenge_methods_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
};

export type ProtectedResourceMetadata = {
  resource?: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
};

export async function discoverMcpOAuthMetadata(
  provider: AccessProvider
): Promise<{
  authorizationEndpoint: string;
  tokenEndpoint: string;
  issuer?: string;
  resource?: string;
  scopes: string[];
}> {
  if (provider.kind !== "mcp" || !provider.endpoint) {
    throw new Error("MCP provider endpoint is missing.");
  }

  const configured = provider.oauth;
  if (configured?.authorizationEndpoint && configured.tokenEndpoint) {
    return {
      authorizationEndpoint: configured.authorizationEndpoint,
      tokenEndpoint: configured.tokenEndpoint,
      ...(configured.issuer ? { issuer: configured.issuer } : {}),
      ...(configured.resource ? { resource: configured.resource } : {}),
      scopes: configured.scopes
    };
  }

  const endpoint = new URL(provider.endpoint);
  const resourceMetadata = await tryJson<ProtectedResourceMetadata>(
    new URL("/.well-known/oauth-protected-resource", endpoint.origin)
  );
  const resource = resourceMetadata?.resource ?? configured?.resource ?? provider.endpoint;
  const authorizationServers = resourceMetadata?.authorization_servers ?? [];
  const issuerCandidates = [
    ...authorizationServers,
    configured?.issuer,
    endpoint.origin
  ].filter((value): value is string => Boolean(value));

  let metadata: OAuthServerMetadata | null = null;
  for (const issuer of issuerCandidates) {
    const issuerUrl = new URL(issuer);
    metadata =
      (await tryJson<OAuthServerMetadata>(
        new URL("/.well-known/oauth-authorization-server", issuerUrl.origin)
      )) ??
      (await tryJson<OAuthServerMetadata>(
        new URL("/.well-known/openid-configuration", issuerUrl.origin)
      ));
    if (metadata?.authorization_endpoint && metadata.token_endpoint) break;
  }

  if (!metadata?.authorization_endpoint || !metadata.token_endpoint) {
    throw new Error("MCP OAuth metadata is incomplete.");
  }
  return {
    authorizationEndpoint: metadata.authorization_endpoint,
    tokenEndpoint: metadata.token_endpoint,
    ...(metadata.issuer ? { issuer: metadata.issuer } : {}),
    resource,
    scopes: configured?.scopes.length
      ? configured.scopes
      : resourceMetadata?.scopes_supported ?? metadata.scopes_supported ?? ["mcp"]
  };
}

async function tryJson<T>(url: URL): Promise<T | null> {
  try {
    const { response, body } = await fetchRemoteMcp(url, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

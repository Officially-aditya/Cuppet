import {
  accessProviderByIdOrConnector,
  accessProviderForUser,
  listTrustedMcpProviders
} from "./provider-directory.js";
import { listCustomMcpProviders } from "./custom-providers.js";
import { disconnectAccessProvider, listAccessConnections } from "./repository.js";

export async function genericConnectorPayloads(userId: string) {
  const connections = await listAccessConnections(userId);
  const connectionsByProvider = new Map(
    connections
      .filter((connection) => connection.providerKind === "mcp")
      .map((connection) => [connection.providerId, connection] as const)
  );

  const providers = [
    ...listTrustedMcpProviders(),
    ...(await listCustomMcpProviders(userId))
  ];
  return providers.map((provider) => {
    const connection = connectionsByProvider.get(provider.providerId);
    return {
      id: provider.providerId,
      provider_id: provider.providerId,
      ...(connection ? { connection_id: connection.id } : {}),
      name: provider.displayName,
      description: provider.description,
      icon_name: provider.iconName,
      category: provider.category,
      required_scopes: provider.oauth?.scopes ?? [],
      auth_configured: true,
      auth_method: "oauth2",
      status: connection?.status ?? "disconnected",
      ...(connection?.accountLabel
        ? { account_label: connection.accountLabel }
        : {})
    };
  });
}

export function trustedMcpProviderForConnector(connectorId: string) {
  const provider = accessProviderByIdOrConnector(connectorId);
  return provider?.kind === "mcp" ? provider : null;
}

export async function mcpProviderForUser(
  userId: string,
  connectorId: string
) {
  const provider = await accessProviderForUser(userId, connectorId);
  return provider?.kind === "mcp" ? provider : null;
}

export async function disconnectGenericConnector(
  userId: string,
  connectorId: string
): Promise<void> {
  const provider = await mcpProviderForUser(userId, connectorId);
  if (!provider) throw new Error("mcp_provider_not_trusted");
  await disconnectAccessProvider(userId, provider.providerId);
}

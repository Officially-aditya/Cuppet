import { accessProviderByIdOrConnector } from "./provider-directory.js";
import { disconnectAccessProvider, listAccessConnections } from "./repository.js";

export async function genericConnectorPayloads(userId: string) {
  const connections = await listAccessConnections(userId);
  return connections.flatMap((connection) => {
    if (connection.providerKind !== "mcp") return [];
    const provider = accessProviderByIdOrConnector(connection.providerId);
    if (!provider) return [];
    return [{
      id: provider.providerId,
      provider_id: provider.providerId,
      connection_id: connection.id,
      name: provider.displayName,
      description: provider.description,
      icon_name: provider.iconName,
      category: provider.category,
      required_scopes: provider.oauth?.scopes ?? [],
      auth_configured: true,
      auth_method: "oauth2",
      status: connection.status,
      account_label: connection.accountLabel
    }];
  });
}

export function trustedMcpProviderForConnector(connectorId: string) {
  const provider = accessProviderByIdOrConnector(connectorId);
  return provider?.kind === "mcp" ? provider : null;
}

export async function disconnectGenericConnector(
  userId: string,
  connectorId: string
): Promise<void> {
  const provider = trustedMcpProviderForConnector(connectorId);
  if (!provider) throw new Error("mcp_provider_not_trusted");
  await disconnectAccessProvider(userId, provider.providerId);
}

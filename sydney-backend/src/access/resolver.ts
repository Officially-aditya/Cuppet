import { nativeConnectionFor } from "./native-adapters.js";
import {
  listMcpProvidersForUser,
  listNativeAccessProviders
} from "./provider-directory.js";
import { findAccessConnection, findConnectedAccessConnection } from "./repository.js";
import {
  type AccessProvider,
  type AccessRequirement,
  type AccessResolution,
  type AccessResolutionItem,
  providerSupportsRequirement
} from "./types.js";

export async function resolveAccess(
  userId: string,
  requirements: AccessRequirement[]
): Promise<AccessResolution> {
  const items: AccessResolutionItem[] = [];
  const mcpProviders = await listMcpProvidersForUser(userId);
  for (const requirement of requirements) {
    const nativeCandidates = listNativeAccessProviders().filter((provider) =>
      providerSupportsRequirement(provider, requirement)
    );
    const mcpCandidates = mcpProviders.filter((provider) =>
      providerSupportsRequirement(provider, requirement)
    );
    const candidates = preferredCandidates(requirement, [
      ...nativeCandidates,
      ...mcpCandidates
    ]);

    let connectedProvider: AccessProvider | undefined;
    let connectedConnection: Awaited<ReturnType<typeof findConnectedAccessConnection>> = null;
    for (const provider of candidates) {
      const nativeConnection = await nativeConnectionFor(userId, provider);
      if (nativeConnection?.status === "connected") {
        connectedProvider = provider;
        connectedConnection = nativeConnection;
        break;
      }
      if (provider.kind === "mcp") {
        const connection = await findConnectedAccessConnection(userId, provider.providerId);
        if (connection) {
          connectedProvider = provider;
          connectedConnection = connection;
          break;
        }
      }
    }

    if (connectedProvider && connectedConnection) {
      items.push({
        requirement,
        status: "connected",
        provider: connectedProvider,
        connection: connectedConnection,
        alternatives: candidates.filter((candidate) => candidate.providerId !== connectedProvider!.providerId)
      });
      continue;
    }

    items.push({
      requirement,
      status: candidates.length > 0 ? "needs_connection" : "unsupported",
      ...(candidates[0] ? { provider: candidates[0] } : {}),
      alternatives: candidates.slice(1)
    });
  }

  const missing = items
    .filter((item) => item.status !== "connected" && item.requirement.required)
    .map((item) => item.requirement);
  return {
    status:
      items.some((item) => item.status === "unsupported" && item.requirement.required)
        ? "unsupported"
        : missing.length > 0
          ? "needs_connection"
          : "connected",
    items,
    missing
  };
}

function preferredCandidates(
  requirement: AccessRequirement,
  candidates: AccessProvider[]
): AccessProvider[] {
  const preferred = new Set(requirement.preferred_provider_ids);
  return candidates
    .map((provider, index) => ({
      provider,
      index,
      preferred: preferred.has(provider.providerId),
      native: provider.kind === "native"
    }))
    .sort((left, right) => {
      if (left.native !== right.native) return left.native ? -1 : 1;
      if (left.preferred !== right.preferred) return left.preferred ? -1 : 1;
      return left.index - right.index;
    })
    .map((item) => item.provider);
}

export async function resolveAccessForConnection(
  userId: string,
  connectionId: string
): Promise<Awaited<ReturnType<typeof resolveAccess>>> {
  const connection = await findAccessConnection(userId, connectionId);
  if (!connection || connection.status !== "connected") {
    return { status: "needs_connection", items: [], missing: [] };
  }
  return resolveAccess(userId, connection.capabilities.map((key) => {
    const [service, capability] = key.split(".", 2);
    return {
      service: service ?? key,
      capabilities: [capability ?? "read"],
      required: true,
      preferred_provider_ids: [connection.providerId]
    };
  }));
}

import { ConnectorAuthRequiredError } from "../connectors/errors.js";
import { accessTokenForConnection } from "../access/oauth.js";
import { accessProviderByIdOrConnector } from "../access/provider-directory.js";
import {
  findConnectedAccessConnection,
  listMcpToolSnapshots
} from "../access/repository.js";
import { McpHttpClient } from "./client.js";

export class McpGateway {
  async callApprovedReadTool(input: {
    userId: string;
    providerId: string;
    query: string;
  }): Promise<{
    providerId: string;
    providerName: string;
    connectionId: string;
    toolName: string;
    result: Record<string, unknown>;
  }> {
    const provider = accessProviderByIdOrConnector(input.providerId);
    if (!provider || provider.kind !== "mcp" || !provider.endpoint) {
      throw new Error("mcp_provider_not_trusted");
    }
    const connection = await findConnectedAccessConnection(
      input.userId,
      provider.providerId
    );
    if (!connection) {
      throw new ConnectorAuthRequiredError({
        connectorId: provider.providerId,
        connectorName: provider.displayName,
        reason: "mcp_access_not_connected"
      });
    }
    const snapshots = await listMcpToolSnapshots(input.userId, connection.id);
    const tool = snapshots.find((candidate) =>
      /^(get|list|search|read|fetch|query|find|lookup|retrieve|describe|inspect)(?:$|[_.:-])/i.test(candidate.name) &&
      !/(create|delete|destroy|update|write|send|post|put|patch|remove|execute|run|invite|grant|revoke)/i.test(candidate.name)
    );
    if (!tool) throw new Error("mcp_no_read_tool");

    const client = new McpHttpClient({
      endpoint: provider.endpoint,
      accessToken: await accessTokenForConnection(input.userId, connection.id),
      allowedTools: provider.allowedTools
    });
    return {
      providerId: provider.providerId,
      providerName: provider.displayName,
      connectionId: connection.id,
      toolName: tool.name,
      result: await client.callTool(tool.name, {
        query: input.query.trim().slice(0, 240)
      })
    };
  }
}

export const mcpGateway = new McpGateway();

import type { FastifyInstance, FastifyReply } from "fastify";
import { requireAuth } from "../auth/middleware.js";
import { pool } from "../db/index.js";

type ConnectorDefinition = {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  required_scopes: string[];
  auth_configured: boolean;
};

const connectors: ConnectorDefinition[] = [
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the web without a user login",
    icon_name: "search",
    required_scopes: [],
    auth_configured: true
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Read email metadata and prepare summaries",
    icon_name: "mail",
    required_scopes: ["Read selected email metadata", "Draft replies"],
    auth_configured: false
  },
  {
    id: "slack",
    name: "Slack",
    description: "Read selected channels and prepare updates",
    icon_name: "tag",
    required_scopes: ["Read selected channels", "Post drafts for approval"],
    auth_configured: false
  },
  {
    id: "drive",
    name: "Google Drive",
    description: "Read selected files and summarize documents",
    icon_name: "file-text",
    required_scopes: ["Read selected files"],
    auth_configured: false
  }
];

export async function connectorRoutes(app: FastifyInstance): Promise<void> {
  app.get("/connectors", { preHandler: requireAuth }, async (request) => {
    const statuses = await connectorStatuses(request.auth!.userId);

    return connectors.map((connector) => ({
      id: connector.id,
      name: connector.name,
      description: connector.description,
      icon_name: connector.icon_name,
      required_scopes: connector.required_scopes,
      status:
        connector.id === "web_search"
          ? "connected"
          : statuses.get(connector.id) ?? "disconnected",
      auth_configured: connector.auth_configured
    }));
  });

  app.post(
    "/connectors/:connectorId/oauth/start",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { connectorId } = request.params as { connectorId: string };
      const connector = connectorById(connectorId);
      if (!connector) {
        return connectorNotFound(reply);
      }

      return reply.code(501).send({
        error: {
          code: "CONNECTOR_OAUTH_NOT_CONFIGURED",
          message:
            "Connector OAuth is not wired yet. Tokens will stay backend-owned once this connector is enabled.",
          connector_id: connector.id
        }
      });
    }
  );

  app.post(
    "/connectors/:connectorId/oauth/complete",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { connectorId } = request.params as { connectorId: string };
      const connector = connectorById(connectorId);
      if (!connector) {
        return connectorNotFound(reply);
      }

      return reply.code(501).send({
        error: {
          code: "CONNECTOR_OAUTH_NOT_CONFIGURED",
          message:
            "Connector OAuth completion is not wired yet. No connector tokens were stored.",
          connector_id: connector.id
        }
      });
    }
  );
}

async function connectorStatuses(userId: string): Promise<Map<string, string>> {
  const { rows } = await pool.query<{
    connector_id: string;
    status: string;
  }>(
    `
      SELECT connector_id, status
      FROM connector_tokens
      WHERE user_id = $1
    `,
    [userId]
  );

  return new Map(rows.map((row) => [row.connector_id, row.status]));
}

function connectorById(connectorId: string): ConnectorDefinition | null {
  return connectors.find((connector) => connector.id === connectorId) ?? null;
}

function connectorNotFound(reply: FastifyReply) {
  return reply.code(404).send({
    error: {
      code: "CONNECTOR_NOT_FOUND",
      message: "Connector not found."
    }
  });
}

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { pool } from "../db/index.js";
import {
  createGoogleWorkspaceAuthUrl,
  googleWorkspaceAuthConfigured,
  handleGoogleWorkspaceOAuthCallback,
  hasUsableGoogleWorkspaceToken,
  isGoogleWorkspaceConnector,
  parseGoogleWorkspaceCallbackUrl
} from "./google-workspace.js";

type ConnectorDefinition = {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  required_scopes: string[];
  auth_configured: boolean;
};

export type ConnectorStatus =
  | "connected"
  | "disconnected"
  | "action_required";

const connectorStatusSchema = z.object({
  connected: z.boolean()
});

const oauthStartSchema = z.object({
  callbackScheme: z.string().trim().min(1).max(80).default("sydney")
});

const oauthCompleteSchema = z.object({
  callbackUrl: z.string().trim().min(1).max(2048)
});

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
    description: "Read approved Gmail context and prepare summaries",
    icon_name: "mail",
    required_scopes: ["Read Gmail messages and metadata"],
    auth_configured: googleWorkspaceAuthConfigured()
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
    required_scopes: ["Read Google Drive files"],
    auth_configured: googleWorkspaceAuthConfigured()
  }
];

export async function connectorRoutes(app: FastifyInstance): Promise<void> {
  app.get("/connectors/google/callback", async (request, reply) => {
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    try {
      const redirectUrl = await handleGoogleWorkspaceOAuthCallback(query);
      return reply.redirect(redirectUrl.toString());
    } catch (error) {
      request.log.warn({ error }, "Invalid Google Workspace OAuth callback");
      return reply.code(400).send({
        error: {
          code: "INVALID_CONNECTOR_OAUTH_CALLBACK",
          message: "Invalid Google Workspace OAuth callback."
        }
      });
    }
  });

  app.get("/connectors", { preHandler: requireAuth }, async (request) => {
    const statuses = await connectorStatuses(request.auth!.userId);

    return connectors.map((connector) =>
      connectorPayload(connector, connectorStatus(connector, statuses))
    );
  });

  app.post(
    "/connectors/:connectorId/status",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { connectorId } = request.params as { connectorId: string };
      const connector = connectorById(connectorId);
      if (!connector) {
        return connectorNotFound(reply);
      }

      const body = connectorStatusSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_CONNECTOR_STATUS",
            message:
              body.error.issues[0]?.message ?? "Invalid connector status."
          }
        });
      }

      const status: ConnectorStatus = body.data.connected
        ? "connected"
        : "disconnected";

      if (
        status === "connected" &&
        isGoogleWorkspaceConnector(connector.id) &&
        !(await hasUsableGoogleWorkspaceToken(request.auth!.userId, connector.id))
      ) {
        return reply.code(409).send({
          error: {
            code: "CONNECTOR_OAUTH_REQUIRED",
            message:
              "Google Workspace authorization is required before this connector can be marked connected.",
            connector_id: connector.id
          }
        });
      }

      await setConnectorStatus(request.auth!.userId, connector.id, status);
      return connectorPayload(connector, status);
    }
  );

  app.post(
    "/connectors/:connectorId/oauth/start",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { connectorId } = request.params as { connectorId: string };
      const connector = connectorById(connectorId);
      if (!connector) {
        return connectorNotFound(reply);
      }

      const body = oauthStartSchema.safeParse(request.body ?? {});
      if (!body.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_CONNECTOR_OAUTH_REQUEST",
            message:
              body.error.issues[0]?.message ?? "Invalid OAuth request."
          }
        });
      }

      if (isGoogleWorkspaceConnector(connector.id)) {
        if (!googleWorkspaceAuthConfigured()) {
          return connectorOAuthNotConfigured(reply, connector.id);
        }

        const session = await createGoogleWorkspaceAuthUrl({
          userId: request.auth!.userId,
          connectorId: connector.id,
          callbackScheme: body.data.callbackScheme
        });

        return {
          authUrl: session.authUrl,
          callbackScheme: session.callbackScheme
        };
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

      const body = oauthCompleteSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_CONNECTOR_OAUTH_CALLBACK",
            message:
              body.error.issues[0]?.message ?? "Invalid OAuth callback."
          }
        });
      }

      if (isGoogleWorkspaceConnector(connector.id)) {
        try {
          const callback = parseGoogleWorkspaceCallbackUrl(body.data.callbackUrl);
          if (callback.connectorId !== connector.id) {
            return reply.code(400).send({
              error: {
                code: "CONNECTOR_CALLBACK_MISMATCH",
                message: "The OAuth callback does not match this connector.",
                connector_id: connector.id
              }
            });
          }

          if (callback.error) {
            return reply.code(400).send({
              error: {
                code: "CONNECTOR_OAUTH_FAILED",
                message: `Google Workspace authorization failed: ${callback.error}`,
                connector_id: connector.id
              }
            });
          }

          const statuses = await connectorStatuses(request.auth!.userId);
          return connectorPayload(connector, connectorStatus(connector, statuses));
        } catch (error) {
          return reply.code(400).send({
            error: {
              code: "INVALID_CONNECTOR_OAUTH_CALLBACK",
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid OAuth callback.",
              connector_id: connector.id
            }
          });
        }
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
  const [stateResult, tokenResult] = await Promise.all([
    pool.query<{
      connector_id: string;
      status: ConnectorStatus;
    }>(
      `
        SELECT connector_id, status
        FROM connector_statuses
        WHERE user_id = $1
      `,
      [userId]
    ),
    pool.query<{
      connector_id: string;
      status: ConnectorStatus;
    }>(
      `
        SELECT connector_id, status
        FROM connector_tokens
        WHERE user_id = $1
      `,
      [userId]
    )
  ]);

  const statuses = new Map<string, string>();
  const tokenBackedConnectors = new Set<string>();
  for (const row of tokenResult.rows) {
    statuses.set(row.connector_id, row.status);
    if (row.status === "connected") {
      tokenBackedConnectors.add(row.connector_id);
    }
  }
  for (const row of stateResult.rows) {
    if (
      isGoogleWorkspaceConnector(row.connector_id) &&
      row.status === "connected" &&
      !tokenBackedConnectors.has(row.connector_id)
    ) {
      statuses.set(row.connector_id, "disconnected");
      continue;
    }

    statuses.set(row.connector_id, row.status);
  }

  return statuses;
}

async function setConnectorStatus(
  userId: string,
  connectorId: string,
  status: ConnectorStatus
): Promise<void> {
  await pool.query(
    `
      INSERT INTO connector_statuses (user_id, connector_id, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, connector_id)
      DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
    `,
    [userId, connectorId, status]
  );

  await pool.query(
    `
      UPDATE connector_tokens
      SET status = $3, updated_at = NOW()
      WHERE user_id = $1 AND connector_id = $2
    `,
    [userId, connectorId, status]
  );
}

function connectorStatus(
  connector: ConnectorDefinition,
  statuses: Map<string, string>
): ConnectorStatus {
  const explicit = statuses.get(connector.id);
  if (
    explicit === "connected" ||
    explicit === "disconnected" ||
    explicit === "action_required"
  ) {
    return explicit;
  }

  return connector.id === "web_search" ? "connected" : "disconnected";
}

function connectorPayload(
  connector: ConnectorDefinition,
  status: ConnectorStatus
) {
  return {
    id: connector.id,
    name: connector.name,
    description: connector.description,
    icon_name: connector.icon_name,
    required_scopes: connector.required_scopes,
    status,
    auth_configured: connector.auth_configured
  };
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

function connectorOAuthNotConfigured(reply: FastifyReply, connectorId: string) {
  return reply.code(501).send({
    error: {
      code: "CONNECTOR_OAUTH_NOT_CONFIGURED",
      message:
        "Google Workspace OAuth is not configured on this backend. Set Google client credentials and redirect URI first.",
      connector_id: connectorId
    }
  });
}

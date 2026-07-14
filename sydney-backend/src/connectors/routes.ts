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
  googleScopesCoverConnector,
  parseGoogleWorkspaceCallbackUrl
} from "./google-workspace.js";
import {
  createGitHubAuthUrl,
  githubAuthConfigured,
  githubPrivateRepositoryAccessEnabled,
  handleGitHubInstallCallback,
  handleGitHubOAuthCallback,
  hasUsableGitHubToken,
  parseGitHubCallbackUrl
} from "./github.js";
import {
  createSlackAuthUrl,
  handleSlackOAuthCallback,
  hasUsableSlackToken,
  parseSlackCallbackUrl,
  slackAuthConfigured,
  slackScopesCoverReadAccess
} from "./slack.js";
import {
  createNotionAuthUrl,
  handleNotionOAuthCallback,
  hasUsableNotionToken,
  notionAuthConfigured,
  parseNotionCallbackUrl
} from "./notion.js";
import { callbackSchemeSchema } from "../security/input-validation.js";

type ConnectorDefinition = {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  category: string;
  required_scopes: string[];
  auth_configured: boolean;
};

export type ConnectorStatus =
  | "connected"
  | "disconnected"
  | "action_required";

const connectorStatusSchema = z
  .object({
    connected: z.boolean()
  })
  .strict();

const oauthStartSchema = z
  .object({
    callbackScheme: callbackSchemeSchema.default("sydney")
  })
  .strict();

const oauthCompleteSchema = z
  .object({
    callbackUrl: z.string().trim().url().max(2048)
  })
  .strict();

const connectors: ConnectorDefinition[] = [
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the web without a user login",
    icon_name: "search",
    category: "WEB & RESEARCH",
    required_scopes: [],
    auth_configured: true
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Read approved Gmail context and prepare summaries",
    icon_name: "Mail",
    category: "EMAIL & COMMUNICATION",
    required_scopes: ["Read Gmail messages and metadata"],
    auth_configured: googleWorkspaceAuthConfigured()
  },
  {
    id: "slack",
    name: "Slack",
    description: "Read selected channels and prepare updates",
    icon_name: "MessageSquare",
    category: "EMAIL & COMMUNICATION",
    required_scopes: ["Read channels where Cuppet is a member", "Read member names"],
    auth_configured: slackAuthConfigured()
  },
  {
    id: "drive",
    name: "Google Drive",
    description: "Read selected files and summarize documents",
    icon_name: "HardDrive",
    category: "PRODUCTIVITY & DOCS",
    required_scopes: ["Read Google Drive files"],
    auth_configured: googleWorkspaceAuthConfigured()
  },
  {
    id: "notion",
    name: "Notion",
    description: "Read selected workspace pages and summarize recent changes",
    icon_name: "BookOpen",
    category: "PRODUCTIVITY & DOCS",
    required_scopes: ["Read pages selected during Notion authorization"],
    auth_configured: notionAuthConfigured()
  },
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Read upcoming events and prepare agenda summaries",
    icon_name: "Calendar",
    category: "CALENDAR & SCHEDULING",
    required_scopes: [
      "View your calendar list",
      "Read upcoming calendar events"
    ],
    auth_configured: googleWorkspaceAuthConfigured()
  },
  {
    id: "github",
    name: "GitHub",
    description: "Monitor repositories, issues, and pull requests",
    icon_name: "Github",
    category: "DEVELOPER TOOLS",
    required_scopes: githubPrivateRepositoryAccessEnabled()
      ? ["Read GitHub profile", "Access public and private repositories"]
      : ["Read GitHub profile", "Read public repository activity"],
    auth_configured: githubAuthConfigured()
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

  app.get("/connectors/github/callback", async (request, reply) => {
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    try {
      const redirectUrl = await handleGitHubOAuthCallback(query);
      return reply.redirect(redirectUrl.toString());
    } catch (error) {
      request.log.warn({ error }, "Invalid GitHub OAuth callback");
      return reply.code(400).send({
        error: {
          code: "INVALID_CONNECTOR_OAUTH_CALLBACK",
          message: "Invalid GitHub OAuth callback."
        }
      });
    }
  });

  app.get("/connectors/github/install/callback", async (request, reply) => {
    const query = request.query as {
      installation_id?: string;
      setup_action?: string;
      state?: string;
    };

    try {
      const redirectUrl = await handleGitHubInstallCallback(query);
      return reply.redirect(redirectUrl.toString());
    } catch (error) {
      request.log.warn({ error }, "Invalid GitHub App installation callback");
      return reply.code(400).send({
        error: {
          code: "INVALID_GITHUB_APP_INSTALL_CALLBACK",
          message: "Invalid GitHub App installation callback."
        }
      });
    }
  });

  app.get("/connectors/slack/callback", async (request, reply) => {
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };
    try {
      const redirectUrl = await handleSlackOAuthCallback(query);
      return reply.redirect(redirectUrl.toString());
    } catch (error) {
      request.log.warn({ error }, "Invalid Slack OAuth callback");
      return reply.code(400).send({
        error: {
          code: "INVALID_CONNECTOR_OAUTH_CALLBACK",
          message: "Invalid Slack OAuth callback."
        }
      });
    }
  });

  app.get("/connectors/notion/callback", async (request, reply) => {
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };
    try {
      const redirectUrl = await handleNotionOAuthCallback(query);
      return reply.redirect(redirectUrl.toString());
    } catch (error) {
      request.log.warn({ error }, "Invalid Notion OAuth callback");
      return reply.code(400).send({
        error: {
          code: "INVALID_CONNECTOR_OAUTH_CALLBACK",
          message: "Invalid Notion OAuth callback."
        }
      });
    }
  });

  app.get("/connectors", { preHandler: requireAuth }, async (request) => {
    let statuses = new Map<string, string>();
    try {
      statuses = await connectorStatuses(request.auth!.userId);
    } catch (error) {
      request.log.error(
        { error, userId: request.auth!.userId },
        "Failed to load connector statuses"
      );
    }

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

      if (
        status === "connected" &&
        connector.id === "github" &&
        !(await hasUsableGitHubToken(request.auth!.userId))
      ) {
        return reply.code(409).send({
          error: {
            code: "CONNECTOR_OAUTH_REQUIRED",
            message:
              "GitHub authorization is required before this connector can be marked connected.",
            connector_id: connector.id
          }
        });
      }

      if (
        status === "connected" &&
        connector.id === "slack" &&
        !(await hasUsableSlackToken(request.auth!.userId))
      ) {
        return reply.code(409).send({
          error: {
            code: "CONNECTOR_OAUTH_REQUIRED",
            message:
              "Slack authorization is required before this connector can be marked connected.",
            connector_id: connector.id
          }
        });
      }

      if (
        status === "connected" &&
        connector.id === "notion" &&
        !(await hasUsableNotionToken(request.auth!.userId))
      ) {
        return reply.code(409).send({
          error: {
            code: "CONNECTOR_OAUTH_REQUIRED",
            message:
              "Notion authorization is required before this connector can be marked connected.",
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
          return connectorOAuthNotConfigured(reply, connector.id, "Google Workspace");
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

      if (connector.id === "github") {
        if (!githubAuthConfigured()) {
          return connectorOAuthNotConfigured(reply, connector.id, "GitHub");
        }

        const session = await createGitHubAuthUrl({
          userId: request.auth!.userId,
          callbackScheme: body.data.callbackScheme
        });
        return {
          authUrl: session.authUrl,
          callbackScheme: session.callbackScheme
        };
      }

      if (connector.id === "slack") {
        if (!slackAuthConfigured()) {
          return connectorOAuthNotConfigured(reply, connector.id, "Slack");
        }
        const session = await createSlackAuthUrl({
          userId: request.auth!.userId,
          callbackScheme: body.data.callbackScheme
        });
        return {
          authUrl: session.authUrl,
          callbackScheme: session.callbackScheme
        };
      }

      if (connector.id === "notion") {
        if (!notionAuthConfigured()) {
          return connectorOAuthNotConfigured(reply, connector.id, "Notion");
        }
        const session = await createNotionAuthUrl({
          userId: request.auth!.userId,
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

          return connectorPayload(connector, "connected");
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

      if (connector.id === "github") {
        try {
          const callback = parseGitHubCallbackUrl(body.data.callbackUrl);
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
                message: `GitHub authorization failed: ${callback.error}`,
                connector_id: connector.id
              }
            });
          }

          return connectorPayload(connector, "connected");
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

      if (connector.id === "slack") {
        try {
          const callback = parseSlackCallbackUrl(body.data.callbackUrl);
          if (callback.error) {
            return reply.code(400).send({
              error: {
                code: "CONNECTOR_OAUTH_FAILED",
                message: `Slack authorization failed: ${callback.error}`,
                connector_id: connector.id
              }
            });
          }
          return connectorPayload(connector, "connected");
        } catch (error) {
          return reply.code(400).send({
            error: {
              code: "INVALID_CONNECTOR_OAUTH_CALLBACK",
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid Slack callback.",
              connector_id: connector.id
            }
          });
        }
      }

      if (connector.id === "notion") {
        try {
          const callback = parseNotionCallbackUrl(body.data.callbackUrl);
          if (callback.error) {
            return reply.code(400).send({
              error: {
                code: "CONNECTOR_OAUTH_FAILED",
                message: `Notion authorization failed: ${callback.error}`,
                connector_id: connector.id
              }
            });
          }
          return connectorPayload(connector, "connected");
        } catch (error) {
          return reply.code(400).send({
            error: {
              code: "INVALID_CONNECTOR_OAUTH_CALLBACK",
              message:
                error instanceof Error
                  ? error.message
                  : "Invalid Notion callback.",
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
      scopes: string[];
    }>(
      `
        SELECT connector_id, status, scopes
        FROM connector_tokens
        WHERE user_id = $1
      `,
      [userId]
    )
  ]);

  const statuses = new Map<string, string>();
  const tokenBackedConnectors = new Set<string>();
  for (const row of tokenResult.rows) {
    if (
      row.status === "connected" &&
      isGoogleWorkspaceConnector(row.connector_id) &&
      !googleScopesCoverConnector(row.scopes ?? [], row.connector_id)
    ) {
      statuses.set(row.connector_id, "action_required");
      continue;
    }
    if (
      row.status === "connected" &&
      row.connector_id === "slack" &&
      !slackScopesCoverReadAccess(row.scopes ?? [])
    ) {
      statuses.set(row.connector_id, "action_required");
      continue;
    }
    statuses.set(row.connector_id, row.status);
    if (row.status === "connected") {
      tokenBackedConnectors.add(row.connector_id);
    }
  }
  for (const row of stateResult.rows) {
    if (
      isTokenBackedConnector(row.connector_id) &&
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
    category: connector.category,
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

function connectorOAuthNotConfigured(
  reply: FastifyReply,
  connectorId: string,
  providerName: string
) {
  return reply.code(501).send({
    error: {
      code: "CONNECTOR_OAUTH_NOT_CONFIGURED",
      message:
        `${providerName} OAuth is not configured on this backend. Set its client credentials and redirect URI first.`,
      connector_id: connectorId
    }
  });
}

function isTokenBackedConnector(connectorId: string): boolean {
  return (
    isGoogleWorkspaceConnector(connectorId) ||
    connectorId === "github" ||
    connectorId === "slack" ||
    connectorId === "notion"
  );
}

import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { cimdClientMetadata } from "../mcp/cimd.js";
import {
  completeMcpOAuth,
  handleMcpOAuthCallback,
  startMcpOAuth
} from "./oauth.js";
import { accessProviderByIdOrConnector } from "./provider-directory.js";
import {
  deleteAccessConnection,
  listAccessConnections
} from "./repository.js";
import { resolveAccess } from "./resolver.js";
import { accessRequirementSchema } from "./types.js";

const oauthStartSchema = z
  .object({ callbackScheme: z.string().trim().regex(/^[a-z][a-z0-9+.-]*$/i).default("sydney") })
  .strict();

const oauthCompleteSchema = z
  .object({ callbackUrl: z.string().trim().url().max(2048) })
  .strict();

const resolveSchema = z
  .object({ requirements: z.array(accessRequirementSchema).max(16) })
  .strict();

export async function accessRoutes(app: FastifyInstance): Promise<void> {
  app.get("/.well-known/oauth-client.json", async (_request, reply) => {
    return reply
      .header("Cache-Control", "public, max-age=300")
      .send(cimdClientMetadata());
  });

  app.get("/access/oauth/callback", async (request, reply) => {
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };
    const redirect = await handleMcpOAuthCallback(query);
    return reply.redirect(redirect.toString());
  });

  app.get("/access/connections", { preHandler: requireAuth }, async (request) => {
    const connections = await listAccessConnections(request.auth!.userId);
    return {
      connections: connections.map((connection) => ({
        id: connection.id,
        provider_id: connection.providerId,
        provider_kind: connection.providerKind,
        status: connection.status,
        account_label: connection.accountLabel,
        external_account_id: connection.externalAccountId,
        capabilities: connection.capabilities,
        metadata: connection.metadata,
        created_at: connection.createdAt,
        updated_at: connection.updatedAt
      }))
    };
  });

  app.post(
    "/access/providers/:providerId/oauth/start",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { providerId } = request.params as { providerId: string };
      const provider = accessProviderByIdOrConnector(providerId);
      if (!provider || provider.kind !== "mcp") return providerNotFound(reply);
      const body = oauthStartSchema.safeParse(request.body ?? {});
      if (!body.success) return invalidRequest(reply, body.error.issues[0]?.message);
      try {
        return await startMcpOAuth({
          userId: request.auth!.userId,
          providerId,
          callbackScheme: body.data.callbackScheme
        });
      } catch (error) {
        request.log.warn({ error, providerId }, "MCP OAuth start failed");
        return reply.code(400).send({
          error: {
            code: "MCP_OAUTH_START_FAILED",
            message: publicErrorMessage(error)
          }
        });
      }
    }
  );

  app.post(
    "/access/providers/:providerId/oauth/complete",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { providerId } = request.params as { providerId: string };
      const body = oauthCompleteSchema.safeParse(request.body);
      if (!body.success) return invalidRequest(reply, body.error.issues[0]?.message);
      try {
        const connection = await completeMcpOAuth(
          request.auth!.userId,
          providerId,
          body.data.callbackUrl
        );
        return connectionPayload(connection);
      } catch (error) {
        return reply.code(400).send({
          error: {
            code: "MCP_OAUTH_COMPLETE_FAILED",
            message: publicErrorMessage(error)
          }
        });
      }
    }
  );

  app.post("/access/resolve", { preHandler: requireAuth }, async (request, reply) => {
    const body = resolveSchema.safeParse(request.body);
    if (!body.success) return invalidRequest(reply, body.error.issues[0]?.message);
    const resolution = await resolveAccess(request.auth!.userId, body.data.requirements);
    return {
      status: resolution.status,
      missing: resolution.missing,
      items: resolution.items.map((item) => ({
        requirement: item.requirement,
        status: item.status,
        provider: item.provider ? providerPayload(item.provider) : undefined,
        connection: item.connection ? connectionPayload(item.connection) : undefined,
        alternatives: item.alternatives.map(providerPayload)
      }))
    };
  });

  app.delete(
    "/access/connections/:connectionId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { connectionId } = request.params as { connectionId: string };
      const deleted = await deleteAccessConnection(
        request.auth!.userId,
        connectionId
      );
      return deleted ? reply.code(204).send() : reply.code(404).send({
        error: { code: "ACCESS_CONNECTION_NOT_FOUND", message: "Access connection not found." }
      });
    }
  );
}

function providerNotFound(reply: FastifyReply) {
  return reply.code(404).send({
    error: { code: "ACCESS_PROVIDER_NOT_FOUND", message: "Access provider not found." }
  });
}

function invalidRequest(reply: FastifyReply, message?: string) {
  return reply.code(400).send({
    error: { code: "INVALID_ACCESS_REQUEST", message: message ?? "Invalid access request." }
  });
}

function providerPayload(provider: {
  providerId: string;
  kind: string;
  displayName: string;
  description: string;
  iconName: string;
  category: string;
  capabilities: string[];
}) {
  return {
    provider_id: provider.providerId,
    provider_kind: provider.kind,
    name: provider.displayName,
    description: provider.description,
    icon_name: provider.iconName,
    category: provider.category,
    capabilities: provider.capabilities
  };
}

function connectionPayload(connection: {
  id: string;
  providerId: string;
  providerKind: string;
  status: string;
  accountLabel?: string;
  externalAccountId?: string;
  capabilities: string[];
  metadata: Record<string, unknown>;
  createdAt: Date | string;
  updatedAt: Date | string;
}) {
  return {
    id: connection.id,
    provider_id: connection.providerId,
    provider_kind: connection.providerKind,
    status: connection.status,
    account_label: connection.accountLabel,
    external_account_id: connection.externalAccountId,
    capabilities: connection.capabilities,
    metadata: connection.metadata,
    created_at: connection.createdAt,
    updated_at: connection.updatedAt
  };
}

function publicErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Access request failed.";
  return message.replace(/[^a-z0-9_.:-]+/gi, " ").trim().slice(0, 240) || "Access request failed.";
}

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "../db/index.js";
import { isReadOnlyMcpScope } from "../mcp/discovery.js";
import { assertSafeRemoteMcpUrlWithDns } from "../mcp/security.js";
import type { AccessProvider } from "./types.js";

const capabilityName = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z][a-z0-9_.:-]*$/i)
  .refine(
    (value) =>
      !/(^|[_.:-])(write|create|delete|destroy|update|send|post|put|patch|remove|execute|run|invite|grant|revoke|mutat|action)(?:$|[_.:-])/i.test(
        value
      ),
    { message: "Custom MCP capabilities must be read-only." }
  );

export const customMcpProviderInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(240).default(""),
    icon_name: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_.:-]*$/i)
      .default("Extension"),
    category: z.string().trim().min(1).max(80).default("CUSTOM MCP"),
    endpoint: z.string().trim().url().max(2048),
    capabilities: z.array(capabilityName).min(1).max(16).default(["mcp.read"]),
    oauth_scopes: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(120)
          .refine(isReadOnlyMcpScope, {
            message: "Custom MCP OAuth scopes must be read-only."
          })
      )
      .max(32)
      .default([])
  })
  .strict();

export type CustomMcpProviderInput = z.infer<
  typeof customMcpProviderInputSchema
>;

export const customMcpProviderPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(240).optional(),
    icon_name: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_.:-]*$/i)
      .optional(),
    category: z.string().trim().min(1).max(80).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one provider field is required."
  });

export type CustomMcpProviderPatch = z.infer<
  typeof customMcpProviderPatchSchema
>;

export async function validateCustomMcpEndpoint(
  endpoint: string
): Promise<string> {
  return (await assertSafeRemoteMcpUrlWithDns(endpoint)).toString();
}

export async function createCustomMcpProvider(input: {
  userId: string;
  name: string;
  description: string;
  iconName: string;
  category: string;
  endpoint: string;
  capabilities: string[];
  oauthScopes: string[];
}): Promise<AccessProvider> {
  const providerId = `mcp.user.${randomUUID()}`;
  const { rows } = await pool.query<CustomMcpProviderRow>(
    `INSERT INTO user_mcp_providers
       (user_id, provider_id, display_name, description, icon_name, category,
        endpoint, capabilities, oauth_scopes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, user_id, provider_id, display_name, description, icon_name,
               category, endpoint, capabilities, allowed_tools, oauth_scopes,
               authorization_endpoint, token_endpoint, issuer, resource,
               created_at, updated_at`,
    [
      input.userId,
      providerId,
      input.name,
      input.description,
      input.iconName,
      input.category,
      input.endpoint,
      input.capabilities,
      input.oauthScopes
    ]
  );
  return toAccessProvider(rows[0]!);
}

export async function listCustomMcpProviders(
  userId: string
): Promise<AccessProvider[]> {
  const { rows } = await pool.query<CustomMcpProviderRow>(
    `SELECT id, user_id, provider_id, display_name, description, icon_name,
            category, endpoint, capabilities, allowed_tools, oauth_scopes,
            authorization_endpoint, token_endpoint, issuer, resource,
            created_at, updated_at
       FROM user_mcp_providers
      WHERE user_id = $1
      ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map(toAccessProvider);
}

export async function findCustomMcpProvider(
  userId: string,
  providerId: string
): Promise<AccessProvider | null> {
  const { rows } = await pool.query<CustomMcpProviderRow>(
    `SELECT id, user_id, provider_id, display_name, description, icon_name,
            category, endpoint, capabilities, allowed_tools, oauth_scopes,
            authorization_endpoint, token_endpoint, issuer, resource,
            created_at, updated_at
       FROM user_mcp_providers
      WHERE user_id = $1 AND provider_id = $2
      LIMIT 1`,
    [userId, providerId]
  );
  return rows[0] ? toAccessProvider(rows[0]) : null;
}

export async function updateCustomMcpProviderOAuthMetadata(input: {
  userId: string;
  providerId: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  issuer?: string;
  resource?: string;
  scopes: string[];
}): Promise<AccessProvider | null> {
  const { rows } = await pool.query<CustomMcpProviderRow>(
    `UPDATE user_mcp_providers
        SET authorization_endpoint = $3,
            token_endpoint = $4,
            issuer = $5,
            resource = $6,
            oauth_scopes = $7,
            updated_at = NOW()
      WHERE user_id = $1 AND provider_id = $2
      RETURNING id, user_id, provider_id, display_name, description, icon_name,
                category, endpoint, capabilities, allowed_tools, oauth_scopes,
                authorization_endpoint, token_endpoint, issuer, resource,
                created_at, updated_at`,
    [
      input.userId,
      input.providerId,
      input.authorizationEndpoint,
      input.tokenEndpoint,
      input.issuer ?? null,
      input.resource ?? null,
      input.scopes
    ]
  );
  return rows[0] ? toAccessProvider(rows[0]) : null;
}

export async function updateCustomMcpProviderMetadata(input: {
  userId: string;
  providerId: string;
  name?: string;
  description?: string;
  iconName?: string;
  category?: string;
}): Promise<AccessProvider | null> {
  const { rows } = await pool.query<CustomMcpProviderRow>(
    `UPDATE user_mcp_providers
        SET display_name = COALESCE($3, display_name),
            description = COALESCE($4, description),
            icon_name = COALESCE($5, icon_name),
            category = COALESCE($6, category),
            updated_at = NOW()
      WHERE user_id = $1 AND provider_id = $2
      RETURNING id, user_id, provider_id, display_name, description, icon_name,
                category, endpoint, capabilities, allowed_tools, oauth_scopes,
                authorization_endpoint, token_endpoint, issuer, resource,
                created_at, updated_at`,
    [
      input.userId,
      input.providerId,
      input.name ?? null,
      input.description ?? null,
      input.iconName ?? null,
      input.category ?? null
    ]
  );
  return rows[0] ? toAccessProvider(rows[0]) : null;
}

export async function updateCustomMcpProviderAllowedTools(input: {
  userId: string;
  providerId: string;
  allowedTools: string[];
}): Promise<void> {
  await pool.query(
    `UPDATE user_mcp_providers
        SET allowed_tools = $3,
            updated_at = NOW()
      WHERE user_id = $1 AND provider_id = $2`,
    [input.userId, input.providerId, input.allowedTools]
  );
}

export async function deleteCustomMcpProvider(
  userId: string,
  providerId: string
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const provider = await client.query(
      `SELECT 1 FROM user_mcp_providers
        WHERE user_id = $1 AND provider_id = $2
        FOR UPDATE`,
      [userId, providerId]
    );
    if (provider.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      `DELETE FROM access_oauth_transactions
        WHERE user_id = $1 AND provider_id = $2`,
      [userId, providerId]
    );
    await client.query(
      `DELETE FROM access_connections
        WHERE user_id = $1 AND provider_id = $2`,
      [userId, providerId]
    );
    const result = await client.query(
      `DELETE FROM user_mcp_providers
        WHERE user_id = $1 AND provider_id = $2`,
      [userId, providerId]
    );
    await client.query("COMMIT");
    return result.rowCount === 1;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

type CustomMcpProviderRow = {
  id: string;
  user_id: string;
  provider_id: string;
  display_name: string;
  description: string;
  icon_name: string;
  category: string;
  endpoint: string;
  capabilities: string[];
  allowed_tools: string[];
  oauth_scopes: string[];
  authorization_endpoint: string | null;
  token_endpoint: string | null;
  issuer: string | null;
  resource: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toAccessProvider(row: CustomMcpProviderRow): AccessProvider {
  return {
    providerId: row.provider_id,
    ownerUserId: row.user_id,
    kind: "mcp",
    displayName: row.display_name,
    description: row.description,
    iconName: row.icon_name,
    category: row.category,
    capabilities: row.capabilities ?? [],
    authMethods: ["oauth2"],
    trusted: false,
    endpoint: row.endpoint,
    ...(row.allowed_tools?.length
      ? { allowedTools: row.allowed_tools }
      : {}),
    oauth: {
      ...(row.authorization_endpoint
        ? { authorizationEndpoint: row.authorization_endpoint }
        : {}),
      ...(row.token_endpoint ? { tokenEndpoint: row.token_endpoint } : {}),
      ...(row.issuer ? { issuer: row.issuer } : {}),
      ...(row.resource ? { resource: row.resource } : {}),
      scopes: row.oauth_scopes ?? []
    }
  };
}

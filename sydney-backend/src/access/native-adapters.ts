import { pool } from "../db/index.js";
import type { AccessConnection, AccessProvider } from "./types.js";

export async function nativeConnectionFor(
  userId: string,
  provider: AccessProvider
): Promise<AccessConnection | null> {
  if (provider.kind !== "native" || !provider.connectorId) return null;
  if (provider.connectorId === "web_search") {
    return {
      id: `native:${provider.connectorId}:${userId}`,
      userId,
      providerId: provider.providerId,
      providerKind: "native",
      status: "connected",
      capabilities: provider.capabilities,
      metadata: {},
      createdAt: new Date(0),
      updatedAt: new Date(0)
    };
  }

  const { rows } = await pool.query<{
    connector_id: string;
    status: "connected" | "disconnected" | "action_required";
  }>(
    `SELECT connector_id, status
       FROM (
         SELECT connector_id, status, updated_at
           FROM connector_tokens
          WHERE user_id = $1 AND connector_id = $2
         UNION ALL
         SELECT connector_id, status, updated_at
           FROM connector_statuses
          WHERE user_id = $1 AND connector_id = $2
       ) statuses
      ORDER BY updated_at DESC
      LIMIT 1`,
    [userId, provider.connectorId]
  );
  const status = rows[0]?.status;
  if (!status) return null;
  return {
    id: `native:${provider.connectorId}:${userId}`,
    userId,
    providerId: provider.providerId,
    providerKind: "native",
    status,
    capabilities: provider.capabilities,
    metadata: {},
    createdAt: new Date(0),
    updatedAt: new Date(0)
  };
}

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { pool } from "../db/index.js";

export type GooglePushConnector = "calendar" | "drive";

export function createGooglePushChannel(input: {
  connectorId: GooglePushConnector;
  userId: string;
}): {
  id: string;
  token: string;
  type: "web_hook";
  address: string;
  expiration: string;
} {
  const id = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const baseUrl = config.AUTH_BASE_URL.replace(/\/$/, "");
  return {
    id,
    token,
    type: "web_hook",
    address: `${baseUrl}/events/google/${input.connectorId}`,
    expiration: String(Date.now() + 6 * 24 * 60 * 60 * 1000)
  };
}

export async function storeGooglePushSubscription(input: {
  userId: string;
  connectorId: GooglePushConnector;
  channelId: string;
  channelToken: string;
  resourceId?: string;
  resourceUri?: string;
  expiration: string | number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const expiresAt = new Date(Number(input.expiration));
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error("invalid_google_channel_expiration");
  }
  await pool.query(
    `
      INSERT INTO provider_subscriptions
        (user_id, connector_id, channel_id, channel_token_hash,
         resource_id, resource_uri, expires_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (channel_id)
      DO UPDATE SET
        resource_id = EXCLUDED.resource_id,
        resource_uri = EXCLUDED.resource_uri,
        expires_at = EXCLUDED.expires_at,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
    [
      input.userId,
      input.connectorId,
      input.channelId,
      tokenHash(input.channelToken),
      input.resourceId ?? null,
      input.resourceUri ?? null,
      expiresAt,
      JSON.stringify(input.metadata ?? {})
    ]
  );
}

export async function verifiedGoogleSubscription(input: {
  connectorId: GooglePushConnector;
  channelId: string;
  channelToken: string;
}): Promise<{
  userId: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
} | null> {
  const { rows } = await pool.query<{
    user_id: string;
    channel_token_hash: string;
    resource_id: string | null;
    metadata: Record<string, unknown> | string;
  }>(
    `
      SELECT user_id, channel_token_hash, resource_id, metadata
      FROM provider_subscriptions
      WHERE connector_id = $1
        AND channel_id = $2
        AND expires_at > NOW()
    `,
    [input.connectorId, input.channelId]
  );
  const row = rows[0];
  if (!row || !safeHashEqual(row.channel_token_hash, tokenHash(input.channelToken))) {
    return null;
  }
  return {
    userId: row.user_id,
    resourceId: row.resource_id ?? undefined,
    metadata:
      typeof row.metadata === "string"
        ? (JSON.parse(row.metadata) as Record<string, unknown>)
        : row.metadata
  };
}

function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeHashEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

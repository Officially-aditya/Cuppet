import { createHash, randomBytes } from "node:crypto";
import { pool } from "../db/index.js";

export type BrowserConnection = {
  id: string;
  connected_at: Date | string;
  expires_at: Date | string;
  token?: string;
};

export async function createBrowserConnection(userId: string): Promise<BrowserConnection> {
  const token = `cup_browser_${randomBytes(32).toString("base64url")}`;
  const tokenHash = hashBrowserToken(token);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE personalization_browser_connections
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    const { rows } = await client.query<BrowserConnection>(
      `INSERT INTO personalization_browser_connections (user_id, token_hash)
       VALUES ($1, $2)
       RETURNING id, connected_at, expires_at`,
      [userId, tokenHash]
    );
    await client.query("COMMIT");
    return { ...rows[0]!, token };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeBrowserConnection(userId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE personalization_browser_connections
     SET revoked_at = COALESCE(revoked_at, NOW())
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function hasBrowserConnection(userId: string): Promise<boolean> {
  const { rows } = await pool.query(
      `SELECT 1 FROM personalization_browser_connections
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
      LIMIT 1`,
    [userId]
  );
  return Boolean(rows[0]);
}

export async function userIdForBrowserToken(token: string): Promise<string | null> {
  const normalized = token.trim();
  if (normalized.length < 32 || normalized.length > 160) return null;
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT user_id
      FROM personalization_browser_connections
      WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
      LIMIT 1`,
    [hashBrowserToken(normalized)]
  );
  const userId = rows[0]?.user_id ?? null;
  if (userId) {
    await pool.query(
      `UPDATE personalization_browser_connections
       SET last_used_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashBrowserToken(normalized)]
    );
  }
  return userId;
}

function hashBrowserToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

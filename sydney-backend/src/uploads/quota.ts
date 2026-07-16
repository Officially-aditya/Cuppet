import { config } from "../config.js";
import { pool } from "../db/index.js";

export type UploadQuotaUsage = {
  activeFiles: number;
  activeBytes: number;
};

export type UploadQuotaLimits = {
  maxFiles: number;
  maxBytes: number;
};

export type UploadedFileRow = {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  created_at: Date | string;
  expires_at: Date | string;
};

export class UploadQuotaError extends Error {
  readonly code = "UPLOAD_QUOTA_EXCEEDED";

  constructor(
    readonly usage: UploadQuotaUsage,
    readonly limits: UploadQuotaLimits
  ) {
    super("Your temporary upload quota is full. Try again after existing uploads expire.");
    this.name = "UploadQuotaError";
  }
}

export function uploadQuotaExceeded(
  usage: UploadQuotaUsage,
  incomingBytes: number,
  limits: UploadQuotaLimits
): boolean {
  return (
    usage.activeFiles + 1 > limits.maxFiles ||
    usage.activeBytes + incomingBytes > limits.maxBytes
  );
}

export async function storeTemporaryUpload(input: {
  userId: string;
  name: string;
  mimeType: string;
  data: Buffer;
}): Promise<UploadedFileRow> {
  const limits: UploadQuotaLimits = {
    maxFiles: config.USER_ACTIVE_UPLOAD_FILE_LIMIT,
    maxBytes: config.USER_ACTIVE_UPLOAD_BYTES_MB * 1024 * 1024
  };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext('uploaded_files'))",
      [input.userId]
    );
    await client.query(
      "DELETE FROM uploaded_files WHERE user_id = $1 AND expires_at <= NOW()",
      [input.userId]
    );
    const { rows: usageRows } = await client.query<{
      active_files: number;
      active_bytes: string;
    }>(
      `SELECT COUNT(*)::int AS active_files,
              COALESCE(SUM(size), 0)::bigint AS active_bytes
       FROM uploaded_files
       WHERE user_id = $1 AND expires_at > NOW()`,
      [input.userId]
    );
    const usage: UploadQuotaUsage = {
      activeFiles: usageRows[0]?.active_files ?? 0,
      activeBytes: Number(usageRows[0]?.active_bytes ?? 0)
    };
    if (uploadQuotaExceeded(usage, input.data.length, limits)) {
      throw new UploadQuotaError(usage, limits);
    }

    const { rows } = await client.query<UploadedFileRow>(
      `INSERT INTO uploaded_files (user_id, name, mime_type, data, size)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, mime_type, size, created_at, expires_at`,
      [input.userId, input.name, input.mimeType, input.data, input.data.length]
    );
    await client.query("COMMIT");
    return rows[0]!;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

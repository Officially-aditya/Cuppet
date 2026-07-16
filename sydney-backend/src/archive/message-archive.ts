import { createHash, createHmac } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { config } from "../config.js";
import { createMessageArchiveAuthUrl, googleAccessToken, messageArchiveDriveScope } from "../connectors/google-workspace.js";
import { pool } from "../db/index.js";

const driveApiBase = "https://www.googleapis.com/drive/v3";
const driveUploadBase = "https://www.googleapis.com/upload/drive/v3";
export const archiveShardMaxBytes = 8 * 1024 * 1024;
const maxArchiveReadFiles = 3;

const archiveHeaderSchema = z.object({
  type: z.literal("cuppet_message_archive"),
  schema_version: z.literal(1),
  agent_id: z.string().uuid(),
  agent_name: z.string().min(1).max(300),
  message_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  part: z.number().int().positive()
}).strict();

const archiveMessageSchema = z.object({
  type: z.literal("message"),
  message_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  agent_name: z.string().min(1).max(300),
  role: z.enum(["agent", "user", "system"]),
  timestamp: z.string().datetime(),
  template: z.string().min(1).max(100),
  content: z.record(z.unknown()),
  source_links: z.array(z.object({
    label: z.string().min(1).max(200),
    url: z.string().url().refine((url) => /^https:\/\//i.test(url)),
    source: z.string().max(100).optional()
  }).strict()).max(12),
  attachments: z.array(z.object({
    filename: z.string().min(1).max(500),
    mime_type: z.string().min(1).max(200),
    size: z.number().int().nonnegative()
  }).strict()).max(20)
}).strict();

export type ArchivedMessageRecord = z.infer<typeof archiveMessageSchema>;

type ArchiveSourceRow = {
  id: string;
  agent_id: string;
  agent_name: string;
  role: "agent" | "user" | "system";
  content: Record<string, unknown>;
  source_refs: unknown;
  created_at: Date | string;
  attachments: unknown;
};

type ArchiveBatchRow = {
  id: string;
  user_id: string;
  agent_id: string;
  message_date: string;
  part: number;
  stable_key: string;
  drive_file_id: string | null;
  drive_file_name: string;
  checksum: string;
  status: string;
};

export type MessageArchiveState = {
  enabled: boolean;
  status: string;
  folder_link: string | null;
  last_success_at: Date | string | null;
  error_code: string | null;
  action_required: boolean;
};

export async function getMessageArchiveState(userId: string): Promise<MessageArchiveState> {
  const { rows } = await pool.query<{
    enabled: boolean;
    status: string;
    drive_folder_link: string | null;
    last_success_at: Date | string | null;
    error_code: string | null;
  }>(
    `SELECT enabled, status, drive_folder_link, last_success_at, error_code
     FROM message_archive_settings WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0];
  return {
    enabled: row?.enabled ?? false,
    status: row?.status ?? "disabled",
    folder_link: row?.drive_folder_link ?? null,
    last_success_at: row?.last_success_at ?? null,
    error_code: row?.error_code ?? null,
    action_required: row?.status === "action_required" || row?.status === "disconnected"
  };
}

export async function updateMessageArchiveSetting(input: {
  userId: string;
  enabled: boolean;
  callbackScheme: string;
}): Promise<MessageArchiveState & { authorization?: { auth_url: string; callback_scheme: string } }> {
  if (!input.enabled) {
    await pool.query(
      `INSERT INTO message_archive_settings (user_id, enabled, status)
       VALUES ($1, FALSE, 'disabled')
       ON CONFLICT (user_id) DO UPDATE
       SET enabled = FALSE, status = 'disabled', error_code = NULL,
           warning_sent_at = NULL`,
      [input.userId]
    );
    return getMessageArchiveState(input.userId);
  }
  const scope = await pool.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM connector_tokens
       WHERE user_id = $1 AND connector_id = 'drive' AND status = 'connected'
         AND $2 = ANY(scopes)
     ) AS allowed`,
    [input.userId, messageArchiveDriveScope]
  );
  if (!scope.rows[0]?.allowed) {
    const auth = await createMessageArchiveAuthUrl({
      userId: input.userId,
      callbackScheme: input.callbackScheme
    });
    return {
      ...(await getMessageArchiveState(input.userId)),
      authorization: {
        auth_url: auth.authUrl,
        callback_scheme: auth.callbackScheme
      }
    };
  }

  await pool.query(
    `INSERT INTO message_archive_settings
       (user_id, enabled, status, enabled_at, error_code, warning_sent_at)
     VALUES ($1, TRUE, 'active', NOW(), NULL, NULL)
     ON CONFLICT (user_id) DO UPDATE
     SET enabled = TRUE, status = 'active',
         enabled_at = COALESCE(message_archive_settings.enabled_at, NOW()),
         error_code = NULL, warning_sent_at = NULL`,
    [input.userId]
  );
  await enqueueArchiveJob(input.userId).catch(() => undefined);
  return getMessageArchiveState(input.userId);
}

export async function markMessageArchiveDisconnected(userId: string): Promise<void> {
  await pool.query(
    `UPDATE message_archive_settings
     SET enabled = FALSE, status = 'disconnected', error_code = 'drive_disconnected'
     WHERE user_id = $1`,
    [userId]
  );
}

export async function coordinateMessageArchives(): Promise<number> {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM message_archive_settings
     WHERE enabled = TRUE AND status IN ('active', 'action_required')`
  );
  const results = await Promise.allSettled(rows.map((row) => enqueueArchiveJob(row.user_id)));
  return results.filter((result) => result.status === "fulfilled").length;
}

export async function exportAvailableMessages(userId: string): Promise<{ batches: number; messages: number; bytes: number }> {
  const setting = await getMessageArchiveState(userId);
  if (!setting.enabled) return { batches: 0, messages: 0, bytes: 0 };
  const token = await archiveDriveToken(userId);
  const agents = await pool.query<{ agent_id: string }>(
    `SELECT DISTINCT message.agent_id
     FROM agent_messages AS message
     LEFT JOIN message_archive_entries AS entry ON entry.message_id = message.id
     WHERE message.user_id = $1 AND entry.message_id IS NULL
       AND message.created_at <= NOW() - INTERVAL '24 hours'
       AND message.created_at > NOW() - ($2::int * INTERVAL '1 day')
     ORDER BY message.agent_id`,
    [userId, config.MESSAGE_RETENTION_DAYS]
  );
  let batches = 0;
  let messages = 0;
  let bytes = 0;
  for (const agent of agents.rows) {
    const result = await exportAgentMessages(userId, agent.agent_id, token);
    batches += result.batches;
    messages += result.messages;
    bytes += result.bytes;
  }
  return { batches, messages, bytes };
}

async function exportAgentMessages(userId: string, agentId: string, token: string) {
  const client = await pool.connect();
  let lockHeld = false;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1), hashtext($2))", [userId, agentId]);
    lockHeld = true;
    const source = await client.query<ArchiveSourceRow>(
      `SELECT message.id, message.agent_id, agent.name AS agent_name,
              message.role, message.content,
              COALESCE(message.source_refs, '[]'::jsonb) AS source_refs,
              message.created_at,
              COALESCE(jsonb_agg(jsonb_build_object(
                'filename', attachment.name,
                'mime_type', attachment.mime_type,
                'size', attachment.size
              )) FILTER (WHERE attachment.id IS NOT NULL), '[]'::jsonb) AS attachments
       FROM agent_messages AS message
       JOIN agents AS agent ON agent.id = message.agent_id AND agent.user_id = message.user_id
       LEFT JOIN message_archive_entries AS entry ON entry.message_id = message.id
       LEFT JOIN message_attachments AS attachment ON attachment.message_id = message.id
       WHERE message.user_id = $1 AND message.agent_id = $2
         AND entry.message_id IS NULL
         AND message.created_at <= NOW() - INTERVAL '24 hours'
         AND message.created_at > NOW() - ($3::int * INTERVAL '1 day')
       GROUP BY message.id, agent.name
       ORDER BY message.created_at ASC, message.id ASC
       LIMIT 3000`,
      [userId, agentId, config.MESSAGE_RETENTION_DAYS]
    );
    const byDate = new Map<string, ArchiveSourceRow[]>();
    for (const row of source.rows) {
      const date = new Date(row.created_at).toISOString().slice(0, 10);
      const rows = byDate.get(date) ?? [];
      rows.push(row);
      byDate.set(date, rows);
    }

    let batchCount = 0;
    let messageCount = 0;
    let byteCount = 0;
    for (const [date, rows] of byDate) {
      const records = rows.map(normalizeArchiveMessage);
      const shards = shardArchiveRecords(records);
      for (const shard of shards) {
        const result = await uploadArchiveShard(client, {
          userId,
          agentId,
          agentName: rows[0]!.agent_name,
          date,
          records: shard,
          token
        });
        batchCount += 1;
        messageCount += shard.length;
        byteCount += result.bytes;
      }
    }
    return { batches: batchCount, messages: messageCount, bytes: byteCount };
  } finally {
    if (lockHeld) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1), hashtext($2))", [userId, agentId])
        .catch(() => undefined);
    }
    client.release();
  }
}

async function uploadArchiveShard(
  client: PoolClient,
  input: {
    userId: string;
    agentId: string;
    agentName: string;
    date: string;
    records: ArchivedMessageRecord[];
    token: string;
  }
): Promise<{ bytes: number }> {
  const identity = checksum(input.records.map((record) => record.message_id).join("\n"));
  const stableKey = `${input.agentId}:${input.date}:${identity}`;
  const existing = await client.query<ArchiveBatchRow>(
    `SELECT * FROM message_archive_batches
     WHERE user_id = $1 AND stable_key = $2`,
    [input.userId, stableKey]
  );
  if (existing.rows[0]?.status === "uploaded") return { bytes: 0 };

  let batch = existing.rows[0];
  if (!batch) {
    const partResult = await client.query<{ part: number }>(
      `SELECT COALESCE(MAX(part), 0)::int + 1 AS part
       FROM message_archive_batches
       WHERE user_id = $1 AND agent_id = $2 AND message_date = $3::date`,
      [input.userId, input.agentId, input.date]
    );
    const part = partResult.rows[0]!.part;
    const fileName = `${input.date}-part-${String(part).padStart(3, "0")}.jsonl`;
    const provisional = serializeArchiveJsonl({
      agentId: input.agentId,
      agentName: input.agentName,
      date: input.date,
      part,
      records: input.records
    });
    const inserted = await client.query<ArchiveBatchRow>(
      `INSERT INTO message_archive_batches
         (user_id, agent_id, message_date, part, stable_key, drive_file_name,
          checksum, message_count, byte_count, status)
       VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [input.userId, input.agentId, input.date, part, stableKey, fileName,
       checksum(provisional), input.records.length, Buffer.byteLength(provisional)]
    );
    batch = inserted.rows[0]!;
  }

  const jsonl = serializeArchiveJsonl({
    agentId: input.agentId,
    agentName: input.agentName,
    date: input.date,
    part: batch.part,
    records: input.records
  });
  const contentChecksum = checksum(jsonl);
  if (Buffer.byteLength(jsonl) > archiveShardMaxBytes) {
    throw new MessageArchiveError("ARCHIVE_SHARD_TOO_LARGE", "Archive shard exceeded its size limit.", 500);
  }

  try {
    await client.query(
      `UPDATE message_archive_batches
       SET status = 'uploading', attempts = attempts + 1, error_code = NULL,
           checksum = $2, byte_count = $3, message_count = $4
       WHERE id = $1`,
      [batch.id, contentChecksum, Buffer.byteLength(jsonl), input.records.length]
    );
    const folders = await ensureArchiveFolders(input.userId, input.agentName, input.agentId, input.date, input.token);
    const driveFile = await resumableUpload({
      token: input.token,
      name: batch.drive_file_name,
      parentId: folders.yearFolderId,
      stableKey,
      checksum: contentChecksum,
      userId: input.userId,
      body: Buffer.from(jsonl, "utf8")
    });

    await client.query("BEGIN");
    await client.query(
      `UPDATE message_archive_batches
       SET drive_file_id = $2, status = 'uploaded', archived_at = NOW(),
           checksum = $3, byte_count = $4, error_code = NULL,
           next_attempt_at = NULL
       WHERE id = $1`,
      [batch.id, driveFile.id, contentChecksum, Buffer.byteLength(jsonl)]
    );
    for (const record of input.records) {
      await client.query(
        `INSERT INTO message_archive_entries
           (message_id, user_id, batch_id, content_checksum)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (message_id) DO NOTHING`,
        [record.message_id, input.userId, batch.id, checksum(JSON.stringify(record))]
      );
    }
    await client.query(
      `UPDATE message_archive_settings
       SET status = 'active', drive_folder_id = $2, drive_folder_link = $3,
           last_success_at = NOW(), error_code = NULL, warning_sent_at = NULL
       WHERE user_id = $1 AND enabled = TRUE`,
      [input.userId, folders.rootFolderId, folders.rootFolderLink]
    );
    await client.query("COMMIT");
    return { bytes: Buffer.byteLength(jsonl) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const code = archiveErrorCode(error);
    await client.query(
      `UPDATE message_archive_batches
       SET status = 'failed', error_code = $2,
           next_attempt_at = NOW() + LEAST(INTERVAL '12 hours',
             INTERVAL '1 minute' * power(2, LEAST(attempts, 10)))
       WHERE id = $1`,
      [batch.id, code]
    ).catch(() => undefined);
    await client.query(
      `UPDATE message_archive_settings
       SET error_code = $2,
           status = CASE WHEN $2 ~ '(auth|scope|401|403)' THEN 'action_required' ELSE status END
       WHERE user_id = $1`,
      [input.userId, code]
    ).catch(() => undefined);
    throw error;
  }
}

export function normalizeArchiveMessage(row: ArchiveSourceRow): ArchivedMessageRecord {
  const content = sanitizeArchiveContent(row.content);
  return archiveMessageSchema.parse({
    type: "message",
    message_id: row.id,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    role: row.role,
    timestamp: new Date(row.created_at).toISOString(),
    template: typeof row.content?.template === "string" ? row.content.template : "plain_text",
    content,
    source_links: sanitizeSourceLinks(row.source_refs),
    attachments: sanitizeAttachments(row.attachments)
  });
}

export function shardArchiveRecords(records: ArchivedMessageRecord[]): ArchivedMessageRecord[][] {
  const shards: ArchivedMessageRecord[][] = [];
  let current: ArchivedMessageRecord[] = [];
  let bytes = 1024; // reserve space for the schema header
  for (const record of records) {
    const recordBytes = Buffer.byteLength(JSON.stringify(record)) + 1;
    if (recordBytes + 1024 > archiveShardMaxBytes) {
      throw new MessageArchiveError("ARCHIVE_RECORD_TOO_LARGE", "A message is too large to archive safely.", 500);
    }
    if (current.length > 0 && bytes + recordBytes > archiveShardMaxBytes) {
      shards.push(current);
      current = [];
      bytes = 1024;
    }
    current.push(record);
    bytes += recordBytes;
  }
  if (current.length > 0) shards.push(current);
  return shards;
}

export function serializeArchiveJsonl(input: {
  agentId: string;
  agentName: string;
  date: string;
  part: number;
  records: ArchivedMessageRecord[];
}): string {
  const header = archiveHeaderSchema.parse({
    type: "cuppet_message_archive",
    schema_version: 1,
    agent_id: input.agentId,
    agent_name: input.agentName,
    message_date: input.date,
    part: input.part
  });
  return [JSON.stringify(header), ...input.records.map((record) => JSON.stringify(archiveMessageSchema.parse(record))), ""].join("\n");
}

function sanitizeArchiveContent(content: Record<string, unknown>): Record<string, unknown> {
  const clean = sanitizeValue(content, 0);
  return clean && typeof clean === "object" && !Array.isArray(clean)
    ? clean as Record<string, unknown>
    : {};
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > 8) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    if (/^(?:https?:\/\/)?[^\s]+\/(?:uploads?|files?)\//i.test(value)) return undefined;
    return value.slice(0, 100_000);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 1000).map((item) => sanitizeValue(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== "object") return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/token|oauth|secret|system_?prompt|developer_?prompt|hidden_?prompt|internal_?prompt|audit|pending_?action|ocr|extracted_?context|attachment_?context|briefing_?context|upload_?url|binary/i.test(key)) continue;
    if (/attachments?/i.test(key)) continue;
    const sanitized = sanitizeValue(item, depth + 1);
    if (sanitized !== undefined) result[key] = sanitized;
  }
  return result;
}

function sanitizeSourceLinks(value: unknown): ArchivedMessageRecord["source_links"] {
  if (!Array.isArray(value)) return [];
  const links: ArchivedMessageRecord["source_links"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const url = typeof source.url === "string" ? source.url : "";
    if (!isSafeArchiveLink(url)) continue;
    const label = [source.label, source.name, source.title, source.subject, source.source]
      .find((candidate) => typeof candidate === "string" && candidate.trim());
    links.push({
      label: String(label ?? "Open source").replace(/[\r\n]/g, " ").slice(0, 200),
      url: url.slice(0, 2048),
      ...(typeof source.source === "string" ? { source: source.source.slice(0, 100) } : {})
    });
    if (links.length >= 12) break;
  }
  return links;
}

function isSafeArchiveLink(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (/\/(?:uploads?|temporary-files?|download)\//i.test(url.pathname)) return false;
    for (const key of url.searchParams.keys()) {
      if (/token|signature|credential|expires|x-goog-|x-amz-/i.test(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function sanitizeAttachments(value: unknown): ArchivedMessageRecord["attachments"] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object").slice(0, 20).map((item) => {
    const attachment = item as Record<string, unknown>;
    return {
      filename: String(attachment.filename ?? "attachment").slice(0, 500),
      mime_type: String(attachment.mime_type ?? "application/octet-stream").slice(0, 200),
      size: Math.max(0, Number(attachment.size) || 0)
    };
  });
}

async function ensureArchiveFolders(userId: string, agentName: string, agentId: string, date: string, token: string) {
  const root = await findOrCreateFolder(token, "Cuppet Archive", "root", {
    cuppetArchive: "v1",
    owner: archiveOwnerKey(userId)
  });
  const agentFolder = await findOrCreateFolder(
    token,
    `${safeDriveName(agentName)}-${agentId.slice(0, 8)}`,
    root.id,
    { cuppetAgent: agentId }
  );
  const year = date.slice(0, 4);
  const yearFolder = await findOrCreateFolder(token, year, agentFolder.id, { cuppetYear: year });
  return {
    rootFolderId: root.id,
    rootFolderLink: root.webViewLink ?? `https://drive.google.com/drive/folders/${root.id}`,
    yearFolderId: yearFolder.id
  };
}

async function findOrCreateFolder(
  token: string,
  name: string,
  parentId: string,
  appProperties: Record<string, string>
): Promise<{ id: string; webViewLink?: string }> {
  const list = new URL(`${driveApiBase}/files`);
  list.searchParams.set("q", `name = '${escapeDriveQuery(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${escapeDriveQuery(parentId)}' in parents`);
  list.searchParams.set("fields", "files(id,webViewLink,appProperties)");
  list.searchParams.set("spaces", "drive");
  const found = await driveJson<{ files?: Array<{ id: string; webViewLink?: string; appProperties?: Record<string, string> }> }>(list, token);
  const owned = (found.files ?? []).find((file) =>
    Object.entries(appProperties).every(([key, value]) => file.appProperties?.[key] === value)
  );
  if (owned) return owned;
  const created = await fetch(`${driveApiBase}/files?fields=id,webViewLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId], appProperties }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!created.ok) throw new Error(`drive_folder_create_${created.status}`);
  return await created.json() as { id: string; webViewLink?: string };
}

async function resumableUpload(input: {
  token: string;
  name: string;
  parentId: string;
  stableKey: string;
  checksum: string;
  userId: string;
  body: Buffer;
}): Promise<{ id: string }> {
  const existingUrl = new URL(`${driveApiBase}/files`);
  existingUrl.searchParams.set(
    "q",
    `trashed = false and appProperties has { key='stableKey' and value='${escapeDriveQuery(input.stableKey)}' }`
  );
  existingUrl.searchParams.set("fields", "files(id,appProperties)");
  const existing = await driveJson<{
    files?: Array<{ id: string; appProperties?: Record<string, string> }>;
  }>(existingUrl, input.token);
  const match = (existing.files ?? []).find((file) =>
    file.appProperties?.sha256 === input.checksum &&
    file.appProperties?.owner === archiveOwnerKey(input.userId)
  );
  if (match) return { id: match.id };

  const start = await fetch(`${driveUploadBase}/files?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "application/x-ndjson",
      "X-Upload-Content-Length": String(input.body.length)
    },
    body: JSON.stringify({
      name: input.name,
      mimeType: "application/x-ndjson",
      parents: [input.parentId],
      appProperties: {
        cuppetArchive: "v1",
        stableKey: input.stableKey,
        sha256: input.checksum,
        owner: archiveOwnerKey(input.userId)
      }
    }),
    signal: AbortSignal.timeout(20_000)
  });
  const location = start.headers.get("location");
  if (!start.ok || !location) throw new Error(`drive_resumable_start_${start.status}`);
  const uploaded = await fetch(location, {
    method: "PUT",
    headers: { "Content-Type": "application/x-ndjson", "Content-Length": String(input.body.length) },
    body: input.body.toString("utf8"),
    signal: AbortSignal.timeout(60_000)
  });
  if (!uploaded.ok) throw new Error(`drive_resumable_upload_${uploaded.status}`);
  return await uploaded.json() as { id: string };
}

export async function readArchivedMessages(input: {
  userId: string;
  agentId: string;
  cursor?: string;
  limit: number;
}): Promise<{ messages: Array<ArchivedMessageRecord & { drive_backed: true; read_only: true }>; next_cursor: string | null; files_read: number }> {
  const setting = await getMessageArchiveState(input.userId);
  if (!setting.enabled || setting.status === "disconnected") {
    throw new MessageArchiveError("MESSAGE_ARCHIVE_DRIVE_REQUIRED", "Reconnect Google Drive to view archived messages.", 409);
  }
  const token = await archiveDriveToken(input.userId);
  const cursor = decodeArchiveCursor(input.cursor);
  const inclusiveWindow = cursor?.mode === "window";
  const batches = await pool.query<ArchiveBatchRow>(
    `SELECT * FROM message_archive_batches
     WHERE user_id = $1 AND agent_id = $2 AND status = 'uploaded'
       AND ($3::date IS NULL OR
            ($6::boolean = TRUE AND (message_date, part) <= ($3::date, $4::int)) OR
            ($6::boolean = FALSE AND (message_date, part) < ($3::date, $4::int)))
     ORDER BY message_date DESC, part DESC
     LIMIT $5`,
    [
      input.userId,
      input.agentId,
      cursor?.batch_date ?? null,
      cursor?.batch_part ?? 0,
      maxArchiveReadFiles,
      inclusiveWindow
    ]
  );
  const records: ArchivedMessageRecord[] = [];
  for (const batch of batches.rows) {
    const fileRecords = await downloadAndValidateArchiveFile(input.userId, batch, token);
    records.push(...fileRecords);
  }
  records.sort((left, right) => right.timestamp.localeCompare(left.timestamp) || right.message_id.localeCompare(left.message_id));
  const filtered = cursor?.before
    ? records.filter((record) =>
        record.timestamp < cursor.before! ||
        (record.timestamp === cursor.before && record.message_id < (cursor.before_id ?? ""))
      )
    : records;
  const selected = filtered.slice(0, input.limit);
  const topBatch = batches.rows[0];
  const lastBatch = batches.rows.at(-1);
  let nextCursor: string | null = null;
  if (selected.length > 0 && filtered.length > input.limit && topBatch) {
    const lastMessage = selected.at(-1)!;
    nextCursor = encodeArchiveCursor({
      mode: "window",
      batch_date: topBatch.message_date,
      batch_part: topBatch.part,
      before: lastMessage.timestamp,
      before_id: lastMessage.message_id
    });
  } else if (lastBatch && batches.rows.length === maxArchiveReadFiles) {
    nextCursor = encodeArchiveCursor({
      mode: "older",
      batch_date: lastBatch.message_date,
      batch_part: lastBatch.part
    });
  }
  return {
    messages: selected.reverse().map((record) => ({ ...record, drive_backed: true, read_only: true })),
    next_cursor: nextCursor,
    files_read: batches.rows.length
  };
}

async function downloadAndValidateArchiveFile(userId: string, batch: ArchiveBatchRow, token: string): Promise<ArchivedMessageRecord[]> {
  if (!batch.drive_file_id) throw new MessageArchiveError("ARCHIVE_FILE_MISSING", "An archived file is missing.", 404);
  const metadataUrl = new URL(`${driveApiBase}/files/${encodeURIComponent(batch.drive_file_id)}`);
  metadataUrl.searchParams.set("fields", "id,name,size,appProperties,trashed");
  let metadata: { id: string; name: string; size?: string; trashed?: boolean; appProperties?: Record<string, string> };
  try {
    metadata = await driveJson(metadataUrl, token);
  } catch (error) {
    if (error instanceof DriveApiError && (error.status === 401 || error.status === 403)) {
      await pool.query(
        `UPDATE message_archive_settings
         SET status = 'action_required', error_code = 'drive_archive_auth_required'
         WHERE user_id = $1`,
        [userId]
      );
      throw new MessageArchiveError("MESSAGE_ARCHIVE_DRIVE_REQUIRED", "Reconnect Google Drive to view archived messages.", 409);
    }
    await markBatchReadFailure(batch.id, "missing");
    throw new MessageArchiveError("ARCHIVE_FILE_MISSING", "An archived Drive file is missing.", 404);
  }
  if (metadata.trashed || Number(metadata.size ?? 0) > archiveShardMaxBytes ||
      metadata.appProperties?.owner !== archiveOwnerKey(userId) ||
      metadata.appProperties?.stableKey !== batch.stable_key ||
      metadata.appProperties?.sha256 !== batch.checksum) {
    await markBatchReadFailure(batch.id, "invalid");
    throw new MessageArchiveError("ARCHIVE_FILE_INVALID", "An archived Drive file was changed or is invalid.", 422);
  }
  const response = await fetch(`${driveApiBase}/files/${encodeURIComponent(batch.drive_file_id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new MessageArchiveError("ARCHIVE_FILE_MISSING", "An archived Drive file could not be read.", 404);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > archiveShardMaxBytes || checksum(bytes) !== batch.checksum) {
    await markBatchReadFailure(batch.id, "invalid");
    throw new MessageArchiveError("ARCHIVE_FILE_INVALID", "An archived Drive file failed validation.", 422);
  }
  return parseArchiveJsonl(bytes.toString("utf8"), {
    agentId: batch.agent_id,
    messageDate: String(batch.message_date).slice(0, 10),
    part: batch.part
  });
}

export function parseArchiveJsonl(
  jsonl: string,
  expected: { agentId: string; messageDate: string; part: number }
): ArchivedMessageRecord[] {
  const lines = jsonl.split("\n").filter(Boolean);
  if (lines.length < 1 || lines.length > 10_001) throw new MessageArchiveError("ARCHIVE_FILE_INVALID", "Archive schema validation failed.", 422);
  let header: z.infer<typeof archiveHeaderSchema>;
  try {
    header = archiveHeaderSchema.parse(JSON.parse(lines[0]!));
  } catch {
    throw new MessageArchiveError("ARCHIVE_FILE_INVALID", "Archive schema validation failed.", 422);
  }
  if (header.agent_id !== expected.agentId || header.message_date !== expected.messageDate || header.part !== expected.part) {
    throw new MessageArchiveError("ARCHIVE_FILE_INVALID", "Archive ownership validation failed.", 422);
  }
  try {
    return lines.slice(1).map((line) => archiveMessageSchema.parse(JSON.parse(line)));
  } catch {
    throw new MessageArchiveError("ARCHIVE_FILE_INVALID", "An archived JSON line is invalid.", 422);
  }
}

export async function deleteDriveArchives(userId: string): Promise<{ deleted_files: number }> {
  const token = await archiveDriveToken(userId);
  const setting = await pool.query<{ drive_folder_id: string | null }>(
    `SELECT drive_folder_id FROM message_archive_settings WHERE user_id = $1`,
    [userId]
  );
  const rootId = setting.rows[0]?.drive_folder_id;
  let deleted = 0;
  if (rootId) {
    const response = await fetch(`${driveApiBase}/files/${encodeURIComponent(rootId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok && response.status !== 404) throw new Error(`drive_archive_delete_${response.status}`);
    deleted = 1;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM message_archive_batches WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM message_archive_failure_receipts WHERE user_id = $1`, [userId]);
    await client.query(
      `UPDATE message_archive_settings
       SET enabled = FALSE, status = 'disabled', drive_folder_id = NULL,
           drive_folder_link = NULL, last_success_at = NULL,
           error_code = NULL, warning_sent_at = NULL
       WHERE user_id = $1`,
      [userId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return { deleted_files: deleted };
}

async function archiveDriveToken(userId: string): Promise<string> {
  const scope = await pool.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM connector_tokens
       WHERE user_id = $1 AND connector_id = 'drive' AND status = 'connected'
         AND $2 = ANY(scopes)
     ) AS allowed`,
    [userId, messageArchiveDriveScope]
  );
  if (!scope.rows[0]?.allowed) {
    await pool.query(
      `UPDATE message_archive_settings
       SET status = 'action_required', error_code = 'message_archive_scope_required'
       WHERE user_id = $1`,
      [userId]
    );
    throw new MessageArchiveError("MESSAGE_ARCHIVE_SCOPE_REQUIRED", "Google Drive archive permission is required.", 409);
  }
  const token = await googleAccessToken(userId, "drive");
  if (!token) throw new MessageArchiveError("MESSAGE_ARCHIVE_DRIVE_REQUIRED", "Reconnect Google Drive to continue.", 409);
  return token;
}

async function driveJson<T>(url: URL, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new DriveApiError(response.status);
  return await response.json() as T;
}

class DriveApiError extends Error {
  constructor(public readonly status: number) {
    super(`drive_api_${status}`);
  }
}

async function markBatchReadFailure(batchId: string, status: "missing" | "invalid") {
  await pool.query(
    `UPDATE message_archive_batches SET status = $2, error_code = $2 WHERE id = $1`,
    [batchId, status]
  );
}

function archiveOwnerKey(userId: string): string {
  return createHmac("sha256", config.BETTER_AUTH_SECRET).update(userId).digest("hex").slice(0, 32);
}

function checksum(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeDriveName(value: string): string {
  return value.replace(/[\\/:*?"<>|\r\n]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "Agent";
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function archiveErrorCode(error: unknown): string {
  return error instanceof MessageArchiveError
    ? error.code.toLowerCase()
    : error instanceof Error
      ? error.message.slice(0, 120)
      : "message_archive_failed";
}

async function enqueueArchiveJob(userId: string) {
  const { enqueueMessageArchive } = await import("../queue/index.js");
  return enqueueMessageArchive(userId);
}

type ArchiveCursor = {
  mode: "window" | "older";
  batch_date: string;
  batch_part: number;
  before?: string;
  before_id?: string;
};

function encodeArchiveCursor(cursor: ArchiveCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeArchiveCursor(value?: string): ArchiveCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if ((parsed.mode !== "window" && parsed.mode !== "older") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(parsed.batch_date) ||
        !Number.isInteger(parsed.batch_part) ||
        (parsed.before !== undefined && Number.isNaN(Date.parse(parsed.before)))) throw new Error();
    return parsed;
  } catch {
    throw new MessageArchiveError("INVALID_ARCHIVE_CURSOR", "The archive cursor is invalid.", 400);
  }
}

export class MessageArchiveError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode: number) {
    super(message);
  }
}

import type { PoolClient } from "pg";
import { pool } from "../db/index.js";
import {
  decryptConnectorSecret,
  encryptConnectorSecret
} from "../connectors/token-vault.js";
import type {
  AccessConnection,
  AccessConnectionCredential,
  AccessConnectionStatus,
  AccessRequirement
} from "./types.js";

type Queryable = Pick<PoolClient, "query">;

export async function listAccessConnections(
  userId: string,
  client: Queryable = pool
): Promise<AccessConnection[]> {
  const { rows } = await client.query<AccessConnectionRow>(
    `SELECT id, user_id, provider_id, provider_kind, status,
            account_label, external_account_id, capabilities, metadata,
            endpoint, created_at, updated_at
       FROM access_connections
      WHERE user_id = $1
      ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map(toConnection);
}

export async function findAccessConnection(
  userId: string,
  connectionId: string,
  client: Queryable = pool
): Promise<AccessConnection | null> {
  const { rows } = await client.query<AccessConnectionRow>(
    `SELECT id, user_id, provider_id, provider_kind, status,
            account_label, external_account_id, capabilities, metadata,
            endpoint, created_at, updated_at
       FROM access_connections
      WHERE id = $1 AND user_id = $2
      LIMIT 1`,
    [connectionId, userId]
  );
  return rows[0] ? toConnection(rows[0]) : null;
}

export async function findConnectedAccessConnection(
  userId: string,
  providerId: string,
  client: Queryable = pool
): Promise<AccessConnection | null> {
  const { rows } = await client.query<AccessConnectionRow>(
    `SELECT id, user_id, provider_id, provider_kind, status,
            account_label, external_account_id, capabilities, metadata,
            endpoint, created_at, updated_at
       FROM access_connections
      WHERE user_id = $1 AND provider_id = $2 AND status = 'connected'
      ORDER BY updated_at DESC
      LIMIT 1`,
    [userId, providerId]
  );
  return rows[0] ? toConnection(rows[0]) : null;
}

export async function upsertAccessConnection(input: {
  userId: string;
  providerId: string;
  providerKind: "mcp" | "native";
  externalAccountId?: string;
  accountLabel?: string;
  capabilities: string[];
  metadata?: Record<string, unknown>;
  status?: AccessConnectionStatus;
  endpoint?: string;
}, client: Queryable = pool): Promise<AccessConnection> {
  const { rows } = await client.query<AccessConnectionRow>(
    `INSERT INTO access_connections
       (user_id, provider_id, provider_kind, external_account_id,
        account_label, capabilities, metadata, status, endpoint)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, provider_id, external_account_id)
     DO UPDATE SET provider_kind = EXCLUDED.provider_kind,
                   account_label = EXCLUDED.account_label,
                   capabilities = EXCLUDED.capabilities,
                   metadata = EXCLUDED.metadata,
                   status = EXCLUDED.status,
                   endpoint = EXCLUDED.endpoint,
                   updated_at = NOW()
     RETURNING id, user_id, provider_id, provider_kind, status,
               account_label, external_account_id, capabilities, metadata,
               endpoint, created_at, updated_at`,
    [
      input.userId,
      input.providerId,
      input.providerKind,
      input.externalAccountId ?? null,
      input.accountLabel ?? null,
      input.capabilities,
      JSON.stringify(input.metadata ?? {}),
      input.status ?? "connected",
      input.endpoint ?? null
    ]
  );
  return toConnection(rows[0]!);
}

export async function storeAccessConnectionCredential(input: {
  connectionId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date;
  scopes: string[];
  metadata?: Record<string, unknown>;
}, client: Queryable = pool): Promise<void> {
  await client.query(
    `INSERT INTO access_connection_credentials
       (connection_id, access_token_enc, refresh_token_enc,
        token_expires_at, scopes, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (connection_id)
     DO UPDATE SET access_token_enc = EXCLUDED.access_token_enc,
                   refresh_token_enc = EXCLUDED.refresh_token_enc,
                   token_expires_at = EXCLUDED.token_expires_at,
                   scopes = EXCLUDED.scopes,
                   metadata = EXCLUDED.metadata,
                   updated_at = NOW()`,
    [
      input.connectionId,
      encryptConnectorSecret(input.accessToken),
      input.refreshToken ? encryptConnectorSecret(input.refreshToken) : null,
      input.tokenExpiresAt,
      input.scopes,
      JSON.stringify(input.metadata ?? {})
    ]
  );
}

export async function loadAccessConnectionCredential(
  userId: string,
  connectionId: string,
  client: Queryable = pool
): Promise<AccessConnectionCredential | null> {
  const { rows } = await client.query<AccessCredentialRow>(
    `SELECT credentials.connection_id, credentials.access_token_enc,
            credentials.refresh_token_enc, credentials.token_expires_at,
            credentials.scopes, credentials.metadata
       FROM access_connection_credentials credentials
       JOIN access_connections connections
         ON connections.id = credentials.connection_id
      WHERE connections.id = $1 AND connections.user_id = $2
      LIMIT 1`,
    [connectionId, userId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    connectionId: row.connection_id,
    accessToken: decryptConnectorSecret(row.access_token_enc),
    ...(row.refresh_token_enc
      ? { refreshToken: decryptConnectorSecret(row.refresh_token_enc) }
      : {}),
    tokenExpiresAt: row.token_expires_at,
    scopes: row.scopes ?? [],
    metadata: row.metadata ?? {}
  };
}

export async function setAccessConnectionStatus(
  userId: string,
  connectionId: string,
  status: AccessConnectionStatus,
  client: Queryable = pool
): Promise<AccessConnection | null> {
  const { rows } = await client.query<AccessConnectionRow>(
    `UPDATE access_connections
        SET status = $3, updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, provider_id, provider_kind, status,
                account_label, external_account_id, capabilities, metadata,
                endpoint, created_at, updated_at`,
    [connectionId, userId, status]
  );
  return rows[0] ? toConnection(rows[0]) : null;
}

export async function setAccessProviderStatus(
  userId: string,
  providerId: string,
  status: AccessConnectionStatus,
  client: Queryable = pool
): Promise<void> {
  await client.query(
    `UPDATE access_connections
        SET status = $3, updated_at = NOW()
      WHERE user_id = $1 AND provider_id = $2`,
    [userId, providerId, status]
  );
}

export async function disconnectAccessProvider(
  userId: string,
  providerId: string,
  client: Queryable = pool
): Promise<void> {
  await client.query(
    `UPDATE access_connections
        SET status = 'disconnected', updated_at = NOW()
      WHERE user_id = $1 AND provider_id = $2`,
    [userId, providerId]
  );
}

export async function deleteAccessConnection(
  userId: string,
  connectionId: string,
  client: Queryable = pool
): Promise<boolean> {
  const result = await client.query(
    `DELETE FROM access_connections WHERE id = $1 AND user_id = $2`,
    [connectionId, userId]
  );
  return result.rowCount === 1;
}

export async function saveAccessOAuthTransaction(input: {
  stateHash: string;
  userId: string;
  providerId: string;
  callbackScheme: string;
  redirectUri: string;
  codeVerifier: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  issuer?: string;
  resource?: string;
  expiresAt: Date;
}, client: Queryable = pool): Promise<void> {
  await client.query(
    `INSERT INTO access_oauth_transactions
       (state_hash, user_id, provider_id, callback_scheme, redirect_uri,
         code_verifier_enc, authorization_endpoint, token_endpoint, issuer,
         resource, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      input.stateHash,
      input.userId,
      input.providerId,
      input.callbackScheme,
      input.redirectUri,
      encryptConnectorSecret(input.codeVerifier),
      input.authorizationEndpoint,
      input.tokenEndpoint,
      input.issuer ?? null,
      input.resource ?? null,
      input.expiresAt
    ]
  );
}

export async function loadAccessOAuthTransaction(
  stateHash: string,
  client: Queryable = pool
): Promise<AccessOAuthTransaction | null> {
  const { rows } = await client.query<AccessOAuthTransactionRow>(
    `SELECT id, state_hash, user_id, provider_id, callback_scheme,
            redirect_uri, code_verifier_enc, authorization_endpoint,
            token_endpoint, issuer, resource, expires_at, status, connection_id
       FROM access_oauth_transactions
      WHERE state_hash = $1 AND expires_at > NOW() AND status = 'pending'
      LIMIT 1`,
    [stateHash]
  );
  const row = rows[0];
  return row ? toAccessOAuthTransaction(row) : null;
}

export async function claimAccessOAuthTransaction(
  stateHash: string,
  client: Queryable = pool
): Promise<AccessOAuthTransaction | null> {
  const { rows } = await client.query<AccessOAuthTransactionRow>(
    `UPDATE access_oauth_transactions
        SET status = 'processing'
      WHERE state_hash = $1
        AND expires_at > NOW()
        AND status = 'pending'
      RETURNING id, state_hash, user_id, provider_id, callback_scheme,
                redirect_uri, code_verifier_enc, authorization_endpoint,
                token_endpoint, issuer, resource, expires_at, status, connection_id`,
    [stateHash]
  );
  const row = rows[0];
  return row ? toAccessOAuthTransaction(row) : null;
}

export async function completeAccessOAuthTransaction(input: {
  id: string;
  userId: string;
  status: "completed" | "failed";
  connectionId?: string;
}, client: Queryable = pool): Promise<void> {
  await client.query(
    `UPDATE access_oauth_transactions
        SET status = $3, connection_id = $4, completed_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'processing')`,
    [input.id, input.userId, input.status, input.connectionId ?? null]
  );
}

export async function loadAccessOAuthCompletion(
  userId: string,
  transactionId: string,
  client: Queryable = pool
): Promise<{ providerId: string; connectionId?: string; status: string } | null> {
  const { rows } = await client.query<{
    provider_id: string;
    connection_id: string | null;
    status: string;
  }>(
    `SELECT provider_id, connection_id, status
       FROM access_oauth_transactions
      WHERE id = $1 AND user_id = $2
      LIMIT 1`,
    [transactionId, userId]
  );
  const row = rows[0];
  return row
    ? {
        providerId: row.provider_id,
        ...(row.connection_id ? { connectionId: row.connection_id } : {}),
        status: row.status
      }
      : null;
}

export async function saveAccessRequestContinuation(input: {
  userId: string;
  agentId?: string;
  requestHash: string;
  requirements: AccessRequirement[];
  expiresAt: Date;
}, client: Queryable = pool): Promise<void> {
  await client.query(
    `INSERT INTO access_request_continuations
       (user_id, agent_id, request_hash, requirements, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, request_hash)
     DO UPDATE SET agent_id = EXCLUDED.agent_id,
                   requirements = EXCLUDED.requirements,
                   status = 'pending',
                   expires_at = EXCLUDED.expires_at,
                   resumed_at = NULL`,
    [
      input.userId,
      input.agentId ?? null,
      input.requestHash,
      JSON.stringify(input.requirements),
      input.expiresAt
    ]
  );
}

export async function resumeAccessRequestContinuation(
  userId: string,
  requestHash: string,
  client: Queryable = pool
): Promise<void> {
  await client.query(
    `UPDATE access_request_continuations
        SET status = 'resumed', resumed_at = NOW()
      WHERE user_id = $1 AND request_hash = $2 AND status = 'pending'
        AND expires_at > NOW()`,
    [userId, requestHash]
  );
}

export async function saveMcpToolSnapshot(input: {
  connectionId: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}, client: Queryable = pool): Promise<void> {
  await client.query(
    `INSERT INTO access_tool_snapshots
       (connection_id, tool_name, description, input_schema, annotations)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (connection_id, tool_name)
     DO UPDATE SET description = EXCLUDED.description,
                   input_schema = EXCLUDED.input_schema,
                   annotations = EXCLUDED.annotations,
                   observed_at = NOW()`,
    [
      input.connectionId,
      input.name,
      input.description ?? null,
      JSON.stringify(input.inputSchema),
      JSON.stringify(input.annotations ?? {})
    ]
  );
}

export async function saveMcpResourceSnapshot(input: {
  connectionId: string;
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}, client: Queryable = pool): Promise<void> {
  await client.query(
    `INSERT INTO access_resource_snapshots
       (connection_id, resource_uri, name, description, mime_type)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (connection_id, resource_uri)
     DO UPDATE SET name = EXCLUDED.name,
                   description = EXCLUDED.description,
                   mime_type = EXCLUDED.mime_type,
                   observed_at = NOW()`,
    [
      input.connectionId,
      input.uri,
      input.name ?? null,
      input.description ?? null,
      input.mimeType ?? null
    ]
  );
}

export async function listMcpToolSnapshots(
  userId: string,
  connectionId: string,
  client: Queryable = pool
): Promise<Array<{ name: string; description?: string; annotations: Record<string, unknown> }>> {
  const { rows } = await client.query<{
    tool_name: string;
    description: string | null;
    annotations: Record<string, unknown>;
  }>(
    `SELECT snapshots.tool_name, snapshots.description, snapshots.annotations
       FROM access_tool_snapshots snapshots
       JOIN access_connections connections
         ON connections.id = snapshots.connection_id
      WHERE snapshots.connection_id = $1 AND connections.user_id = $2
      ORDER BY snapshots.tool_name`,
    [connectionId, userId]
  );
  return rows.map((row) => ({
    name: row.tool_name,
    ...(row.description ? { description: row.description } : {}),
    annotations: row.annotations ?? {}
  }));
}

type AccessConnectionRow = {
  id: string;
  user_id: string;
  provider_id: string;
  provider_kind: "native" | "mcp";
  status: AccessConnectionStatus;
  account_label: string | null;
  external_account_id: string | null;
  capabilities: string[];
  metadata: Record<string, unknown>;
  endpoint: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type AccessCredentialRow = {
  connection_id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: Date | string;
  scopes: string[];
  metadata: Record<string, unknown>;
};

type AccessOAuthTransactionRow = {
  id: string;
  state_hash: string;
  user_id: string;
  provider_id: string;
  callback_scheme: string;
  redirect_uri: string;
  code_verifier_enc: string;
  authorization_endpoint: string;
  token_endpoint: string;
  issuer: string | null;
  resource: string | null;
  expires_at: Date | string;
  status: "pending" | "processing" | "completed" | "failed";
  connection_id: string | null;
};

export type AccessOAuthTransaction = {
  id: string;
  stateHash: string;
  userId: string;
  providerId: string;
  callbackScheme: string;
  redirectUri: string;
  codeVerifier: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  issuer?: string;
  resource?: string;
  expiresAt: Date | string;
  status: "pending" | "processing" | "completed" | "failed";
  connectionId?: string;
};

function toConnection(row: AccessConnectionRow): AccessConnection {
  return {
    id: row.id,
    userId: row.user_id,
    providerId: row.provider_id,
    providerKind: row.provider_kind,
    status: row.status,
    ...(row.account_label ? { accountLabel: row.account_label } : {}),
    ...(row.external_account_id ? { externalAccountId: row.external_account_id } : {}),
    ...(row.endpoint ? { endpoint: row.endpoint } : {}),
    capabilities: row.capabilities ?? [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toAccessOAuthTransaction(row: AccessOAuthTransactionRow): AccessOAuthTransaction {
  return {
    id: row.id,
    stateHash: row.state_hash,
    userId: row.user_id,
    providerId: row.provider_id,
    callbackScheme: row.callback_scheme,
    redirectUri: row.redirect_uri,
    codeVerifier: decryptConnectorSecret(row.code_verifier_enc),
    authorizationEndpoint: row.authorization_endpoint,
    tokenEndpoint: row.token_endpoint,
    ...(row.issuer ? { issuer: row.issuer } : {}),
    ...(row.resource ? { resource: row.resource } : {}),
    expiresAt: row.expires_at,
    status: row.status,
    ...(row.connection_id ? { connectionId: row.connection_id } : {})
  };
}

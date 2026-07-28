import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../../db/index.js";
import type { ParsedIntent } from "../parser.js";
import {
  compileAgentDefinition,
  definitionToParsedIntent,
  validateCompiledDefinition
} from "./compiler.js";
import type { AgentDefinition } from "./definition.js";
import { getCapabilityDefinition } from "./capability-registry.js";

export type AgentConfigurationRecord = {
  revisionId: string;
  revision: number;
  definition: AgentDefinition;
};

export type NewConfiguredAgent = {
  userId: string;
  name: string;
  avatar: string;
  prompt: string;
  parsedIntent: ParsedIntent;
  isAssistant?: boolean;
  status?: "active" | "paused" | "error";
  lastMessageAt?: Date | null;
  createdBy?: string;
};

export async function insertConfiguredAgent<T extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  input: NewConfiguredAgent
): Promise<T> {
  const definition = compileAgentDefinition(input.parsedIntent, input.prompt);
  const projections = definitionProjections(definition);
  const compatibility = definitionToParsedIntent(definition, {
    name: input.name,
    avatar: input.avatar
  });
  const { rows } = await client.query<T>(
      `
        INSERT INTO agents
        (user_id, name, avatar, prompt, parsed_intent, connector_ids,
          access_refs, schedule_cron, is_assistant, status, safety_level, last_message_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
    [
      input.userId,
      input.name,
      input.avatar,
      input.prompt,
       JSON.stringify({}),
       projections.connectorIds,
       JSON.stringify(projections.accessRefs),
       projections.scheduleCron,
       input.isAssistant ?? false,
       input.status ?? "active",
       projections.safetyLevel,
       input.lastMessageAt ?? new Date()
    ]
  );
  const agent = rows[0]!;
  const agentId = String((agent as QueryResultRow).id);
  await insertRevision(client, {
    agentId,
    definition,
    revision: 1,
    createdBy: input.createdBy ?? "creation"
  });
  await client.query(
    `INSERT INTO agent_runtime_states (agent_id) VALUES ($1)
     ON CONFLICT (agent_id) DO NOTHING`,
    [agentId]
  );
  return {
    ...agent,
    parsed_intent: compatibility
  } as T;
}

export async function reviseAgentDefinition(
  client: PoolClient,
  input: {
    agentId: string;
    userId: string;
    definition: AgentDefinition;
    name: string;
    avatar: string;
    prompt: string;
    status?: "active" | "paused" | "error";
    createdBy: string;
  }
): Promise<AgentConfigurationRecord> {
  const definition = validateCompiledDefinition(input.definition);
  const owner = await client.query<{ id: string }>(
    `SELECT id FROM agents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
    [input.agentId, input.userId]
  );
  if (!owner.rows[0]) throw new Error("AGENT_NOT_FOUND");

  const current = await client.query<{ revision: number }>(
    `SELECT revision
     FROM agent_config_revisions
     WHERE agent_id = $1
     ORDER BY revision DESC
     LIMIT 1`,
    [input.agentId]
  );
  const revision = (current.rows[0]?.revision ?? 0) + 1;
  const projections = definitionProjections(definition);
  await client.query(
      `UPDATE agents
      SET prompt = $3,
          parsed_intent = $4,
          connector_ids = $5,
          access_refs = $6,
          schedule_cron = $7,
          safety_level = $8,
          status = COALESCE($9, status),
          name = $10
     WHERE id = $1 AND user_id = $2`,
    [
      input.agentId,
      input.userId,
      input.prompt,
      JSON.stringify({}),
      projections.connectorIds,
      JSON.stringify(projections.accessRefs),
      projections.scheduleCron,
      projections.safetyLevel,
      input.status ?? null,
      input.name
    ]
  );
  return insertRevision(client, {
    agentId: input.agentId,
    definition,
    revision,
    createdBy: input.createdBy
  });
}

export async function loadCurrentAgentDefinition(
  agentId: string,
  client: Pick<PoolClient, "query"> = pool
): Promise<AgentConfigurationRecord | null> {
  const { rows } = await client.query<{
    id: string;
    revision: number;
    definition: unknown;
  }>(
    `SELECT revision.id, revision.revision, revision.definition
     FROM agent_config_heads AS head
     JOIN agent_config_revisions AS revision ON revision.id = head.revision_id
     WHERE head.agent_id = $1`,
    [agentId]
  );
  const row = rows[0];
  return row
    ? {
        revisionId: row.id,
        revision: row.revision,
        definition: validateCompiledDefinition(row.definition)
      }
    : null;
}

export async function loadAgentDefinitionRevision(
  revisionId: string,
  agentId: string,
  client: Pick<PoolClient, "query"> = pool
): Promise<AgentConfigurationRecord | null> {
  const { rows } = await client.query<{
    id: string;
    revision: number;
    definition: unknown;
  }>(
    `SELECT id, revision, definition
     FROM agent_config_revisions
     WHERE id = $1 AND agent_id = $2`,
    [revisionId, agentId]
  );
  const row = rows[0];
  return row
    ? {
        revisionId: row.id,
        revision: row.revision,
        definition: validateCompiledDefinition(row.definition)
      }
    : null;
}

export async function loadRuntimeState(
  agentId: string,
  client: Pick<PoolClient, "query"> = pool
): Promise<Record<string, unknown>> {
  const { rows } = await client.query<{ state: Record<string, unknown> | string }>(
    `SELECT state FROM agent_runtime_states WHERE agent_id = $1`,
    [agentId]
  );
  const value = rows[0]?.state;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return defaultRuntimeState();
    }
  }
  return value ?? defaultRuntimeState();
}

export async function ensureConfiguredAgent(input: {
  agentId: string;
  name: string;
  avatar: string;
  prompt: string;
  parsedIntent: ParsedIntent;
}): Promise<AgentConfigurationRecord> {
  const existing = await loadCurrentAgentDefinition(input.agentId);
  if (existing) return existing;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM agents WHERE id = $1 FOR UPDATE`, [
      input.agentId
    ]);
    const raced = await loadCurrentAgentDefinition(input.agentId, client);
    if (raced) {
      await client.query("COMMIT");
      return raced;
    }
    const definition = compileAgentDefinition(input.parsedIntent, input.prompt);
    const revision = await insertRevision(client, {
      agentId: input.agentId,
      definition,
      revision: 1,
      createdBy: "legacy_cutover"
    });
    const legacy = input.parsedIntent as ParsedIntent &
      Record<string, unknown>;
    await client.query(
      `INSERT INTO agent_runtime_states (agent_id, state)
       VALUES ($1, $2)
       ON CONFLICT (agent_id) DO NOTHING`,
      [
        input.agentId,
        JSON.stringify({
          history: legacy.history ?? {},
          topics_covered: legacy.topics_covered ?? [],
          current_chunk: legacy.current_chunk ?? 0
        })
      ]
    );
    await client.query(
      `UPDATE agents SET parsed_intent = '{}'::jsonb WHERE id = $1`,
      [input.agentId]
    );
    await client.query("COMMIT");
    return revision;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function definitionProjections(definition: AgentDefinition): {
  connectorIds: string[];
  accessRefs: unknown[];
  scheduleCron: string | null;
  safetyLevel: "read" | "suggest" | "act";
} {
  const connectors = definition.steps.flatMap((step) =>
    getCapabilityDefinition(step.capability).requiredConnectors(step.config)
  );
  const accessRefs = definition.schema_version === 2
    ? definition.required_access
    : definition.steps.flatMap((step) =>
        getCapabilityDefinition(step.capability).requiredAccess(step.config)
      );
  return {
    connectorIds: [...new Set(connectors)],
    accessRefs,
    scheduleCron:
      definition.trigger.type === "schedule" ? definition.trigger.cron : null,
    safetyLevel: definition.policy.safety_level
  };
}

async function insertRevision(
  client: PoolClient,
  input: {
    agentId: string;
    definition: AgentDefinition;
    revision: number;
    createdBy: string;
  }
): Promise<AgentConfigurationRecord> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO agent_config_revisions
       (agent_id, revision, definition, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      input.agentId,
      input.revision,
      JSON.stringify(input.definition),
      input.createdBy
    ]
  );
  const revisionId = rows[0]!.id;
  await client.query(
    `INSERT INTO agent_config_heads (agent_id, revision_id)
     VALUES ($1, $2)
     ON CONFLICT (agent_id)
     DO UPDATE SET revision_id = EXCLUDED.revision_id, updated_at = NOW()`,
    [input.agentId, revisionId]
  );
  return {
    revisionId,
    revision: input.revision,
    definition: input.definition
  };
}

function defaultRuntimeState(): Record<string, unknown> {
  return { history: {}, topics_covered: [], current_chunk: 0 };
}

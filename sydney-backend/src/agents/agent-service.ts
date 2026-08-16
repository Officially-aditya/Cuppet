import { pool } from "../db/index.js";
import { enqueueAgentRun } from "../queue/index.js";
import { publishRealtimeEvent } from "../realtime/events.js";
import { parseIntentHybridForUser } from "./llm-intent.js";
import {
  isDraftOutputPlatformName,
  looksLikeContentDraftPrompt,
  type ParsedIntent
} from "./parser.js";
import {
  removeScheduleForAgent,
  syncAgentSchedule,
  syncAgentScheduleForUser
} from "./scheduler.js";
import {
  resolveAgentTargetFromList,
  type NamedAgentTargetResolution
} from "./agent-target.js";
import { compileAgentDefinition } from "./runtime/compiler.js";
import {
  loadCurrentAgentDefinition,
  loadRuntimeState,
  reviseAgentDefinition
} from "./runtime/configuration-service.js";
import { definitionToParsedIntent } from "./runtime/compiler.js";
import { recordCuppetActivitySignal } from "../personalization/activity-events.js";
import { mergeRecipeInputsForDescriptionUpdate } from "./recipe-input-updates.js";

export type ManagedAgent = {
  id: string;
  user_id: string;
  name: string;
  avatar: string;
  prompt: string;
  parsed_intent: ParsedIntent;
  connector_ids: string[];
  schedule_cron: string | null;
  is_assistant: boolean;
  status: "active" | "paused" | "error";
  safety_level: "read" | "suggest" | "act";
  last_message_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export class AgentServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
    this.name = "AgentServiceError";
  }
}

export async function listManagedAgents(userId: string): Promise<ManagedAgent[]> {
  const { rows } = await pool.query<ManagedAgent>(
    `${managedAgentSelect}
     WHERE user_id = $1 AND is_assistant = FALSE
     ORDER BY name ASC`,
    [userId]
  );
  return Promise.all(rows.map(hydrateManagedAgent));
}

export async function getManagedAgent(
  userId: string,
  agentId: string
): Promise<ManagedAgent | null> {
  const { rows } = await pool.query<ManagedAgent>(
    `${managedAgentSelect} WHERE id = $1 AND user_id = $2`,
    [agentId, userId]
  );
  return rows[0] ? hydrateManagedAgent(rows[0]) : null;
}

export type AgentTargetResolution = NamedAgentTargetResolution<ManagedAgent>;

export async function resolveAgentTarget(
  userId: string,
  target: string
): Promise<AgentTargetResolution> {
  const agents = await listManagedAgents(userId);
  return resolveAgentTargetFromList(agents, target);
}

export async function setManagedAgentStatus(
  userId: string,
  agentId: string,
  status: "active" | "paused"
): Promise<ManagedAgent> {
  const existing = await requiredAgent(userId, agentId);
  if (existing.is_assistant) {
    throw new AgentServiceError(
      "ASSISTANT_UPDATE_NOT_SUPPORTED",
      "The Assistant contact cannot be paused or resumed."
    );
  }
  const { rows } = await pool.query<ManagedAgent>(
    `UPDATE agents SET status = $3
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [agentId, userId, status]
  );
  const agent = rows[0]!;
  await syncAgentScheduleForUser(agent, userId);
  await publishRealtimeEvent({
    type: "agent.updated",
    user_id: userId,
    agent_id: agent.id,
    data: { status: agent.status, schedule_cron: agent.schedule_cron }
  });
  await recordManagedAgentAudit(
    userId,
    agent.id,
    status === "paused" ? "pause" : "resume",
    "applied"
  );
  return agent;
}

export async function renameManagedAgent(
  userId: string,
  agentId: string,
  name: string
): Promise<ManagedAgent> {
  const clean = name.trim();
  if (clean.length < 1 || clean.length > 80) {
    throw new AgentServiceError(
      "INVALID_AGENT_UPDATE",
      "Agent names must be between 1 and 80 characters."
    );
  }
  await requiredAgent(userId, agentId);
  const { rows } = await pool.query<ManagedAgent>(
    `UPDATE agents SET name = $3 WHERE id = $1 AND user_id = $2 RETURNING *`,
    [agentId, userId, clean]
  );
  const agent = rows[0]!;
  await publishRealtimeEvent({
    type: "agent.updated",
    user_id: userId,
    agent_id: agent.id,
    data: { name: agent.name }
  });
  await recordManagedAgentAudit(userId, agent.id, "rename", "applied");
  return agent;
}

export async function updateManagedAgentDescription(
  userId: string,
  agentId: string,
  description: string
): Promise<ManagedAgent> {
  const existing = await requiredAgent(userId, agentId);
  const clean = description.trim();
  if (clean.length < 3 || clean.length > 4000) {
    throw new AgentServiceError(
      "INVALID_AGENT_UPDATE",
      "Agent functionality must be between 3 and 4000 characters."
    );
  }
  let reparsed = await parseIntentHybridForUser(userId, clean);
  const previous = typeof existing.parsed_intent === "string"
    ? JSON.parse(existing.parsed_intent)
    : existing.parsed_intent || {};
  // Drafting agents often keep Twitter/LinkedIn/Reddit in their description as output style.
  if (reparsed.unsupported_connector) {
    const platform = reparsed.unsupported_connector.toLowerCase();
    const existingIsDraftAgent =
      previous.intent === "content_extractor" ||
      looksLikeContentDraftPrompt(existing.prompt ?? "") ||
      looksLikeContentDraftPrompt(clean);
    if (isDraftOutputPlatformName(platform) && existingIsDraftAgent) {
      reparsed = await parseIntentHybridForUser(
        userId,
        `Content extractor agent: ${clean}`
      );
    }
  }
  if (reparsed.unsupported_connector) {
    throw new AgentServiceError(
      "UNSUPPORTED_CONNECTOR",
      `I can't access ${reparsed.unsupported_connector} yet.`,
      422
    );
  }
  const parsedIntent = {
    ...reparsed,
    // Keep drafting identity when the user only rewrote the description.
    ...(previous.intent === "content_extractor"
      ? {
          intent: "content_extractor",
          output_template: "content_extractor"
        }
      : {}),
    ...preservedAgentState(previous),
    ...(reparsed.intent === previous.intent
      ? preservedRecipeConfiguration(
          previous,
          reparsed as unknown as Record<string, unknown>,
          clean
        )
      : {})
  };
  const client = await pool.connect();
  let agent: ManagedAgent;
  try {
    await client.query("BEGIN");
    await reviseAgentDefinition(client, {
      agentId,
      userId,
      definition: compileAgentDefinition(parsedIntent, clean),
      name: existing.name,
      avatar: existing.avatar,
      prompt: clean,
      createdBy: "agent_service"
    });
    const { rows } = await client.query<ManagedAgent>(
      `${managedAgentSelect} WHERE id = $1 AND user_id = $2`,
      [agentId, userId]
    );
    agent = rows[0]!;
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  agent = await hydrateManagedAgent(agent);
  await syncAgentScheduleForUser(agent, userId);
  await publishRealtimeEvent({
    type: "agent.updated",
    user_id: userId,
    agent_id: agent.id,
    data: { status: agent.status, schedule_cron: agent.schedule_cron }
  });
  await recordManagedAgentAudit(userId, agent.id, "update", "applied");
  return agent;
}

export async function runManagedAgent(userId: string, agentId: string) {
  const agent = await requiredAgent(userId, agentId);
  if (agent.is_assistant) {
    throw new AgentServiceError(
      "ASSISTANT_RUN_NOT_SUPPORTED",
      "The Assistant contact does not run as a scheduled agent."
    );
  }
  if (agent.status !== "active") {
    throw new AgentServiceError(
      "AGENT_NOT_ACTIVE",
      "Only active agents can be run.",
      409
    );
  }
  const activeUntil = agent.parsed_intent?.active_until;
  if (activeUntil && new Date(activeUntil) <= new Date()) {
    await pool.query("UPDATE agents SET status = 'paused' WHERE id = $1", [
      agent.id
    ]);
    await syncAgentSchedule({
      id: agent.id,
      schedule_cron: agent.schedule_cron,
      status: "paused",
      is_assistant: false
    });
    throw new AgentServiceError(
      "AGENT_NOT_ACTIVE",
      "Only active agents can be run. This agent's active time has expired.",
      409
    );
  }
  const job = await enqueueAgentRun(agent.id, "manual");
  await publishRealtimeEvent({
    type: "run.queued",
    user_id: userId,
    agent_id: agent.id,
    data: { job_id: job.id, trigger: "manual" }
  });
  await recordManagedAgentAudit(userId, agent.id, "run", "queued", {
    job_id: job.id
  });
  void recordCuppetActivitySignal({
    userId,
    eventType: "agent_retained",
    subjectType: "agent_type",
    subjectKey: `agent_${agent.id}`,
    agentId: agent.id
  }).catch((error) => {
    console.error("Agent retention preference recording failed:", error);
  });
  return { agent, job };
}

export async function deleteManagedAgent(
  userId: string,
  agentId: string
): Promise<ManagedAgent> {
  const existing = await requiredAgent(userId, agentId);
  if (existing.is_assistant) {
    throw new AgentServiceError(
      "ASSISTANT_CANNOT_BE_DELETED",
      "The Assistant contact is always available."
    );
  }
  await removeScheduleForAgent(agentId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      [userId, agentId]
    );
    await client.query("DELETE FROM agents WHERE id = $1 AND user_id = $2", [
      agentId,
      userId
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await publishRealtimeEvent({
    type: "agent.deleted",
    user_id: userId,
    agent_id: agentId,
    data: {}
  });
  await recordManagedAgentAudit(userId, agentId, "delete", "applied");
  return existing;
}

async function recordManagedAgentAudit(
  userId: string,
  targetAgentId: string,
  action: string,
  status: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  await pool.query(
    `INSERT INTO assistant_agent_action_audits
      (user_id, target_agent_id, action, status, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, targetAgentId, action, status, JSON.stringify(detail)]
  );
}

async function requiredAgent(userId: string, agentId: string): Promise<ManagedAgent> {
  const agent = await getManagedAgent(userId, agentId);
  if (!agent) {
    throw new AgentServiceError("AGENT_NOT_FOUND", "Agent not found.", 404);
  }
  return agent;
}

function preservedAgentState(intent: Record<string, unknown>) {
  const preserved: Record<string, unknown> = {};
  for (const key of [
    "active_until",
    "history",
    "notifications_muted",
    "response_limit",
    "topics_covered"
  ]) {
    if (intent[key] !== undefined) preserved[key] = intent[key];
  }
  return preserved;
}

function preservedRecipeConfiguration(
  previousIntent: Record<string, unknown>,
  reparsedIntent: Record<string, unknown>,
  description: string
) {
  return {
    ...(typeof previousIntent.recipe_version === "number"
      ? { recipe_version: previousIntent.recipe_version }
      : {}),
    ...(typeof previousIntent.prompt_profile_version === "number"
      ? { prompt_profile_version: previousIntent.prompt_profile_version }
      : {}),
    recipe_inputs: mergeRecipeInputsForDescriptionUpdate({
      previousIntent,
      reparsedIntent,
      description
    })
  };
}

const managedAgentSelect = `
  SELECT id, user_id, name, avatar, prompt, parsed_intent, connector_ids,
         schedule_cron, is_assistant, status, safety_level, last_message_at,
         created_at, updated_at
  FROM agents`;

async function hydrateManagedAgent(
  agent: ManagedAgent
): Promise<ManagedAgent> {
  if (agent.is_assistant) return agent;
  const [configuration, runtimeState] = await Promise.all([
    loadCurrentAgentDefinition(agent.id),
    loadRuntimeState(agent.id)
  ]);
  if (!configuration) return agent;
  return {
    ...agent,
    parsed_intent: definitionToParsedIntent(configuration.definition, {
      name: agent.name,
      avatar: agent.avatar,
      runtimeState
    })
  };
}

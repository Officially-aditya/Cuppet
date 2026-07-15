import type { FastifyBaseLogger } from "fastify";
import { config } from "../config.js";
import { pool } from "../db/index.js";
import {
  listAgentSchedules,
  removeAgentSchedule,
  scheduleAgentRun
} from "../queue/index.js";
import { parseIntent, type ParsedIntent } from "./parser.js";
import { effectiveTimeZone } from "../users/time-zone.js";

type SchedulableAgent = {
  id: string;
  schedule_cron: string | null;
  status: "active" | "paused" | "error";
  is_assistant: boolean;
  time_zone?: string | null;
};

export type ScheduleSyncSummary = {
  attempted: number;
  scheduled: number;
  failed: number;
};

type ReclassifiableAgent = {
  id: string;
  prompt: string;
  parsed_intent: ParsedIntent;
  schedule_cron: string | null;
};

export async function syncAgentSchedule(agent: SchedulableAgent): Promise<void> {
  if (agent.is_assistant || agent.status !== "active" || !agent.schedule_cron) {
    await removeAgentSchedule(agent.id);
    return;
  }

  await scheduleAgentRun(agent.id, agent.schedule_cron, await agentTimeZone(agent));
}

export async function syncAgentScheduleForUser(
  agent: SchedulableAgent,
  userId: string
): Promise<void> {
  if (agent.is_assistant || agent.status !== "active" || !agent.schedule_cron) {
    await syncAgentSchedule(agent);
    return;
  }

  await syncAgentSchedule({
    ...agent,
    time_zone: await getUserScheduleTimeZone(userId)
  });
}

export async function getUserScheduleTimeZone(userId: string): Promise<string> {
  const { rows } = await pool.query<{ time_zone: string | null }>(
    "SELECT time_zone FROM users WHERE id = $1 FOR KEY SHARE",
    [userId]
  );

  return effectiveTimeZone(
    rows[0]?.time_zone,
    config.AGENT_SCHEDULE_TIME_ZONE
  );
}

async function agentTimeZone(agent: SchedulableAgent): Promise<string> {
  if (agent.time_zone !== undefined) {
    return effectiveTimeZone(
      agent.time_zone,
      config.AGENT_SCHEDULE_TIME_ZONE
    );
  }

  const { rows } = await pool.query<{ time_zone: string | null }>(
    `
      SELECT u.time_zone
      FROM agents a
      JOIN users u ON u.id = a.user_id
      WHERE a.id = $1
    `,
    [agent.id]
  );

  return effectiveTimeZone(
    rows[0]?.time_zone,
    config.AGENT_SCHEDULE_TIME_ZONE
  );
}

export async function rescheduleActiveAgentSchedulesForUser(
  userId: string,
  timeZone: string,
  logger?: FastifyBaseLogger
): Promise<ScheduleSyncSummary> {
  const { rows } = await pool.query<SchedulableAgent>(
    `
      SELECT id, schedule_cron, status, is_assistant
      FROM agents
      WHERE user_id = $1
        AND is_assistant = FALSE
        AND status = 'active'
        AND schedule_cron IS NOT NULL
    `,
    [userId]
  );

  const summary: ScheduleSyncSummary = {
    attempted: rows.length,
    scheduled: 0,
    failed: 0
  };
  const effective = effectiveTimeZone(
    timeZone,
    config.AGENT_SCHEDULE_TIME_ZONE
  );

  for (const agent of rows) {
    try {
      await syncAgentSchedule({ ...agent, time_zone: effective });
      summary.scheduled += 1;
    } catch (error) {
      summary.failed += 1;
      logger?.warn(
        { error, userId, agentId: agent.id, timeZone: effective },
        "Failed to reschedule agent after user time-zone update"
      );
    }
  }

  return summary;
}

export async function removeScheduleForAgent(agentId: string): Promise<void> {
  await removeAgentSchedule(agentId);
}

export async function syncActiveAgentSchedules(
  logger?: FastifyBaseLogger
): Promise<void> {
  await reconcileCustomAgentIntents(logger);

  const { rows } = await pool.query<SchedulableAgent>(
    `
      SELECT
        a.id,
        a.schedule_cron,
        a.status,
        a.is_assistant,
        u.time_zone
      FROM agents a
      JOIN users u ON u.id = a.user_id
      WHERE a.is_assistant = FALSE
        AND a.status = 'active'
        AND a.schedule_cron IS NOT NULL
    `
  );

  for (const agent of rows) {
    await syncAgentSchedule(agent);
  }

  const removed = await removeOrphanedAgentSchedules(
    new Set(rows.map((agent) => agent.id))
  );

  logger?.info(
    { count: rows.length, removed_orphaned_schedules: removed },
    "Synced active agent schedules"
  );
}

async function removeOrphanedAgentSchedules(activeAgentIds: Set<string>): Promise<number> {
  const schedulers = await listAgentSchedules();
  let removed = 0;

  for (const scheduler of schedulers) {
    const agentId = scheduler.key.startsWith("agent:")
      ? scheduler.key.slice("agent:".length)
      : null;

    if (!agentId || activeAgentIds.has(agentId)) {
      continue;
    }

    await removeAgentSchedule(agentId);
    removed += 1;
  }

  return removed;
}

async function reconcileCustomAgentIntents(
  logger?: FastifyBaseLogger
): Promise<void> {
  const { rows } = await pool.query<ReclassifiableAgent>(
    `
      SELECT id, prompt, parsed_intent, schedule_cron
      FROM agents
      WHERE is_assistant = FALSE
        AND parsed_intent->>'intent' = 'custom_read_agent'
    `
  );

  let updated = 0;
  for (const agent of rows) {
    const parsedIntent = parseIntent(agent.prompt);
    if (
      parsedIntent.unsupported_connector ||
      parsedIntent.intent === "custom_read_agent"
    ) {
      continue;
    }

    await pool.query(
      `
        UPDATE agents
        SET name = $2,
            avatar = $3,
            parsed_intent = $4,
            connector_ids = $5,
            schedule_cron = COALESCE(schedule_cron, $6),
            safety_level = $7,
            updated_at = NOW()
        WHERE id = $1
          AND parsed_intent->>'intent' = 'custom_read_agent'
      `,
      [
        agent.id,
        parsedIntent.name,
        parsedIntent.avatar,
        JSON.stringify(parsedIntent),
        parsedIntent.connector_ids,
        parsedIntent.schedule_cron,
        parsedIntent.safety_level
      ]
    );
    updated += 1;
  }

  if (updated > 0) {
    logger?.info({ count: updated }, "Reclassified custom agents from prompts");
  }
}

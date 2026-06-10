import type { FastifyBaseLogger } from "fastify";
import { pool } from "../db/index.js";
import { removeAgentSchedule, scheduleAgentRun } from "../queue/index.js";

type SchedulableAgent = {
  id: string;
  schedule_cron: string | null;
  status: "active" | "paused" | "error";
  is_assistant: boolean;
};

export async function syncAgentSchedule(agent: SchedulableAgent): Promise<void> {
  if (agent.is_assistant || agent.status !== "active" || !agent.schedule_cron) {
    await removeAgentSchedule(agent.id);
    return;
  }

  await scheduleAgentRun(agent.id, agent.schedule_cron);
}

export async function removeScheduleForAgent(agentId: string): Promise<void> {
  await removeAgentSchedule(agentId);
}

export async function syncActiveAgentSchedules(
  logger?: FastifyBaseLogger
): Promise<void> {
  const { rows } = await pool.query<SchedulableAgent>(
    `
      SELECT id, schedule_cron, status, is_assistant
      FROM agents
      WHERE is_assistant = FALSE
        AND status = 'active'
        AND schedule_cron IS NOT NULL
    `
  );

  for (const agent of rows) {
    await syncAgentSchedule(agent);
  }

  logger?.info({ count: rows.length }, "Synced active agent schedules");
}

import { Queue, type ConnectionOptions } from "bullmq";
import { config } from "../config.js";

const redisUrl = new URL(config.REDIS_URL);

export const agentExecutorQueueName = "agent-executor";
export const agentExecutorJobName = "agent.execute";

export type AgentRunTrigger = "manual" | "schedule";

export type AgentExecutorJobData = {
  agentId: string;
  trigger: AgentRunTrigger;
};

export const redisConnection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null
};

export const agentExecutorQueue = new Queue<AgentExecutorJobData>(
  agentExecutorQueueName,
  {
    connection: redisConnection
  }
);

export async function enqueueAgentRun(
  agentId: string,
  trigger: AgentRunTrigger = "manual"
) {
  return agentExecutorQueue.add(
    agentExecutorJobName,
    { agentId, trigger },
    {
      attempts: 2,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 }
    }
  );
}

export async function scheduleAgentRun(
  agentId: string,
  cronPattern: string
) {
  return agentExecutorQueue.upsertJobScheduler(
    agentSchedulerId(agentId),
    { pattern: cronPattern, tz: config.AGENT_SCHEDULE_TIME_ZONE },
    {
      name: agentExecutorJobName,
      data: { agentId, trigger: "schedule" },
      opts: {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 }
      }
    }
  );
}

export async function removeAgentSchedule(agentId: string): Promise<boolean> {
  return agentExecutorQueue.removeJobScheduler(agentSchedulerId(agentId));
}

function agentSchedulerId(agentId: string): string {
  return `agent:${agentId}`;
}

export async function closeQueue(): Promise<void> {
  await agentExecutorQueue.close();
}

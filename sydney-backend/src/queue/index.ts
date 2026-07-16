import {
  Queue,
  type ConnectionOptions,
  type JobSchedulerJson
} from "bullmq";
import { createHash } from "node:crypto";
import { config } from "../config.js";

const redisUrl = new URL(config.REDIS_URL);

export const agentExecutorQueueName = "agent-executor";
export const agentExecutorJobName = "agent.execute";
export const messageArchiveQueueName = "message-archive";
export const messageArchiveJobName = "message-archive.export-user";

export type MessageArchiveJobData = { userId: string };

export type AgentRunTrigger = "manual" | "schedule" | "snooze" | "event";

export type AgentExecutorJobData = {
  agentId: string;
  trigger: AgentRunTrigger;
  snoozedMessageId?: string;
  eventId?: string;
  eventSource?: string;
  eventType?: string;
};

export const redisConnection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  tls: redisUrl.protocol === "rediss:" ? {} : undefined,
  maxRetriesPerRequest: null
};

const producerRedisConnection: ConnectionOptions = {
  ...redisConnection,
  maxRetriesPerRequest: 1
};

export const agentExecutorQueue = new Queue<AgentExecutorJobData>(
  agentExecutorQueueName,
  {
    connection: producerRedisConnection
  }
);

export const messageArchiveQueue = new Queue<MessageArchiveJobData>(
  messageArchiveQueueName,
  { connection: producerRedisConnection }
);

export async function enqueueMessageArchive(userId: string) {
  const hour = new Date().toISOString().slice(0, 13).replace(/[-T]/g, "");
  const userKey = createHash("sha256").update(userId).digest("hex").slice(0, 20);
  return messageArchiveQueue.add(
    messageArchiveJobName,
    { userId },
    {
      jobId: `message-archive-${userKey}-${hour}`,
      attempts: 6,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: true,
      removeOnFail: { count: 1000 }
    }
  );
}

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

export async function enqueueAgentEvent(input: {
  agentId: string;
  eventId: string;
  eventSource: string;
  eventType: string;
}) {
  return agentExecutorQueue.add(
    agentExecutorJobName,
    {
      agentId: input.agentId,
      trigger: "event",
      eventId: input.eventId,
      eventSource: input.eventSource,
      eventType: input.eventType
    },
    {
      jobId: `event-${input.eventId}-${input.agentId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 }
    }
  );
}

export async function scheduleAgentRun(
  agentId: string,
  cronPattern: string,
  timeZone: string
) {
  return agentExecutorQueue.upsertJobScheduler(
    agentSchedulerId(agentId),
    { pattern: cronPattern, tz: timeZone },
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

export async function listAgentSchedules(): Promise<
  Array<JobSchedulerJson<AgentExecutorJobData>>
> {
  return agentExecutorQueue.getJobSchedulers(0, -1, true);
}

function agentSchedulerId(agentId: string): string {
  return `agent:${agentId}`;
}

export async function closeQueue(): Promise<void> {
  await Promise.all([agentExecutorQueue.close(), messageArchiveQueue.close()]);
}

import { Worker, type Job } from "bullmq";
import { exportAvailableMessages } from "../archive/message-archive.js";
import {
  messageArchiveJobName,
  messageArchiveQueueName,
  redisConnection,
  type MessageArchiveJobData
} from "../queue/index.js";

export function createMessageArchiveWorker() {
  return new Worker<MessageArchiveJobData>(
    messageArchiveQueueName,
    async (job: Job<MessageArchiveJobData>) => {
      if (job.name !== messageArchiveJobName) return { skipped: "unknown_job" };
      return exportAvailableMessages(job.data.userId);
    },
    { connection: redisConnection, concurrency: 2 }
  );
}

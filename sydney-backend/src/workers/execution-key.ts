export type ExecutionKeyInput = {
  agentId: string;
  trigger: "manual" | "schedule";
  jobId?: string;
  timestamp: number;
  delay?: number;
};

export function agentExecutionKey(input: ExecutionKeyInput): string | null {
  if (input.trigger === "manual") {
    return input.jobId ? `manual:${input.agentId}:${input.jobId}` : null;
  }

  const scheduledTimestamp = timestampFromJobId(input.jobId)
    ?? input.timestamp + (input.delay ?? 0);
  const scheduledMinute = Math.floor(scheduledTimestamp / 60_000) * 60_000;
  return `schedule:${input.agentId}:${scheduledMinute}`;
}

function timestampFromJobId(jobId: string | undefined): number | null {
  const rawTimestamp = jobId?.match(/:(\d{10,})$/)?.[1];
  if (!rawTimestamp) return null;

  const timestamp = Number(rawTimestamp);
  return Number.isSafeInteger(timestamp) ? timestamp : null;
}

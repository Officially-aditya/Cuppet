export function shouldRetryAgentRun(
  attemptsMade: number,
  configuredAttempts: number | undefined
): boolean {
  const attempts = Math.max(1, configuredAttempts ?? 1);
  return attemptsMade + 1 < attempts;
}

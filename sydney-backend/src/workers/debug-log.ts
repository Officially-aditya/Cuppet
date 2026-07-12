/**
 * Opt-in verbose logging for agent executor internals.
 * Enable with DEBUG_AGENT_EXECUTOR=1
 */
export function agentDebug(...args: unknown[]): void {
  if (process.env.DEBUG_AGENT_EXECUTOR === "1") {
    console.log(...args);
  }
}

export type AgentWorkerRuntimeStatus =
  | "starting"
  | "ready"
  | "error"
  | "disabled"
  | "closed";

let status: AgentWorkerRuntimeStatus = "disabled";

export function setAgentWorkerRuntimeStatus(
  nextStatus: AgentWorkerRuntimeStatus
): void {
  status = nextStatus;
}

export function agentWorkerRuntimeStatus(): AgentWorkerRuntimeStatus {
  return status;
}

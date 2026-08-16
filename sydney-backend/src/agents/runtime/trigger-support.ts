export const realtimeAgentIntentIds = [
  "github_activity_digest",
  "slack_urgent_watcher",
  "lead_response_monitor",
  "calendar_agenda",
  "drive_summary",
  "pdf_summary",
  "meeting_recap",
  "portfolio_watch"
] as const;

const realtimeAgentIntents = new Set<string>(realtimeAgentIntentIds);

export function supportsRealtimeAgentIntent(intent: string): boolean {
  return realtimeAgentIntents.has(intent);
}

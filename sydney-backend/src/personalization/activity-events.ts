import { recordPreferenceEvent } from "./event-writer.js";
import type { PreferenceDimension } from "./types.js";

export const activityEventTypes = [
  "content_expanded",
  "follow_up_question",
  "agent_retained",
  "notification_muted",
  "result_dismissed"
] as const;

export type ActivityEventType = (typeof activityEventTypes)[number];

const activityStrength: Record<ActivityEventType, number> = {
  content_expanded: 0.15,
  follow_up_question: 0.5,
  agent_retained: 0.4,
  notification_muted: 0.35,
  result_dismissed: 0.2
};

export async function recordCuppetActivitySignal(input: {
  userId: string;
  eventType: ActivityEventType;
  subjectType: PreferenceDimension;
  subjectKey: string;
  provenanceId?: string;
  messageId?: string;
  agentId?: string;
}): Promise<{ stored: boolean; reason?: string }> {
  const negative = input.eventType === "notification_muted" || input.eventType === "result_dismissed";
  const result = await recordPreferenceEvent({
    userId: input.userId,
    purpose: "cuppet_activity",
    eventType: input.eventType,
    subjectType: input.subjectType,
    subjectKey: input.subjectKey,
    polarity: negative ? -1 : 1,
    strength: activityStrength[input.eventType],
    provenanceType: "cuppet_activity",
    provenanceId: input.provenanceId,
    messageId: input.messageId,
    agentId: input.agentId,
    expiresAt: new Date(Date.now() + 90 * 86_400_000)
  });
  return result.stored ? { stored: true } : { stored: false, reason: result.reason };
}

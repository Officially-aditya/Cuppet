import type { AgentRunTrigger } from "../queue/index.js";
import type { AgentRow } from "./agent-types.js";

export function scheduledIntro(
  agent: AgentRow,
  label: string,
  trigger?: AgentRunTrigger
): string {
  return `${scheduledTitle(agent, label, trigger)}.`;
}

export function scheduledTitle(
  agent: AgentRow,
  label: string,
  trigger?: AgentRunTrigger
): string {
  if (trigger === "manual") {
    return `Here's the ${label} you requested`;
  }
  if (trigger === "snooze") {
    return `Here's your snoozed ${label}`;
  }
  if (trigger === "event") {
    return `New ${label}`;
  }
  const time = scheduleTimeLabel(agent.schedule_cron);
  return time ? `Here's your ${time} ${label}` : `Here's your ${label}`;
}

export function scheduleTimeLabel(cron: string | null): string | null {
  const daily = cron?.match(/^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/);
  if (!daily) {
    return null;
  }

  const minute = Number(daily[1]);
  const hour24 = Number(daily[2]);
  const meridiem = hour24 >= 12 ? "pm" : "am";
  const hour12 = hour24 % 12 || 12;
  const minutePart = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  return `${hour12}${minutePart}${meridiem}`;
}

export function withPeriod(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function topicLabel(prompt: string, fallback: string): string {
  const funding = prompt.match(
    /\b(?:about|on)\s+(.+?)\s+(?:every|daily|at|morning|evening|weekly|$)/i
  );
  if (funding?.[1]) {
    return `${funding[1].trim()} brief`;
  }

  return fallback;
}

export function wantsTechNewsBrief(text: string): boolean {
  return /\btech(?:nology)?\s+news\b/i.test(text);
}

export function wantsNewsBrief(text: string): boolean {
  return /\b(?:news|headlines?)\b/i.test(text);
}

export function reminderWithoutDynamicRequests(action: string): string {
  return action
    .replace(/^reminder:\s*/i, "")
    .replace(
      /\s*(?:,?\s*(?:and|along with reminders?)\s*)?(?:send|give|share|include)\s+me\s+(?:the\s+)?(?:dsa|data structures?\s*(?:and|&)\s*algorithms?|algorithm)\s+(?:question|problem|challenge)(?:\s+of\s+the\s+day|\s+daily)?\s*\.?$/i,
      ""
    )
    .replace(
      /\s*(?:,?\s*(?:and|along with reminders?)\s*)?(?:send|give|share|include)\s+me\s+(?:the\s+)?(?:tech(?:nology)?\s+)?(?:news|headlines?)(?:\s+(?:brief|digest))?(?:\s+of\s+the\s+day|\s+daily)?\s*\.?$/i,
      ""
    )
    .replace(/\s+\band\s*$/i, "")
    .replace(/\s*,\s*$/, "")
    .trim()
    .replace(/\s+\.$/, "");
}

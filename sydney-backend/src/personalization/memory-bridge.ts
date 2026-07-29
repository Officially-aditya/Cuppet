import type { AssistantMemory } from "../assistant/memory.js";
import { recordPreferenceEvent, removePreferenceEventsByProvenance } from "./event-writer.js";

export async function bridgeConfirmedMemory(
  userId: string,
  memory: AssistantMemory
): Promise<void> {
  if (memory.status !== "confirmed") return;
  await removePreferenceEventsByProvenance(userId, "confirmed_memory", memory.id);
  const dimension = memoryDimension(memory.memory_type, memory.canonical_key);
  await recordPreferenceEvent({
    userId,
    purpose: "explicit_feedback",
    eventType: "confirmed_memory",
    subjectType: dimension,
    subjectKey: memory.canonical_key,
    polarity: memory.memory_type === "constraint" ? -1 : 1,
    strength: 1,
    provenanceType: "confirmed_memory",
    provenanceId: memory.id
  });
}

export async function removeBridgedMemory(
  userId: string,
  memoryId: string
): Promise<void> {
  await removePreferenceEventsByProvenance(userId, "confirmed_memory", memoryId);
}

function memoryDimension(
  memoryType: AssistantMemory["memory_type"],
  canonicalKey: string
): "topic" | "source" | "format" | "exclusion" {
  if (memoryType === "constraint") return "exclusion";
  const key = canonicalKey.toLowerCase();
  if (/\b(?:format|summary|concise|brief|detailed|tone|style)\b/.test(key)) {
    return "format";
  }
  if (/\b(?:source|publisher|site|newsletter|domain)\b/.test(key)) {
    return "source";
  }
  return "topic";
}

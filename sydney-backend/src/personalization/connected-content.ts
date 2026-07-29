import { recordPreferenceEvent } from "./event-writer.js";

export async function recordConnectedContentSignals(input: {
  userId: string;
  sourceRefs: unknown[];
  agentId?: string;
  messageId?: string;
}): Promise<void> {
  const sources = new Set<string>();
  for (const value of input.sourceRefs) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    const source = connectedSourceKey(record);
    if (source) sources.add(source);
  }
  if (sources.size === 0) return;

  await Promise.all(
    [...sources].flatMap((source) => [
      recordPreferenceEvent({
        userId: input.userId,
        purpose: "connected_content",
        eventType: "connected_source_used",
        subjectType: "source",
        subjectKey: source,
         polarity: 1,
         strength: 0.15,
        provenanceType: "connected_content",
        provenanceId: input.messageId,
        serviceKey: source,
        agentId: input.agentId,
        messageId: input.messageId,
        properties: { source_kind: sourceKind(source) }
      }),
      recordPreferenceEvent({
        userId: input.userId,
        purpose: "connected_content",
        eventType: "connected_format_used",
        subjectType: "format",
        subjectKey: `connected_${sourceKind(source)}`,
         polarity: 1,
         strength: 0.1,
        provenanceType: "connected_content",
        provenanceId: input.messageId,
        serviceKey: source,
        agentId: input.agentId,
        messageId: input.messageId
      })
    ])
  );

  if (sources.size > 1) {
    await recordPreferenceEvent({
      userId: input.userId,
      purpose: "cross_source",
      eventType: "cross_source_answer_used",
      subjectType: "capability",
      subjectKey: "cross_source_context",
      polarity: 1,
      strength: 0.2,
      provenanceType: "cross_source",
      provenanceId: input.messageId,
      messageId: input.messageId,
      properties: { source_count: sources.size }
    });
  }
}

function connectedSourceKey(record: Record<string, unknown>): string | null {
  const type = typeof record.type === "string" ? record.type.toLowerCase() : "";
  if (type === "mcp_tool") return firstString(record.provider_id, record.source);
  if (
    type.startsWith("gmail_") ||
    type.startsWith("drive_") ||
    type.startsWith("calendar_") ||
    type.startsWith("github_") ||
    type.startsWith("slack_") ||
    type.startsWith("notion_")
  ) {
    return type.split("_", 1)[0] ?? null;
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized.slice(0, 120);
  }
  return null;
}

function sourceKind(source: string): string {
  const normalized = source.toLowerCase();
  if (normalized.includes("gmail") || normalized.includes("mail")) return "email";
  if (normalized.includes("calendar")) return "calendar";
  if (normalized.includes("drive")) return "files";
  if (normalized.includes("github")) return "code";
  if (normalized.includes("slack")) return "team_messages";
  if (normalized.includes("notion")) return "documents";
  if (normalized.startsWith("mcp.")) return "connected_provider";
  return "connected_source";
}

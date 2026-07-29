import { pool } from "../db/index.js";

const productEventNames = new Set([
  "suggestion_delivered",
  "suggestion_decided",
  "suggestion_push_sent",
  "message_feedback",
  "personalization_consent_changed",
  "personalization_reset"
]);

export async function recordPersonalizationProductEvent(input: {
  userId: string;
  eventName: string;
  suggestionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!productEventNames.has(input.eventName)) return;
  await pool.query(
    `INSERT INTO personalization_product_events
       (user_id, event_name, suggestion_id, metadata)
     VALUES ($1, $2, $3, $4)`,
    [
      input.userId,
      input.eventName,
      input.suggestionId ?? null,
      JSON.stringify(minimizeAnalyticsMetadata(input.metadata))
    ]
  );
}

function minimizeAnalyticsMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, string | number | boolean> {
  if (!metadata) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!/^[a-z0-9_]{1,60}$/i.test(key)) continue;
    if (/(?:sponsor|advertis|campaign|bid|promotion|targeting|broker|license)/i.test(key)) continue;
    if (typeof value === "string") result[key] = value.slice(0, 80);
    else if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
    else if (typeof value === "boolean") result[key] = value;
  }
  return result;
}

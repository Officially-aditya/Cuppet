import { z } from "zod";

export const browserPreferenceEventSchema = z
  .object({
    event_id: z.string().trim().min(8).max(120),
    event_type: z.enum(["page_view", "save", "search"]),
    domain: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^(?:[a-z0-9-]+\.)+[a-z]{2,63}$/)
      .max(180),
    category: z.string().trim().min(1).max(80).optional(),
    duration_seconds: z.number().int().min(0).max(86_400).optional(),
    occurred_at: z.string().datetime().optional()
  })
  .strict();

export type BrowserPreferenceEvent = z.infer<typeof browserPreferenceEventSchema>;

export async function recordBrowserPreferenceEvent(
  userId: string,
  input: BrowserPreferenceEvent
): Promise<{ stored: boolean; reason?: string }> {
  const { pool } = await import("../db/index.js");
  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM preference_events
     WHERE user_id = $1 AND provenance_type = 'browser_activity' AND provenance_id = $2
     LIMIT 1`,
    [userId, input.event_id]
  );
  if (existing.rows[0]) return { stored: true };
  const { recordPreferenceEvent } = await import("./event-writer.js");
  const sourceResult = await recordPreferenceEvent({
    userId,
    purpose: "browser_activity",
    eventType: `browser_${input.event_type}`,
    subjectType: "source",
    subjectKey: input.domain,
    polarity: input.event_type === "page_view" ? 0 : 1,
    strength: input.event_type === "save" ? 0.8 : input.event_type === "search" ? 0.45 : 0.15,
    provenanceType: "browser_activity",
    provenanceId: input.event_id,
    serviceKey: input.domain,
    properties: {
      category: input.category ?? "",
      duration_seconds: input.duration_seconds ?? 0
    },
    occurredAt: input.occurred_at ? new Date(input.occurred_at) : new Date()
  });
  if (input.category) {
    await recordPreferenceEvent({
      userId,
      purpose: "browser_activity",
      eventType: "browser_category_used",
      subjectType: "topic",
      subjectKey: input.category,
      polarity: input.event_type === "page_view" ? 0 : 1,
      strength: input.event_type === "save" ? 0.7 : 0.25,
      provenanceType: "browser_activity",
      provenanceId: input.event_id,
      serviceKey: input.domain,
      properties: { domain_kind: "browser_domain" },
      occurredAt: input.occurred_at ? new Date(input.occurred_at) : new Date()
    });
  }
  return sourceResult.stored
    ? { stored: true }
    : { stored: false, reason: sourceResult.reason };
}

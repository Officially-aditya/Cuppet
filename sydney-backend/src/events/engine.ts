import { pool } from "../db/index.js";

export type EventSource =
  | "slack"
  | "github"
  | "gmail"
  | "calendar"
  | "drive"
  | "stock";

export type NormalizedAgentEvent = {
  source: EventSource;
  externalEventId: string;
  eventType: string;
  externalAccountId: string;
  subjectId?: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  targetUserIds?: string[];
};

export type EventIngestionResult = {
  eventId: string;
  duplicate: boolean;
  queuedAgentIds: string[];
  suppressedAgentIds: string[];
};

type EventAgent = {
  id: string;
  parsed_intent: Record<string, unknown> | string;
};

export async function ingestAgentEvent(
  event: NormalizedAgentEvent
): Promise<EventIngestionResult> {
  const client = await pool.connect();
  let eventId: string;
  const queuedAgentIds: string[] = [];
  const suppressedAgentIds: string[] = [];

  try {
    await client.query("BEGIN");
    const inserted = await client.query<{ id: string }>(
      `
        INSERT INTO inbound_events
          (source, external_event_id, event_type, external_account_id,
           subject_id, payload, occurred_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (source, external_event_id) DO NOTHING
        RETURNING id
      `,
      [
        event.source,
        event.externalEventId,
        event.eventType,
        event.externalAccountId,
        event.subjectId ?? null,
        JSON.stringify(event.payload),
        event.occurredAt
      ]
    );
    if (!inserted.rows[0]) {
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM inbound_events
         WHERE source = $1 AND external_event_id = $2`,
        [event.source, event.externalEventId]
      );
      await client.query("COMMIT");
      return {
        eventId: existing.rows[0]!.id,
        duplicate: true,
        queuedAgentIds,
        suppressedAgentIds
      };
    }
    eventId = inserted.rows[0].id;

    const connectorId = connectorForSource(event.source);
    let userIds = [...new Set(event.targetUserIds ?? [])];
    if (userIds.length === 0) {
      const userRows = await client.query<{ user_id: string }>(
        `
          SELECT DISTINCT user_id
          FROM connector_installations
          WHERE connector_id = $1 AND lower(external_account_id) = lower($2)
          UNION
          SELECT id AS user_id
          FROM users
          WHERE $1 = 'gmail' AND lower(email) = lower($2)
        `,
        [connectorId, event.externalAccountId]
      );
      userIds = userRows.rows.map((row) => row.user_id);
    }
    if (userIds.length === 0) {
      await client.query("COMMIT");
      return {
        eventId,
        duplicate: false,
        queuedAgentIds,
        suppressedAgentIds
      };
    }

    const agents = await client.query<EventAgent>(
      `
        SELECT id, parsed_intent
        FROM agents
        WHERE user_id = ANY($1::text[])
          AND status = 'active'
          AND is_assistant = FALSE
          AND connector_ids @> ARRAY[$2]::text[]
      `,
      [userIds, connectorId]
    );

    for (const agent of agents.rows) {
      const parsedIntent = parseIntent(agent.parsed_intent);
      if (!shouldTriggerAgentEvent(parsedIntent, event)) continue;

      const cooldownSeconds = eventCooldownSeconds(parsedIntent, event.source);
      const recent = await client.query<{ exists: boolean }>(
        `
          SELECT EXISTS (
            SELECT 1 FROM event_deliveries
            WHERE agent_id = $1
              AND status IN ('queued', 'delivered')
              AND created_at > NOW() - ($2 * INTERVAL '1 second')
          ) AS exists
        `,
        [agent.id, cooldownSeconds]
      );
      const suppressed = recent.rows[0]?.exists === true;
      await client.query(
        `
          INSERT INTO event_deliveries (event_id, agent_id, status, reason)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (event_id, agent_id) DO NOTHING
        `,
        [
          eventId,
          agent.id,
          suppressed ? "suppressed" : "queued",
          suppressed ? `cooldown_${cooldownSeconds}s` : null
        ]
      );
      (suppressed ? suppressedAgentIds : queuedAgentIds).push(agent.id);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  for (const agentId of queuedAgentIds) {
    try {
      const { enqueueAgentEvent } = await import("../queue/index.js");
      await enqueueAgentEvent({
        agentId,
        eventId: eventId!,
        eventSource: event.source,
        eventType: event.eventType
      });
    } catch (error) {
      await pool.query(
        `UPDATE event_deliveries
         SET status = 'failed', reason = $3, updated_at = NOW()
         WHERE event_id = $1 AND agent_id = $2`,
        [eventId!, agentId, eventErrorMessage(error)]
      );
      throw error;
    }
  }

  return {
    eventId: eventId!,
    duplicate: false,
    queuedAgentIds,
    suppressedAgentIds
  };
}

export function shouldTriggerAgentEvent(
  parsedIntent: Record<string, unknown>,
  event: Pick<NormalizedAgentEvent, "source" | "eventType" | "payload">
): boolean {
  if (parsedIntent.realtime_enabled === false) return false;
  const intent = String(parsedIntent.intent ?? "");

  switch (event.source) {
    case "slack": {
      if (intent !== "slack_urgent_watcher") return false;
      const text = String(event.payload.text ?? "");
      return (
        event.eventType === "slack.app_mention" ||
        /\b(urgent|asap|blocker|blocked|critical|incident|outage|deadline)\b/i.test(
          text
        )
      );
    }
    case "github":
      return (
        intent === "github_activity_digest" &&
        ["push", "pull_request", "issues", "release", "workflow_run"].some(
          (type) => event.eventType === `github.${type}`
        )
      );
    case "gmail":
      return intent === "lead_response_monitor";
    case "calendar":
      return intent === "calendar_agenda";
    case "drive":
      return ["drive_summary", "pdf_summary", "meeting_recap"].includes(intent);
    case "stock":
      return (
        intent === "portfolio_watch" && event.payload.threshold_crossed === true
      );
  }
}

export function eventCooldownSeconds(
  parsedIntent: Record<string, unknown>,
  source: EventSource
): number {
  const configured = Number(parsedIntent.event_cooldown_seconds);
  if (Number.isFinite(configured)) {
    return Math.min(Math.max(Math.round(configured), 30), 86_400);
  }
  if (source === "slack") return 120;
  if (source === "github") return 60;
  return 300;
}

export async function upsertConnectorInstallation(input: {
  userId: string;
  connectorId: string;
  externalAccountId: string;
  externalAccountName?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO connector_installations
        (user_id, connector_id, external_account_id, external_account_name, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, connector_id)
      DO UPDATE SET
        external_account_id = EXCLUDED.external_account_id,
        external_account_name = EXCLUDED.external_account_name,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
    [
      input.userId,
      input.connectorId,
      input.externalAccountId,
      input.externalAccountName ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );
}

function connectorForSource(source: EventSource): string {
  return source;
}

function parseIntent(
  value: Record<string, unknown> | string
): Record<string, unknown> {
  if (typeof value !== "string") return value ?? {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function eventErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "event_queue_failed";
}

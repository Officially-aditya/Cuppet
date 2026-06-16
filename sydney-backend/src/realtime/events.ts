import { randomUUID } from "node:crypto";
import pg from "pg";
import type { FastifyBaseLogger } from "fastify";
import { config } from "../config.js";
import { pool } from "../db/index.js";

const realtimeChannel = "sydney_realtime_events";

export type RealtimeEventType =
  | "agent.created"
  | "agent.updated"
  | "message.created"
  | "messages.cleared"
  | "run.queued"
  | "run.started"
  | "run.completed"
  | "run.failed";

export type RealtimeEvent = {
  id: string;
  type: RealtimeEventType;
  user_id: string;
  agent_id?: string;
  message_id?: string;
  run_id?: string;
  created_at: string;
  data?: Record<string, unknown>;
};

type RealtimeSink = (event: RealtimeEvent) => void;

const subscribers = new Map<string, Set<RealtimeSink>>();
let listener: pg.Client | null = null;
let listenerStarted = false;

export async function publishRealtimeEvent(
  input: Omit<RealtimeEvent, "id" | "created_at">
): Promise<void> {
  const event: RealtimeEvent = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString()
  };

  await pool.query("SELECT pg_notify($1, $2)", [
    realtimeChannel,
    JSON.stringify(event)
  ]);
}

export async function subscribeToUserEvents(
  userId: string,
  sink: RealtimeSink,
  logger?: FastifyBaseLogger
): Promise<() => void> {
  await ensureListener(logger);

  const userSubscribers = subscribers.get(userId) ?? new Set<RealtimeSink>();
  userSubscribers.add(sink);
  subscribers.set(userId, userSubscribers);

  return () => {
    userSubscribers.delete(sink);
    if (userSubscribers.size === 0) {
      subscribers.delete(userId);
    }
  };
}

async function ensureListener(logger?: FastifyBaseLogger): Promise<void> {
  if (listenerStarted) {
    return;
  }

  listenerStarted = true;
  listener = new pg.Client({ connectionString: config.DATABASE_URL });
  listener.on("notification", (message) => {
    if (!message.payload) {
      return;
    }

    try {
      const event = JSON.parse(message.payload) as RealtimeEvent;
      const userSubscribers = subscribers.get(event.user_id);
      if (!userSubscribers) {
        return;
      }

      for (const sink of userSubscribers) {
        sink(event);
      }
    } catch (error) {
      logger?.warn({ error }, "Failed to parse realtime event payload");
    }
  });
  listener.on("error", (error) => {
    logger?.error({ error }, "Realtime listener failed");
    listenerStarted = false;
    listener = null;
  });

  await listener.connect();
  await listener.query(`LISTEN ${realtimeChannel}`);
}

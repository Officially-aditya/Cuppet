import type { PoolClient } from "pg";

export type AgentRuntimeState = {
  history: Record<string, boolean>;
  topics_covered: string[];
  current_chunk: number;
};

export type AgentStateEvent =
  | { type: "history.set"; key: string; value: boolean }
  | { type: "topics.add"; value: string | string[] }
  | { type: "topics.remove"; value: string }
  | { type: "current_chunk.set"; value: number };

export function reduceAgentRuntimeState(
  current: AgentRuntimeState,
  events: AgentStateEvent[]
): AgentRuntimeState {
  const state: AgentRuntimeState = {
    history: { ...current.history },
    topics_covered: [...current.topics_covered],
    current_chunk: current.current_chunk
  };
  for (const event of events) {
    if (event.type === "history.set") {
      state.history[event.key] = event.value;
    } else if (event.type === "topics.add") {
      const topics = Array.isArray(event.value) ? event.value : [event.value];
      state.topics_covered.push(...topics.filter(Boolean));
    } else if (event.type === "topics.remove") {
      state.topics_covered = state.topics_covered.filter(
        (topic) => topic !== event.value
      );
    } else if (event.type === "current_chunk.set") {
      state.current_chunk = Math.max(0, Math.round(event.value));
    }
  }
  return state;
}

export async function applyAgentStateEvents(
  client: PoolClient,
  agentId: string,
  events: AgentStateEvent[]
): Promise<AgentRuntimeState> {
  await client.query(
    `INSERT INTO agent_runtime_states (agent_id)
     VALUES ($1)
     ON CONFLICT (agent_id) DO NOTHING`,
    [agentId]
  );
  const { rows } = await client.query<{
    state: AgentRuntimeState | string;
    version: number;
  }>(
    `SELECT state, version
     FROM agent_runtime_states
     WHERE agent_id = $1
     FOR UPDATE`,
    [agentId]
  );
  const current = normalizeRuntimeState(rows[0]?.state);
  if (events.length === 0) return current;
  const next = reduceAgentRuntimeState(current, events);
  await client.query(
    `UPDATE agent_runtime_states
     SET state = $2, version = version + 1, updated_at = NOW()
     WHERE agent_id = $1`,
    [agentId, JSON.stringify(next)]
  );
  return next;
}

export function normalizeRuntimeState(value: unknown): AgentRuntimeState {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const history =
    record.history &&
    typeof record.history === "object" &&
    !Array.isArray(record.history)
      ? Object.fromEntries(
          Object.entries(record.history as Record<string, unknown>)
            .filter((entry): entry is [string, boolean] =>
              typeof entry[1] === "boolean"
            )
        )
      : {};
  const topics = Array.isArray(record.topics_covered)
    ? record.topics_covered.filter(
        (topic): topic is string => typeof topic === "string"
      )
    : [];
  const currentChunk = Number(record.current_chunk);
  return {
    history,
    topics_covered: topics,
    current_chunk:
      Number.isFinite(currentChunk) && currentChunk >= 0
        ? Math.round(currentChunk)
        : 0
  };
}

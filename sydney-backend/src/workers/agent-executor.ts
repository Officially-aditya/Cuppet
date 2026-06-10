import { Worker, type Job } from "bullmq";
import {
  createTechNewsBrief,
  type PlainTextMessageContent
} from "../agents/tech-news.js";
import { pool } from "../db/index.js";
import {
  agentExecutorQueueName,
  redisConnection,
  type AgentExecutorJobData
} from "../queue/index.js";
import { publishRealtimeEvent } from "../realtime/events.js";

type AgentRow = {
  id: string;
  user_id: string;
  name: string;
  prompt: string;
  parsed_intent: Record<string, unknown>;
  connector_ids: string[];
  schedule_cron: string | null;
  is_assistant: boolean;
  status: "active" | "paused" | "error";
  safety_level: "read" | "suggest" | "act";
};

type AgentMessageContent = PlainTextMessageContent;

export function createAgentExecutorWorker(): Worker<AgentExecutorJobData> {
  return new Worker<AgentExecutorJobData>(
    agentExecutorQueueName,
    executeAgentJob,
    {
      connection: redisConnection,
      concurrency: 5
    }
  );
}

async function executeAgentJob(
  job: Job<AgentExecutorJobData>
): Promise<{ messageId?: string; runId?: string; skipped?: string }> {
  const agent = await loadAgent(job.data.agentId);
  if (!agent) {
    return { skipped: "agent_not_found" };
  }

  if (agent.is_assistant) {
    return { skipped: "assistant_agent" };
  }

  if (agent.status !== "active") {
    return { skipped: "agent_not_active" };
  }

  const run = await createRun(agent.id);
  await publishRealtimeEvent({
    type: "run.started",
    user_id: agent.user_id,
    agent_id: agent.id,
    run_id: run.id,
    data: { trigger: job.data.trigger }
  });

  try {
    const rendered = await renderAgentMessage(agent, job.data.trigger);
    const message = await writeAgentMessage(agent, rendered.content, rendered.sourceRefs);

    await pool.query(
      `
        UPDATE agent_runs
        SET status = 'success', completed_at = NOW(), message_id = $1, tokens_used = $2
        WHERE id = $3
      `,
      [message.id, rendered.tokensUsed, run.id]
    );

    await publishRealtimeEvent({
      type: "message.created",
      user_id: agent.user_id,
      agent_id: agent.id,
      message_id: message.id,
      run_id: run.id,
      data: { role: "agent", trigger: job.data.trigger }
    });
    await publishRealtimeEvent({
      type: "run.completed",
      user_id: agent.user_id,
      agent_id: agent.id,
      message_id: message.id,
      run_id: run.id,
      data: { trigger: job.data.trigger, tokens_used: rendered.tokensUsed }
    });

    return { runId: run.id, messageId: message.id };
  } catch (error) {
    await markRunFailed(run.id, error);
    await publishRealtimeEvent({
      type: "run.failed",
      user_id: agent.user_id,
      agent_id: agent.id,
      run_id: run.id,
      data: { trigger: job.data.trigger, error: errorMessage(error) }
    });
    throw error;
  }
}

async function loadAgent(agentId: string): Promise<AgentRow | null> {
  const { rows } = await pool.query<AgentRow>(
    `
      SELECT
        id,
        user_id,
        name,
        prompt,
        parsed_intent,
        connector_ids,
        schedule_cron,
        is_assistant,
        status,
        safety_level
      FROM agents
      WHERE id = $1
    `,
    [agentId]
  );

  return rows[0] ?? null;
}

async function createRun(agentId: string): Promise<{ id: string }> {
  const { rows } = await pool.query<{ id: string }>(
    `
      INSERT INTO agent_runs (agent_id, status)
      VALUES ($1, 'running')
      RETURNING id
    `,
    [agentId]
  );

  return rows[0]!;
}

async function writeAgentMessage(
  agent: AgentRow,
  content: AgentMessageContent,
  sourceRefs: unknown[]
): Promise<{ id: string }> {
  const { rows } = await pool.query<{ id: string }>(
    `
      INSERT INTO agent_messages
        (agent_id, user_id, role, content, source_refs)
      VALUES ($1, $2, 'agent', $3, $4)
      RETURNING id
    `,
    [
      agent.id,
      agent.user_id,
      JSON.stringify(content),
      JSON.stringify(sourceRefs)
    ]
  );

  await pool.query(
    "UPDATE agents SET last_message_at = NOW() WHERE id = $1",
    [agent.id]
  );

  return rows[0]!;
}

async function markRunFailed(runId: string, error: unknown): Promise<void> {
  await pool.query(
    `
      UPDATE agent_runs
      SET status = 'failed', completed_at = NOW(), error_message = $1
      WHERE id = $2
    `,
    [errorMessage(error), runId]
  );
}

async function renderAgentMessage(
  agent: AgentRow,
  trigger: AgentExecutorJobData["trigger"]
): Promise<{ content: AgentMessageContent; sourceRefs: unknown[]; tokensUsed: number }> {
  if (agent.parsed_intent.intent === "tech_news_brief") {
    return createTechNewsBrief(agent.prompt, trigger);
  }

  if (agent.parsed_intent.intent === "scheduled_reminder") {
    return {
      content: {
        template: "plain_text",
        version: "1.0",
        data: {
          body: String(agent.parsed_intent.action ?? agent.prompt)
        }
      },
      sourceRefs: [],
      tokensUsed: 0
    };
  }

  return {
    content: {
      template: "plain_text",
      version: "1.0",
      data: {
        body: [
          `${agent.name} ran successfully.`,
          "",
          "This execution path is wired through BullMQ and Postgres. Connector-specific data collection will replace this placeholder response as each integration is added."
        ].join("\n")
      }
    },
    sourceRefs: [],
    tokensUsed: 0
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }

  return String(error).slice(0, 2000);
}

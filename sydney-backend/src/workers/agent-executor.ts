import { Worker, type Job } from "bullmq";
import {
  createDsaQuestionSection,
  wantsDsaQuestion
} from "../agents/dsa-question.js";
import {
  createGeneralNewsBrief,
  createTechNewsBrief
} from "../agents/tech-news.js";
import { renderLlmCustomAgent } from "../agents/custom-agent.js";
import {
  renderedChecklist,
  renderedComparison,
  renderedDailyTask,
  renderedDataSummary,
  renderedPlainText,
  renderedProgressTracker,
  renderedStreakCounter,
  renderedUrgencyList,
  renderedNewsBrief,
  parseNewsBriefText,
  type AgentMessageContent,
  type RenderedAgentMessage,
  type NewsBriefItem
} from "../agents/output.js";
import { pool } from "../db/index.js";
import {
  agentExecutorQueueName,
  redisConnection,
  type AgentExecutorJobData
} from "../queue/index.js";
import { isConnectorAuthRequiredError } from "../connectors/errors.js";
import { renderGoogleWorkspaceAgent } from "../connectors/google-workspace.js";
import { publishRealtimeEvent } from "../realtime/events.js";
import { sendPushNotification } from "../notifications/push.js";

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

type AgentRenderer = (context: {
  agent: AgentRow;
  trigger: AgentExecutorJobData["trigger"];
}) => RenderedAgentMessage | Promise<RenderedAgentMessage>;

type ConnectorPendingConfig = {
  connectorName: string;
  outputName: string;
  expectedAction: string;
};

const connectorPendingConfigs: Record<string, ConnectorPendingConfig> = {
  email_digest: {
    connectorName: "Gmail",
    outputName: "email digest",
    expectedAction: "read Gmail and summarize messages that need attention"
  },
  invoice_tracker: {
    connectorName: "Gmail",
    outputName: "invoice tracker",
    expectedAction: "find unpaid invoices and flag the ones that need follow-up"
  },
  subscription_auditor: {
    connectorName: "Gmail",
    outputName: "subscription audit",
    expectedAction: "scan receipts and surface recurring subscriptions"
  },
  email_followup_watcher: {
    connectorName: "Gmail",
    outputName: "follow-up watcher",
    expectedAction: "find sent emails that have not received replies"
  },
  lead_response_monitor: {
    connectorName: "Gmail",
    outputName: "lead monitor",
    expectedAction: "watch Gmail for new lead emails"
  },
  travel_sentinel: {
    connectorName: "Gmail",
    outputName: "travel checklist",
    expectedAction: "read booking emails and surface travel actions"
  },
  slack_digest: {
    connectorName: "Slack",
    outputName: "Slack digest",
    expectedAction: "read Slack and summarize important activity"
  },
  slack_urgent_watcher: {
    connectorName: "Slack",
    outputName: "urgent Slack update",
    expectedAction: "watch Slack for urgent messages and mentions"
  },
  eod_task_report: {
    connectorName: "Slack",
    outputName: "EOD task report",
    expectedAction: "summarize the work discussed in Slack today"
  },
  drive_summary: {
    connectorName: "Google Drive",
    outputName: "Drive summary",
    expectedAction: "read selected Drive files and summarize relevant changes"
  },
  pdf_summary: {
    connectorName: "Google Drive",
    outputName: "PDF summary",
    expectedAction: "read shared PDFs and summarize them"
  },
  meeting_recap: {
    connectorName: "Google Drive",
    outputName: "meeting recap",
    expectedAction: "read Docs meeting notes and extract decisions"
  },
  weekly_progress_report: {
    connectorName: "Slack + Google Drive",
    outputName: "weekly progress report",
    expectedAction: "combine Slack activity and Drive changes into a progress report"
  },
  project_deadline_watcher: {
    connectorName: "Gmail + Google Drive",
    outputName: "deadline checklist",
    expectedAction: "find deadline mentions and build a weekly action checklist"
  }
};

const renderers: Record<string, AgentRenderer> = {
  tech_news_brief: ({ agent, trigger }) =>
    createTechNewsBrief(agent.prompt, trigger, {
      heading: scheduledIntro(agent, "tech news")
    }),
  news_brief: ({ agent, trigger }) =>
    createGeneralNewsBrief(agent.prompt, trigger, {
      heading: scheduledIntro(agent, topicLabel(agent.prompt, "news"))
    }),
  job_market_radar: ({ agent, trigger }) =>
    createGeneralNewsBrief(agent.prompt, trigger, {
      heading: scheduledIntro(agent, "job market radar")
    }),
  web_search_agent: ({ agent, trigger }) =>
    createGeneralNewsBrief(agent.prompt, trigger, {
      heading: scheduledIntro(agent, "web search")
    }),
  scheduled_reminder: ({ agent, trigger }) =>
    renderScheduledReminder(agent, trigger),
  study_plan: ({ agent }) => renderStudyPlan(agent),
  interview_prep: ({ agent }) => renderDailyTaskAgent(agent),
  procrastination_breaker: ({ agent }) => renderDailyTaskAgent(agent),
  daily_task: ({ agent }) => renderDailyTaskAgent(agent),
  habit_tracker: ({ agent }) => renderHabitTracker(agent),
  language_word: ({ agent }) => renderLanguageWord(agent),
  coding_tip: ({ agent }) => renderCodingTip(agent),
  book_companion: ({ agent }) => renderBookCompanion(agent),
  parenting_milestones: ({ agent }) => renderParentingMilestone(agent),
  relationship_nudge: ({ agent }) => renderRelationshipNudge(agent),
  gratitude_prompt: ({ agent }) => renderGratitudePrompt(agent),
  portfolio_watch: ({ agent }) => renderPortfolioWatch(agent),
  competitor_watch: ({ agent }) => renderCompetitorWatch(agent)
};

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

    // Send push notification
    await sendPushNotification(pool, agent.user_id, {
      title: agent.name,
      body: extractNotificationBody(rendered.content),
      data: {
        agent_id: agent.id,
        message_id: message.id,
        run_id: run.id,
      },
    }).catch((error) => {
      console.error("Failed to send push notification:", error);
    });

    return { runId: run.id, messageId: message.id };
  } catch (error) {
    if (isConnectorAuthRequiredError(error)) {
      await markConnectorActionRequired(agent.user_id, error.connectorId);
      const rendered = renderConnectorReconnectRequired(agent, {
        connectorId: error.connectorId,
        connectorName: error.connectorName
      });
      const message = await writeAgentMessage(
        agent,
        rendered.content,
        rendered.sourceRefs
      );

      await pool.query(
        `
          UPDATE agent_runs
          SET status = 'partial',
              completed_at = NOW(),
              message_id = $1,
              error_message = $2,
              tokens_used = $3
          WHERE id = $4
        `,
        [message.id, error.reason, rendered.tokensUsed, run.id]
      );

      await publishRealtimeEvent({
        type: "message.created",
        user_id: agent.user_id,
        agent_id: agent.id,
        message_id: message.id,
        run_id: run.id,
        data: {
          role: "agent",
          trigger: job.data.trigger,
          connector_id: error.connectorId,
          action_required: true
        }
      });
      await publishRealtimeEvent({
        type: "run.completed",
        user_id: agent.user_id,
        agent_id: agent.id,
        message_id: message.id,
        run_id: run.id,
        data: {
          trigger: job.data.trigger,
          status: "partial",
          connector_id: error.connectorId
        }
      });

      return { runId: run.id, messageId: message.id };
    }

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

async function markConnectorActionRequired(
  userId: string,
  connectorId: string
): Promise<void> {
  await Promise.all([
    pool.query(
      `
        UPDATE connector_tokens
        SET status = 'action_required', updated_at = NOW()
        WHERE user_id = $1 AND connector_id = $2
      `,
      [userId, connectorId]
    ),
    pool.query(
      `
        INSERT INTO connector_statuses (user_id, connector_id, status)
        VALUES ($1, $2, 'action_required')
        ON CONFLICT (user_id, connector_id)
        DO UPDATE SET status = 'action_required', updated_at = NOW()
      `,
      [userId, connectorId]
    )
  ]);
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
): Promise<RenderedAgentMessage> {
  const connectorPending = connectorPendingConfigs[intentName(agent)];
  if (connectorPending) {
    const googleWorkspaceMessage = await renderGoogleWorkspaceAgent(agent, {
      scheduledIntro,
      scheduledTitle
    });
    if (googleWorkspaceMessage) {
      return googleWorkspaceMessage;
    }

    return renderConnectorPending(agent, connectorPending);
  }

  const renderer = renderers[intentName(agent)] ?? renderCustomAgent;
  return renderer({ agent, trigger });
}

async function renderScheduledReminder(
  agent: AgentRow,
  trigger: AgentExecutorJobData["trigger"]
): Promise<RenderedAgentMessage> {
  const action = actionText(agent);
  const combinedText = [action, agent.prompt].join("\n");
  const includeDsaQuestion = wantsDsaQuestion(combinedText);
  const includeNews = wantsNewsBrief(combinedText);
  const includeTechNews = wantsTechNewsBrief(combinedText);
  let sourceRefs: unknown[] = [];
  let tokensUsed = 0;
  const reminder = reminderWithoutDynamicRequests(action);
  const heading = scheduledIntro(agent, "update");

  if (includeNews || includeTechNews) {
    const news = includeTechNews
      ? await createTechNewsBrief(agent.prompt, trigger, {
          heading: scheduledIntro(agent, "tech news")
        })
      : await createGeneralNewsBrief(agent.prompt, trigger, {
          heading: scheduledIntro(agent, "news")
        });

    if (news.content.template === "news_brief") {
      const items: NewsBriefItem[] = [];
      if (reminder) {
        items.push({ summary: `Reminder: ${withPeriod(reminder)}` });
      }
      if (includeDsaQuestion) {
        items.push({ summary: createDsaQuestionSection({ agentId: agent.id }) });
      }
      items.push(...news.content.data.items);

      return renderedNewsBrief({
        title: news.content.data.title,
        items
      }, {
        sourceRefs: news.sourceRefs,
        tokensUsed: news.tokensUsed
      });
    }

    const sections: string[] = [];
    if (reminder) {
      sections.push(`Reminder: ${withPeriod(reminder)}`);
    }
    if (includeDsaQuestion) {
      sections.push(createDsaQuestionSection({ agentId: agent.id }));
    }
    if (news.content.template === "plain_text") {
      sections.push(news.content.data.body);
    }
    sourceRefs = news.sourceRefs;
    tokensUsed = news.tokensUsed;

    return renderedPlainText(sections.length > 0 ? sections.join("\n\n") : action, {
      sourceRefs,
      tokensUsed
    });
  }

  const items: NewsBriefItem[] = [];
  if (reminder) {
    items.push({ summary: `Reminder: ${withPeriod(reminder)}` });
  }
  if (includeDsaQuestion) {
    items.push({ summary: createDsaQuestionSection({ agentId: agent.id }) });
  }
  if (items.length === 0) {
    items.push({ summary: action });
  }

  return renderedNewsBrief({
    title: heading,
    items
  }, {
    sourceRefs,
    tokensUsed
  });
}

async function renderCustomAgent(
  context: {
    agent: AgentRow;
    trigger: AgentExecutorJobData["trigger"];
  }
): Promise<RenderedAgentMessage> {
  const { agent, trigger } = context;
  const text = [actionText(agent), agent.prompt].join("\n");

  if (wantsTechNewsBrief(text)) {
    return createTechNewsBrief(agent.prompt, trigger, {
      heading: scheduledIntro(agent, "tech news")
    });
  }

  if (wantsNewsBrief(text)) {
    return createGeneralNewsBrief(agent.prompt, trigger, {
      heading: scheduledIntro(agent, "news")
    });
  }

  if (wantsDsaQuestion(text)) {
    return renderedPlainText(createDsaQuestionSection({ agentId: agent.id }));
  }

  const llmRendered = await renderLlmCustomAgent({
    agentName: agent.name,
    prompt: agent.prompt,
    action: actionText(agent),
    heading: scheduledIntro(agent, "update")
  });
  if (llmRendered) {
    return llmRendered;
  }

  return renderedPlainText(
    [
      scheduledIntro(agent, "update"),
      actionText(agent),
      "",
      "This agent does not require an external connector, so this run delivered the saved instruction directly."
    ].join("\n")
  );
}

function renderStudyPlan(
  agent: AgentRow
): RenderedAgentMessage {
  const steps = studySteps(agent.prompt);

  return renderedProgressTracker({
    title: scheduledTitle(agent, "study plan"),
    text: studyPlanText(agent.prompt),
    total: steps.length,
    current: 0,
    steps: steps.map((label) => ({ label, done: false }))
  });
}

function renderHabitTracker(
  agent: AgentRow
): RenderedAgentMessage {
  return renderedStreakCounter({
    label: habitLabel(agent.prompt),
    count: 0,
    unit: "logged days",
    caption: `${scheduledIntro(agent, "habit check-in")} ${habitPrompt(agent.prompt)}`
  });
}

function renderLanguageWord(agent: AgentRow): RenderedAgentMessage {
  const word = languageWord(agent.prompt);
  return renderedStreakCounter({
    label: scheduledTitle(agent, `${word.language} word`),
    count: 0,
    unit: "learned days",
    word: word.word,
    definition: word.definition,
    example: word.example,
    translation: word.translation,
    caption: "Reply with \"got it\" or \"need review\" so I can tune the next word."
  });
}

function renderCodingTip(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "coding tip");
  const body = codingTip(agent.prompt);
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

function renderBookCompanion(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "book insight");
  const body = bookInsight(agent.prompt);
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

function renderParentingMilestone(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "development update");
  const body = [
    "This week's focus: watch for one new communication cue, one new movement skill, and one new social response.",
    "If anything concerns you, treat this as a prompt to ask a pediatrician, not medical advice."
  ].join("\n\n");
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

function renderRelationshipNudge(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "relationship nudge");
  const body = [
    "Reach out to one person today with a message that is easy to send and easy to answer.",
    "Prompt: \"Thought of you today. How have you been?\""
  ].join("\n\n");
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

function renderGratitudePrompt(agent: AgentRow): RenderedAgentMessage {
  const heading = scheduledIntro(agent, "gratitude prompt");
  const body = [
    "Write three things you are grateful for tonight.",
    "Keep them specific: one person, one moment, and one thing you are looking forward to."
  ].join("\n\n");
  return renderedNewsBrief(parseNewsBriefText(heading, body));
}

function renderDailyTaskAgent(agent: AgentRow): RenderedAgentMessage {
  const task = dailyTask(agent.prompt);
  return renderedDailyTask({
    title: scheduledTitle(agent, task.title),
    task: task.task,
    context: task.context,
    estimated_minutes: task.estimatedMinutes,
    actions: [
      { id: "done", label: "Done", style: "primary" },
      { id: "more_time", label: "Need more time", style: "secondary" },
      { id: "too_hard", label: "Too hard", style: "ghost" }
    ]
  });
}

function renderPortfolioWatch(agent: AgentRow): RenderedAgentMessage {
  const symbols = stockSymbols(agent.prompt);
  return renderedDataSummary({
    title: scheduledTitle(agent, "portfolio watch"),
    text:
      symbols.length > 0
        ? `Tracking requested symbols: ${symbols.join(", ")}.`
        : "I need the portfolio symbols or holdings before I can produce a real market-close summary.",
    summary:
      "This template is ready for market data. The next backend step is to connect a reliable market-data source or a web-search structured renderer.",
    metrics: [
      { label: "Symbols", value: String(symbols.length) },
      { label: "Data", value: "Pending" }
    ],
    footer: "No prices were invented for this run."
  });
}

function renderCompetitorWatch(agent: AgentRow): RenderedAgentMessage {
  const competitors = competitorNames(agent.prompt);
  const rows =
    competitors.length > 0
      ? competitors.map((name) => ({
          label: name,
          changes: [
            "Watch target saved. Search-backed change extraction is the next renderer step."
          ],
          sentiment: "needs_input" as const
        }))
      : [
          {
            label: "Competitors",
            changes: ["Reply with the company names you want watched."],
            sentiment: "needs_input" as const
          }
        ];

  return renderedComparison({
    title: scheduledTitle(agent, "competitor watch"),
    period: "Current watchlist",
    rows,
    insight:
      competitors.length > 0
        ? "The comparison template is active. It will become search-backed when the structured web research renderer is added."
        : "Competitor names are required before this agent can compare launches or positioning.",
    trending_narrative: "No narrative generated until real competitor data is collected."
  });
}

function renderConnectorPending(
  agent: AgentRow,
  config: ConnectorPendingConfig
): RenderedAgentMessage {
  const title = `${config.connectorName} required`;
  const summary = [
    `${agent.name} needs ${config.connectorName} before it can produce a real ${config.outputName}.`,
    "I did not generate fake data for this run.",
    `Once ${config.connectorName} OAuth and data collection are wired, this agent will ${config.expectedAction}.`
  ].join(" ");

  switch (outputTemplate(agent)) {
    case "data_summary":
      return renderedDataSummary({
        title,
        text: scheduledIntro(agent, config.outputName),
        summary,
        metrics: [
          { label: "Connector", value: "Required" },
          { label: "Status", value: "Pending" }
        ]
      });

    case "urgency_list":
      return renderedUrgencyList({
        title,
        source: config.connectorName,
        items: [
          {
            label: `Connect ${config.connectorName}`,
            urgency: "medium",
            due: "Required before this agent can run",
            preview: summary
          }
        ]
      });

    case "checklist":
      return renderedChecklist({
        title,
        message: scheduledIntro(agent, config.outputName),
        items: [
          {
            id: "connect",
            label: `Connect ${config.connectorName}`,
            checked: false
          },
          {
            id: "run_again",
            label: `Run ${agent.name} again after the connector is active`,
            checked: false
          }
        ],
        footer: "No connector tokens are stored on the device."
      });

    case "daily_task":
      return renderedDailyTask({
        title,
        task: `Connect ${config.connectorName}`,
        context: summary,
        estimated_minutes: 2,
        actions: [connectorSetupAction(agent, config)]
      });

    case "comparison":
      return renderedComparison({
        title,
        rows: [
          {
            label: config.connectorName,
            changes: [summary],
            sentiment: "needs_input"
          }
        ],
        insight: "Connector setup is required before comparison data can be collected."
      });

    default:
      return renderedPlainText(
        [
          scheduledIntro(agent, config.outputName),
          summary
        ].join("\n\n")
      );
  }
}

function renderConnectorReconnectRequired(
  agent: AgentRow,
  connector: { connectorId: string; connectorName: string }
): RenderedAgentMessage {
  return renderedDailyTask({
    title: `${connector.connectorName} needs reconnecting`,
    task: `Reconnect ${connector.connectorName}`,
    context: [
      `${agent.name} could not run because ${connector.connectorName} authorization is no longer valid.`,
      `Reconnect ${connector.connectorName} from Connectors so this agent can keep running smoothly.`
    ].join(" "),
    estimated_minutes: 2,
    actions: [
      {
        id: `reconnect_${connector.connectorId}`,
        type: "connector_reconnect",
        connector_id: connector.connectorId,
        connector_name: connector.connectorName,
        run_after_connect: true,
        label: `Reconnect ${connector.connectorName}`,
        style: "primary"
      }
    ]
  });
}

function connectorSetupAction(
  agent: AgentRow,
  config: ConnectorPendingConfig
): {
  id: string;
  type: string;
  label: string;
  style: "primary";
  connector_id?: string;
  connector_name?: string;
  run_after_connect?: boolean;
} {
  const connectorId = singleConnectorId(agent.connector_ids);
  if (!connectorId) {
    return {
      id: "open_connectors",
      type: "open_connectors",
      label: "Open connectors",
      style: "primary"
    };
  }

  return {
    id: `connect_${connectorId}`,
    type: "connector_connect",
    connector_id: connectorId,
    connector_name: config.connectorName,
    run_after_connect: true,
    label: `Connect ${config.connectorName}`,
    style: "primary"
  };
}

function singleConnectorId(connectorIds: string[]): string | null {
  const unique = [
    ...new Set(
      connectorIds
        .map((connectorId) => connectorId.trim())
        .filter((connectorId) => connectorId && connectorId !== "web_search")
    )
  ];

  return unique.length === 1 ? unique[0]! : null;
}

function intentName(agent: AgentRow): string {
  return String(agent.parsed_intent.intent ?? "");
}

function actionText(agent: AgentRow): string {
  return String(agent.parsed_intent.action ?? agent.prompt).trim();
}

function outputTemplate(agent: AgentRow): string {
  return String(agent.parsed_intent.output_template ?? "plain_text");
}

function scheduledIntro(agent: AgentRow, label: string): string {
  return `${scheduledTitle(agent, label)}.`;
}

function scheduledTitle(agent: AgentRow, label: string): string {
  const time = scheduleTimeLabel(agent.schedule_cron);
  return time ? `Here's your ${time} ${label}` : `Here's your ${label}`;
}

function scheduleTimeLabel(cron: string | null): string | null {
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

function wantsTechNewsBrief(text: string): boolean {
  return /\btech(?:nology)?\s+news\b/i.test(text);
}

function wantsNewsBrief(text: string): boolean {
  return /\b(?:news|headlines?)\b/i.test(text);
}

function topicLabel(prompt: string, fallback: string): string {
  const funding = prompt.match(/\b(?:about|on)\s+(.+?)\s+(?:every|daily|at|morning|evening|weekly|$)/i);
  if (funding?.[1]) {
    return `${funding[1].trim()} brief`;
  }

  return fallback;
}

function reminderWithoutDynamicRequests(action: string): string {
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

function withPeriod(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function studyPlanText(prompt: string): string {
  if (/\bjee\b/i.test(prompt)) {
    return "Focus on one physics, chemistry, and maths block today. Keep each block small enough to finish.";
  }

  if (/\bneet\b/i.test(prompt)) {
    return "Focus on one biology, chemistry, and physics block today. Review mistakes before adding new material.";
  }

  if (/\bdsa\b/i.test(prompt)) {
    return "Focus on one concept, one implementation, and one review pass today.";
  }

  return "Focus on one meaningful study block today, then close the loop with a short review.";
}

function studySteps(prompt: string): string[] {
  if (/\bjee\b/i.test(prompt)) {
    return [
      "Solve one physics concept set",
      "Review one chemistry topic",
      "Complete one maths problem block",
      "Write down mistakes and next actions"
    ];
  }

  if (/\bneet\b/i.test(prompt)) {
    return [
      "Revise one biology chapter section",
      "Practice one chemistry question set",
      "Solve one physics numericals block",
      "Review incorrect answers"
    ];
  }

  if (/\bdsa\b/i.test(prompt)) {
    return [
      "Review the core pattern",
      "Solve one medium problem",
      "Write the complexity analysis",
      "Save one mistake or insight"
    ];
  }

  return [
    "Pick the highest-impact topic",
    "Do one focused study block",
    "Test recall without notes",
    "Record the next action"
  ];
}

function habitLabel(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("meditat")) return "Meditation";
  if (lower.includes("language")) return "Language practice";
  if (lower.includes("word")) return "Vocabulary";
  if (lower.includes("code") || lower.includes("coding")) return "Coding";
  return "Daily habit";
}

function habitPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();
  if (lower.includes("meditat")) return "Do one short meditation session now.";
  if (lower.includes("language")) return "Complete one language practice rep now.";
  if (lower.includes("word")) return "Learn and use one new word today.";
  if (lower.includes("code") || lower.includes("coding")) {
    return "Complete one focused coding rep now.";
  }

  return "Complete one small rep now.";
}

function languageWord(prompt: string): {
  language: string;
  word: string;
  definition: string;
  example: string;
  translation: string;
} {
  if (/\bspanish\b/i.test(prompt)) {
    return {
      language: "Spanish",
      word: "Madrugada",
      definition: "The hours between midnight and dawn.",
      example: "Me desperte en la madrugada.",
      translation: "I woke up in the early hours."
    };
  }

  if (/\bfrench\b/i.test(prompt)) {
    return {
      language: "French",
      word: "Depaysement",
      definition: "The feeling of being outside your usual environment.",
      example: "Ce voyage m'a donne un vrai depaysement.",
      translation: "This trip gave me a real change of scene."
    };
  }

  return {
    language: "Vocabulary",
    word: "Deliberate",
    definition: "Done consciously and intentionally.",
    example: "Make one deliberate improvement before moving on.",
    translation: "Use it today in one sentence of your own."
  };
}

function codingTip(prompt: string): string {
  if (/\bpython\b/i.test(prompt)) {
    return [
      "Today: use `collections.defaultdict` when missing keys should start with a default value.",
      "It keeps counting/grouping code smaller and avoids repeated `if key not in dict` checks."
    ].join("\n");
  }

  if (/\bflutter|dart\b/i.test(prompt)) {
    return [
      "Today: keep expensive work out of `build()`.",
      "Precompute derived values in state/providers so rebuilds stay cheap and predictable."
    ].join("\n");
  }

  if (/\bsql\b/i.test(prompt)) {
    return [
      "Today: check query plans before adding indexes.",
      "`EXPLAIN ANALYZE` tells you whether the database is scanning, sorting, or using the index you expected."
    ].join("\n");
  }

  return [
    "Today: write down the time complexity before coding the solution.",
    "It forces you to choose the data structure first instead of patching performance later."
  ].join("\n");
}

function bookInsight(prompt: string): string {
  if (/\batomic habits\b/i.test(prompt)) {
    return [
      "Today's insight from Atomic Habits: habits get easier when the cue is obvious and the action is small.",
      "Prompt: choose one habit and define the exact cue that will trigger it today."
    ].join("\n");
  }

  return [
    "Today's reading prompt: capture one idea you can apply in the next 24 hours.",
    "Keep it concrete: one action, one situation, one expected benefit."
  ].join("\n");
}

function dailyTask(prompt: string): {
  title: string;
  task: string;
  context: string;
  estimatedMinutes: number;
} {
  if (/\binterview\b/i.test(prompt)) {
    return {
      title: "interview prep",
      task: "Solve one medium array or string problem and write the complexity analysis.",
      context:
        "After that, rehearse one behavioral answer using situation, action, result.",
      estimatedMinutes: 45
    };
  }

  if (/\bportfolio\b/i.test(prompt)) {
    return {
      title: "portfolio task",
      task: "Write one case study headline for your strongest project.",
      context:
        "Do not design the whole site today. Create one small artifact that makes tomorrow easier.",
      estimatedMinutes: 20
    };
  }

  return {
    title: "daily task",
    task: "Define the smallest useful next step and complete it today.",
    context:
      "The task should be small enough that lack of motivation is not a blocker.",
    estimatedMinutes: 20
  };
}

function stockSymbols(prompt: string): string[] {
  const matches = prompt.match(/\b[A-Z]{2,5}\b/g) ?? [];
  return [...new Set(matches)].filter(
    (symbol) => !["DSA", "JEE", "NEET", "PDF", "API"].includes(symbol)
  );
}

function competitorNames(prompt: string): string[] {
  const quoted = [...prompt.matchAll(/"([^"]+)"/g)].map((match) => match[1]!);
  if (quoted.length > 0) {
    return quoted.map((name) => name.trim()).filter(Boolean);
  }

  const afterWatch = prompt.match(/\bwatch\s+(.+?)\s+(?:and\s+)?tell\b/i)?.[1];
  if (!afterWatch || /\bcompetitors?\b/i.test(afterWatch)) {
    return [];
  }

  return afterWatch
    .split(/\s*,\s*|\s+and\s+/i)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }

  return String(error).slice(0, 2000);
}


function extractNotificationBody(content: AgentMessageContent): string {
  if (content.template === "plain_text" && content.data.body) {
    const body = String(content.data.body);
    // Extract first line or first 100 characters
    const firstLine = body.split("\n")[0] || "";
    return firstLine.length > 100 ? firstLine.substring(0, 97) + "..." : firstLine;
  }

  if (content.template === "data_summary" && content.data.text) {
    return String(content.data.text).substring(0, 100);
  }

  if (content.template === "daily_task" && content.data.task) {
    return String(content.data.task);
  }

  if (content.template === "urgency_list" && content.data.items?.[0]?.label) {
    return String(content.data.items[0].label);
  }

  if (content.template === "checklist" && content.data.message) {
    return String(content.data.message);
  }

  return "New message available";
}

export type PlainTextMessageContent = {
  template: "plain_text";
  version: "1.0";
  data: {
    headline?: string;
    body: string;
    text?: string;
    footer?: string;
    items?: unknown[];
  };
};

export type DataSummaryMessageContent = {
  template: "data_summary";
  version: "1.0";
  data: {
    title: string;
    text?: string;
    summary?: string;
    description?: string;
    metrics?: Array<{
      label: string;
      value: string;
      sublabel?: string;
    }>;
    items?: unknown[];
    footer?: string;
  };
};

export type UrgencyListMessageContent = {
  template: "urgency_list";
  version: "1.0";
  data: {
    title: string;
    source?: string;
    timestamp?: string;
    items: Array<{
      label: string;
      urgency?: "low" | "medium" | "high" | "urgent";
      due?: string;
      preview?: string;
    }>;
    skipped?: number;
    skipped_label?: string;
  };
};

export type ProgressTrackerMessageContent = {
  template: "progress_tracker";
  version: "1.0";
  data: {
    title: string;
    text: string;
    total: number;
    current: number;
    steps: Array<{
      label: string;
      done: boolean;
    }>;
  };
};

export type ChecklistMessageContent = {
  template: "checklist";
  version: "1.0";
  data: {
    title: string;
    subtitle?: string;
    message?: string;
    items: Array<{
      id?: string;
      label: string;
      checked: boolean;
    }>;
    footer?: string;
  };
};

export type DailyTaskMessageContent = {
  template: "daily_task";
  version: "1.0";
  data: {
    title: string;
    task: string;
    context?: string;
    estimated_minutes?: number;
    actions?: Array<{
      id: string;
      label: string;
      style?: "primary" | "secondary" | "ghost";
      type?: string;
      connector_id?: string;
      connector_name?: string;
      run_after_connect?: boolean;
    }>;
  };
};

export type StreakCounterMessageContent = {
  template: "streak_counter";
  version: "1.0";
  data: {
    label: string;
    count: number;
    unit: string;
    caption?: string;
    word?: string;
    definition?: string;
    example?: string;
    translation?: string;
  };
};

export type ComparisonMessageContent = {
  template: "comparison";
  version: "1.0";
  data: {
    title: string;
    period?: string;
    rows: Array<{
      label: string;
      changes: string[];
      sentiment?: "active" | "neutral" | "quiet" | "needs_input";
    }>;
    insight?: string;
    trending_narrative?: string;
  };
};

export type AgentMessageContent =
  | PlainTextMessageContent
  | DataSummaryMessageContent
  | UrgencyListMessageContent
  | ProgressTrackerMessageContent
  | ChecklistMessageContent
  | DailyTaskMessageContent
  | StreakCounterMessageContent
  | ComparisonMessageContent;

export type RenderedAgentMessage = {
  content: AgentMessageContent;
  sourceRefs: unknown[];
  tokensUsed: number;
};

export function renderedPlainText(
  body: string,
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return {
    content: {
      template: "plain_text",
      version: "1.0",
      data: { body }
    },
    sourceRefs: meta.sourceRefs ?? [],
    tokensUsed: meta.tokensUsed ?? 0
  };
}

export function renderedDataSummary(
  data: DataSummaryMessageContent["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return rendered("data_summary", data, meta);
}

export function renderedUrgencyList(
  data: UrgencyListMessageContent["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return rendered("urgency_list", data, meta);
}

export function renderedProgressTracker(
  data: ProgressTrackerMessageContent["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return rendered("progress_tracker", data, meta);
}

export function renderedChecklist(
  data: ChecklistMessageContent["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return rendered("checklist", data, meta);
}

export function renderedDailyTask(
  data: DailyTaskMessageContent["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return rendered("daily_task", data, meta);
}

export function renderedStreakCounter(
  data: StreakCounterMessageContent["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return rendered("streak_counter", data, meta);
}

export function renderedComparison(
  data: ComparisonMessageContent["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return rendered("comparison", data, meta);
}

function rendered<TTemplate extends AgentMessageContent["template"]>(
  template: TTemplate,
  data: Extract<AgentMessageContent, { template: TTemplate }>["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number }
): RenderedAgentMessage {
  return {
    content: {
      template,
      version: "1.0",
      data
    } as AgentMessageContent,
    sourceRefs: meta.sourceRefs ?? [],
    tokensUsed: meta.tokensUsed ?? 0
  };
}

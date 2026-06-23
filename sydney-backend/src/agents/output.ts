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

export type NewsBriefItem = {
  headline?: string;
  summary: string;
};

export type NewsBriefMessageContent = {
  template: "news_brief";
  version: "1.0";
  data: {
    title: string;
    items: NewsBriefItem[];
  };
};

export type StudyGuideMessageContent = {
  template: "study_guide";
  version: "1.0";
  data: {
    topic: string;
    definition: string;
    references: Array<{
      title: string;
      url: string;
    }>;
    completed: boolean;
    actions: Array<{
      id: "done" | "snooze" | "skip";
      label: string;
      style?: "primary" | "secondary" | "ghost";
    }>;
  };
};

export type DsaQuestionMessageContent = {
  template: "dsa_question";
  version: "1.0";
  data: {
    title: string;
    difficulty: "Easy" | "Medium" | "Hard";
    problem: string;
    input_format?: string;
    output_format?: string;
    constraints?: string;
    examples: Array<{
      input: string;
      output: string;
      explanation?: string;
    }>;
    hint?: string;
    references: Array<{
      title: string;
      url: string;
    }>;
    completed: boolean;
    actions: Array<{
      id: "done" | "snooze" | "skip";
      label: string;
      style?: "primary" | "secondary" | "ghost";
    }>;
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
  | ComparisonMessageContent
  | NewsBriefMessageContent
  | StudyGuideMessageContent
  | DsaQuestionMessageContent;

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
  return rendered("data_summary", normalizeDataSummary(data), meta);
}

export function digestSection(title: string, lines: string[]): string {
  const cleaned = lines.map(cleanDigestLine).filter(Boolean);
  if (cleaned.length === 0) return "";

  return [
    `${title}:`,
    ...cleaned.map((line) => (line.startsWith("• ") ? line : `• ${line}`))
  ].join("\n");
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

export function renderedNewsBrief(
  data: NewsBriefMessageContent["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return rendered("news_brief", data, meta);
}

export function renderedStudyGuide(
  data: StudyGuideMessageContent["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return rendered("study_guide", data, meta);
}

export function renderedDsaQuestion(
  data: DsaQuestionMessageContent["data"],
  meta: { sourceRefs?: unknown[]; tokensUsed?: number } = {}
): RenderedAgentMessage {
  return rendered("dsa_question", data, meta);
}

export function parseNewsBriefText(title: string, body: string): NewsBriefMessageContent["data"] {
  const rawLines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const lines: string[] = [];

  for (const line of rawLines) {
    // Detect inline numbered or bulleted items after an intro, e.g.:
    // "Tech news brief for today: 1. AI infrastructure race..."
    const inlineMatch = line.match(/^(.*?):\s*(?:(\d+)[.)]|(\*|•|-))\s+(.+)$/);
    if (inlineMatch) {
      const intro = inlineMatch[1]?.trim() ?? "";
      const num = inlineMatch[2];
      const bullet = inlineMatch[3];
      const rest = inlineMatch[4]?.trim() ?? "";

      if (intro) {
        lines.push(intro + ":");
      }
      if (num) {
        lines.push(`${num}. ${rest}`);
      } else if (bullet) {
        lines.push(`${bullet} ${rest}`);
      }
    } else {
      lines.push(line);
    }
  }

  const items: NewsBriefItem[] = [];
  let pendingHeadline: string | null = null;

  for (const line of lines) {
    // Check if it's a numbered or bulleted item like "1. Google Gemini: ..." or "2) ..." or "• ..."
    const numberedMatch = line.match(/^(\d+|\*|•|-)[.)]?\s+(.+)$/);
    if (numberedMatch && numberedMatch[2]) {
      const content = numberedMatch[2].trim();

      if (pendingHeadline) {
        const startsNewNumberedSection = /^\d+$/.test(numberedMatch[1] ?? "");
        const explicitItem = splitBriefHeadline(content);
        if (!startsNewNumberedSection && !explicitItem && hasVisibleBriefText(content)) {
          items.push({ headline: pendingHeadline, summary: content });
          pendingHeadline = null;
          continue;
        }

        items.push({ summary: pendingHeadline });
        pendingHeadline = null;
      }

      const explicitItem = splitBriefHeadline(content);
      if (explicitItem) {
        if (hasVisibleBriefText(explicitItem.summary)) {
          items.push(explicitItem);
        } else if (hasVisibleBriefText(explicitItem.headline)) {
          pendingHeadline = explicitItem.headline;
        }
      } else {
        // Look for double asterisks formatting, e.g., **Headline** Summary
        const boldMatch = content.match(/^\*\*(.*?)\*\*\s*(.*)$/);
        if (boldMatch && boldMatch[1] !== undefined && boldMatch[2] !== undefined) {
          const headline = cleanBriefHeadline(boldMatch[1]);
          const summary = boldMatch[2].trim();
          if (hasVisibleBriefText(summary)) {
            items.push({ headline, summary });
          } else if (hasVisibleBriefText(headline)) {
            pendingHeadline = headline;
          }
        } else {
          // Fallback: use first 5 words as headline, rest as summary
          const words = content.split(/\s+/);
          if (words.length > 5) {
            const headline = words.slice(0, 5).join(" ");
            const summary = words.slice(5).join(" ");
            items.push({ headline, summary });
          } else {
            items.push({ summary: content });
          }
        }
      }
    } else {
      if (pendingHeadline) {
        items.push({ summary: pendingHeadline });
        pendingHeadline = null;
      }

      // It's a non-numbered line. If it's not matching the title, we can treat it as an item with no headline
      if (line.toLowerCase() === title.toLowerCase()) {
        continue;
      }
      // Clean up markdown headlines if any
      const cleanedLine = line.replace(/^#{1,6}\s+/, "").trim();
      if (cleanedLine) {
        items.push({ summary: cleanedLine });
      }
    }
  }

  if (pendingHeadline) {
    items.push({ summary: pendingHeadline });
  }

  // Fallback: if no items were parsed, treat the whole body as a single summary item
  if (items.length === 0 && body.trim()) {
    items.push({ summary: body.trim() });
  }

  return {
    title,
    items: items.filter(
      (item) =>
        hasVisibleBriefText(item.headline ?? "") ||
        hasVisibleBriefText(item.summary)
    )
  };
}

function splitBriefHeadline(
  content: string
): { headline: string; summary: string } | null {
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === "[") {
      bracketDepth += 1;
    } else if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (char === "(") {
      parenDepth += 1;
    } else if (char === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
    } else if (char === ":" && bracketDepth === 0 && parenDepth === 0) {
      if (content.substring(i + 1, i + 3) === "//") {
        continue;
      }

      const rawHeadline = content.substring(0, i);
      let summary = content.substring(i + 1).trim();
      const openBoldMarkers = rawHeadline.match(/\*\*/g)?.length ?? 0;
      if (openBoldMarkers % 2 === 1) {
        summary = summary.replace(/^\*\*\s*/, "");
      }

      return {
        headline: cleanBriefHeadline(rawHeadline),
        summary
      };
    }
  }

  return null;
}

function cleanBriefHeadline(value: string): string {
  return value.trim().replace(/^\*+|\*+$/g, "").replace(/:$/, "").trim();
}

function hasVisibleBriefText(value: string): boolean {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`#>~\s:.-]+/g, "")
    .length > 0;
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

function normalizeDataSummary(
  data: DataSummaryMessageContent["data"]
): DataSummaryMessageContent["data"] {
  return {
    ...data,
    ...(typeof data.summary === "string"
      ? { summary: normalizeSummaryText(data.summary) }
      : {}),
    ...(typeof data.description === "string"
      ? { description: normalizeSummaryText(data.description) }
      : {})
  };
}

function normalizeSummaryText(value: string): string {
  const sections = value
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length > 1) {
    return sections.map(normalizeSummarySection).join("\n\n");
  }

  return normalizeSummarySection(value);
}

function normalizeSummarySection(value: string): string {
  const lines = value
    .split("\n")
    .map(cleanDigestLine)
    .filter(Boolean);

  if (lines.length <= 1) {
    return lines[0] ?? "";
  }

  let [first, ...rest] = lines;
  if (!first) {
    return "";
  }

  // Normalize markdown headings or bold headers to end with a colon so they are treated as block titles
  const isHeading =
    first.startsWith("#") ||
    (first.startsWith("**") && first.endsWith("**")) ||
    first.endsWith(":");

  if (isHeading) {
    first = first
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*\*|\*\*$/g, "")
      .trim();
    if (!first.endsWith(":")) {
      first = first + ":";
    }

    return [
      first,
      ...rest.map((line) => (line.startsWith("• ") ? line : `• ${line}`))
    ].join("\n");
  }

  return lines
    .map((line) => (line.startsWith("• ") ? line : `• ${line}`))
    .join("\n");
}

function cleanDigestLine(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[-*]\s+/, "")
    .trim();
}

import { z } from "zod";

export const scheduledOutputContractIds = [
  "plain_text",
  "data_summary",
  "urgency_list",
  "progress_tracker",
  "checklist",
  "daily_task",
  "streak_counter",
  "comparison",
  "news_brief",
  "study_guide",
  "dsa_question",
  "content_extractor",
  "portfolio_watch",
  "briefing_card"
] as const;

export type ScheduledOutputContractId =
  (typeof scheduledOutputContractIds)[number];
export type TrustedMessageAction = "done" | "snooze" | "skip";

const outputContractIdSchema = z.enum(scheduledOutputContractIds);
const styleSchema = z.enum(["primary", "secondary", "ghost"]).optional();
const trustedActionSchema = z
  .object({
    id: z.enum(["done", "snooze", "skip"]),
    label: z.string().min(1).max(80),
    style: styleSchema
  })
  .strict();
const connectorActionSchema = z
  .object({
    id: z.string().min(1).max(120),
    label: z.string().min(1).max(120),
    style: styleSchema,
    type: z.enum(["connector_connect", "open_connectors"]),
    connector_id: z.string().optional(),
    connector_name: z.string().optional(),
    run_after_connect: z.boolean().optional()
  })
  .strict();

const plainTextDataSchema = z
  .object({
    headline: z.string().optional(),
    body: z.string(),
    text: z.string().optional(),
    footer: z.string().optional(),
    items: z.array(z.unknown()).optional()
  })
  .strict();

const dataSummaryDataSchema = z
  .object({
    title: z.string(),
    text: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    metrics: z
      .array(
        z
          .object({
            label: z.string(),
            value: z.string(),
            sublabel: z.string().optional()
          })
          .strict()
      )
      .optional(),
    items: z.array(z.unknown()).optional(),
    footer: z.string().optional(),
    kind: z.string().optional(),
    timeline: z.array(z.unknown()).optional(),
    messages: z.array(z.unknown()).optional(),
    action_items: z
      .array(
        z.union([
          z.string(),
          z
            .object({
              label: z.string(),
              priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
              due: z.string().optional(),
              source: z.string().optional()
            })
            .strict()
        ])
      )
      .optional()
  })
  .strict();

const urgencyListDataSchema = z
  .object({
    title: z.string(),
    source: z.string().optional(),
    timestamp: z.string().optional(),
    items: z.array(
      z
        .object({
          label: z.string(),
          urgency: z.enum(["low", "medium", "high", "urgent"]).optional(),
          due: z.string().optional(),
          preview: z.string().optional()
        })
        .strict()
    ),
    skipped: z.number().int().nonnegative().optional(),
    skipped_label: z.string().optional()
  })
  .strict();

const progressTrackerDataSchema = z
  .object({
    title: z.string(),
    text: z.string(),
    total: z.number().int().nonnegative(),
    current: z.number().int().nonnegative(),
    steps: z.array(
      z.object({ label: z.string(), done: z.boolean() }).strict()
    )
  })
  .strict();

const checklistDataSchema = z
  .object({
    title: z.string(),
    subtitle: z.string().optional(),
    message: z.string().optional(),
    items: z.array(
      z
        .object({
          id: z.string().optional(),
          label: z.string(),
          checked: z.boolean()
        })
        .strict()
    ),
    footer: z.string().optional()
  })
  .strict();

const dailyTaskDataSchema = z
  .object({
    title: z.string(),
    task: z.string(),
    context: z.string().optional(),
    estimated_minutes: z.number().int().nonnegative().optional(),
    actions: z.array(z.union([trustedActionSchema, connectorActionSchema])).optional()
  })
  .strict();

const streakCounterDataSchema = z
  .object({
    label: z.string(),
    count: z.number().int().nonnegative(),
    unit: z.string(),
    caption: z.string().optional(),
    word: z.string().optional(),
    definition: z.string().optional(),
    example: z.string().optional(),
    translation: z.string().optional()
  })
  .strict();

const comparisonDataSchema = z
  .object({
    title: z.string(),
    period: z.string().optional(),
    rows: z.array(
      z
        .object({
          label: z.string(),
          changes: z.array(z.string()),
          sentiment: z
            .enum(["active", "neutral", "quiet", "needs_input"])
            .optional()
        })
        .strict()
    ),
    insight: z.string().optional(),
    trending_narrative: z.string().optional()
  })
  .strict();

const newsBriefDataSchema = z
  .object({
    title: z.string(),
    items: z.array(
      z
        .object({
          headline: z.string().optional(),
          summary: z.string(),
          category: z.string().optional(),
          source: z.string().optional(),
          url: z.string().optional()
        })
        .strict()
    ),
    initialItemCount: z.number().int().positive().optional(),
    tldr: z.array(z.string()).max(3).optional(),
    perspectives: z
      .array(
        z
          .object({
            label: z.string(),
            summary: z.string(),
            source: z.string().optional(),
            url: z.string().url().optional()
          })
          .strict()
      )
      .optional(),
    why_it_matters: z.string().optional(),
    timeline: z
      .array(
        z
          .object({
            date: z.string(),
            event: z.string()
          })
          .strict()
      )
      .optional()
  })
  .strict();

const studyGuideDataSchema = z
  .object({
    topic: z.string(),
    definition: z.string(),
    references: z.array(
      z.object({ title: z.string(), url: z.string() }).strict()
    ),
    completed: z.boolean(),
    actions: z.array(trustedActionSchema),
    initially_collapsed: z.boolean().optional()
  })
  .strict();

const dsaQuestionDataSchema = z
  .object({
    title: z.string(),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    problem: z.string(),
    input_format: z.string().optional(),
    output_format: z.string().optional(),
    constraints: z.string().optional(),
    complexity: z.string().optional(),
    time_complexity: z.string().optional(),
    space_complexity: z.string().optional(),
    approach: z.string().optional(),
    examples: z.array(
      z
        .object({
          input: z.string(),
          output: z.string(),
          explanation: z.string().optional()
        })
        .strict()
    ),
    hint: z.string().optional(),
    references: z.array(
      z.object({ title: z.string(), url: z.string() }).strict()
    ),
    completed: z.boolean(),
    actions: z.array(trustedActionSchema)
  })
  .strict();

const contentExtractorDataSchema = z
  .object({
    ideas: z.array(
      z
        .object({
          title: z.string(),
          hook: z.string(),
          angle: z.string().optional(),
          audience_value: z.string().optional(),
          evidence_summary: z.string().optional()
        })
        .strict()
    )
  })
  .strict();

const portfolioWatchDataSchema = z
  .object({
    title: z.string(),
    text: z.string(),
    stocks: z.array(
      z
        .object({
          name: z.string(),
          ticker: z.string(),
          price: z.string(),
          change: z.string(),
          range: z.string()
        })
        .strict()
    ),
    footer: z.string(),
    material_events: z
      .array(
        z
          .object({
            ticker: z.string().optional(),
            category: z.string(),
            headline: z.string(),
            summary: z.string().optional(),
            source: z.string().optional(),
            url: z.string().url().optional(),
            occurred_at: z.string().optional()
          })
          .strict()
      )
      .optional(),
    drivers: z.array(z.string()).optional(),
    as_of: z.string().optional(),
    data_quality: z
      .union([
        z.string(),
        z
          .object({
            status: z.enum(["complete", "partial", "unavailable", "conflicting"]),
            detail: z.string().optional()
          })
          .strict()
      ])
      .optional()
  })
  .strict();

const briefingCardDataSchema = z
  .object({
    eyebrow: z.string(),
    title: z.string(),
    summary: z.string(),
    sections: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          source: z.string(),
          tone: z
            .enum(["neutral", "info", "attention", "positive"])
            .optional(),
          items: z.array(
            z
              .object({
                title: z.string(),
                detail: z.string().optional(),
                meta: z.string().optional()
              })
              .strict()
          )
        })
        .strict()
    ),
    missing_sources: z.array(z.string()).optional(),
    priorities: z
      .array(
        z.union([
          z.string(),
          z
            .object({
              title: z.string(),
              detail: z.string().optional(),
              source: z.string().optional()
            })
            .strict()
        ])
      )
      .optional(),
    cross_source_insights: z.array(z.string()).optional(),
    conflicts: z
      .array(
        z.union([
          z.string(),
          z
            .object({
              topic: z.string(),
              detail: z.string(),
              sources: z.array(z.string()).optional()
            })
            .strict()
        ])
      )
      .optional()
  })
  .strict();

type OutputRegistryEntry = {
  id: ScheduledOutputContractId;
  version: "1.0";
  dataSchema: z.ZodTypeAny;
  normalize: (data: Record<string, unknown>) => Record<string, unknown>;
  textualize: (data: Record<string, any>) => string;
  inboxPreview: (data: Record<string, any>) => string;
  notificationSummary: (data: Record<string, any>) => string;
  trustedActions: readonly TrustedMessageAction[];
  stateEffects?: (
    action: TrustedMessageAction,
    data: Record<string, any>,
    date: string
  ) => Array<{ type: string; key?: string; value?: unknown }>;
};

const entries: OutputRegistryEntry[] = [
  outputEntry("plain_text", plainTextDataSchema, {
    textualize: (data) => data.body,
    preview: (data) => firstLine(data.body) || "New message"
  }),
  outputEntry("data_summary", dataSummaryDataSchema, {
    textualize: (data) =>
      [
        data.title,
        data.summary,
        data.description,
        data.text,
        ...(data.action_items ?? []).map((item: any) =>
          typeof item === "string" ? `- ${item}` : `- ${item.label}`
        ),
        data.footer
      ]
        .filter(Boolean)
        .join("\n\n"),
    preview: (data) =>
      data.summary || data.description || data.text || data.title
  }),
  outputEntry("urgency_list", urgencyListDataSchema, {
    textualize: (data) =>
      [data.title, ...data.items.map((item: any) => `- ${item.label}`)].join(
        "\n"
      ),
    preview: (data) => data.items[0]?.label || data.title
  }),
  outputEntry("progress_tracker", progressTrackerDataSchema, {
    textualize: (data) =>
      `${data.title}\n${data.text}\nProgress: ${data.current}/${data.total}`,
    preview: (data) => `${data.title} (${data.current}/${data.total})`
  }),
  outputEntry("checklist", checklistDataSchema, {
    textualize: (data) =>
      [
        data.title,
        data.subtitle,
        ...data.items.map(
          (item: any) => `[${item.checked ? "x" : " "}] ${item.label}`
        )
      ]
        .filter(Boolean)
        .join("\n"),
    preview: (data) => data.message || data.items[0]?.label || data.title
  }),
  outputEntry("daily_task", dailyTaskDataSchema, {
    textualize: (data) =>
      [data.title, data.task, data.context].filter(Boolean).join("\n\n"),
    preview: (data) => `${data.title}: ${data.task}`,
    trustedActions: ["done", "snooze", "skip"],
    stateEffects: interactiveStateEffects
  }),
  outputEntry("streak_counter", streakCounterDataSchema, {
    textualize: (data) =>
      data.word
        ? `${data.label}: ${data.word} — ${data.definition ?? ""}`
        : `${data.label}: ${data.count} ${data.unit}`,
    preview: (data) =>
      data.word
        ? `${data.label}: ${data.word}`
        : `${data.label}: ${data.count} ${data.unit}`
  }),
  outputEntry("comparison", comparisonDataSchema, {
    textualize: (data) =>
      [
        data.title,
        ...data.rows.map(
          (row: any) => `${row.label}: ${row.changes.join(", ")}`
        )
      ].join("\n"),
    preview: (data) => data.insight || data.rows[0]?.label || data.title
  }),
  outputEntry("news_brief", newsBriefDataSchema, {
    textualize: (data) =>
      [
        data.title,
        ...(data.tldr ?? []).map((item: string) => `- ${item}`),
        ...data.items.map((item: any) =>
          [item.headline, item.summary].filter(Boolean).join(": ")
        ),
        data.why_it_matters
      ].join("\n\n"),
    preview: (data) => {
      const item = data.items[0];
      return item
        ? [item.headline, item.summary].filter(Boolean).join(": ")
        : data.title;
    }
  }),
  outputEntry("study_guide", studyGuideDataSchema, {
    normalize: normalizeStudyGuide,
    textualize: (data) => `${data.topic}\n\n${data.definition}`,
    preview: (data) => `Lesson: ${data.topic}`,
    trustedActions: ["done", "snooze", "skip"],
    stateEffects: interactiveStateEffects
  }),
  outputEntry("dsa_question", dsaQuestionDataSchema, {
    textualize: (data) =>
      `${data.title} (${data.difficulty})\n\n${data.problem}`,
    preview: (data) => `Problem (${data.difficulty}): ${data.title}`,
    trustedActions: ["done", "snooze", "skip"],
    stateEffects: interactiveStateEffects
  }),
  outputEntry("content_extractor", contentExtractorDataSchema, {
    textualize: (data) =>
      data.ideas
        .map((idea: any) => `${idea.title}\n${idea.hook}`)
        .join("\n\n"),
    preview: (data) =>
      data.ideas.length > 0
        ? `Trending ideas: ${data.ideas
            .map((idea: any) => idea.title)
            .join(", ")}`
        : "Content creation ideas"
  }),
  outputEntry("portfolio_watch", portfolioWatchDataSchema, {
    textualize: (data) =>
      [
        data.title,
        data.text,
        ...data.stocks.map(
          (stock: any) =>
            `${stock.ticker}: ${stock.price} (${stock.change})`
        ),
        data.footer
      ].join("\n"),
    preview: (data) =>
      data.stocks.length > 0
        ? `${data.title}: ${data.stocks
            .map((stock: any) => `${stock.ticker} (${stock.change})`)
            .join(", ")}`
        : `${data.title}: ${data.text}`
  }),
  outputEntry("briefing_card", briefingCardDataSchema, {
    textualize: (data) =>
      [
        data.title,
        data.summary,
        ...(data.priorities ?? []).map((priority: any) =>
          typeof priority === "string"
            ? `Priority: ${priority}`
            : `Priority: ${priority.title}${
                priority.detail ? ` — ${priority.detail}` : ""
              }`
        ),
        ...data.sections.flatMap((section: any) => [
          section.title,
          ...section.items.map(
            (item: any) =>
              `- ${item.title}${item.detail ? `: ${item.detail}` : ""}`
          )
        ]),
        ...(data.cross_source_insights ?? []).map(
          (insight: string) => `Insight: ${insight}`
        ),
        ...(data.conflicts ?? []).map((conflict: any) =>
          typeof conflict === "string"
            ? `Conflict: ${conflict}`
            : `Conflict: ${conflict.topic} — ${conflict.detail}`
        )
      ].join("\n"),
    preview: (data) =>
      data.sections[0]?.items[0]?.title || data.summary || data.title
  })
];

const outputRegistry = new Map(entries.map((entry) => [entry.id, entry]));

export function isScheduledOutputContract(
  value: string
): value is ScheduledOutputContractId {
  return outputContractIdSchema.safeParse(value).success;
}

export function getOutputContract(id: string): OutputRegistryEntry {
  const entry = outputRegistry.get(id as ScheduledOutputContractId);
  if (!entry) throw new Error(`Unsupported scheduled output contract: ${id}`);
  return entry;
}

export function listOutputContracts(): readonly OutputRegistryEntry[] {
  return entries;
}

export function normalizeAndValidateOutput<T extends {
  template: string;
  version: string;
  data: unknown;
}>(content: T): T {
  const entry = getOutputContract(content.template);
  if (content.version !== entry.version) {
    throw new Error(
      `Unsupported output version: ${content.template}@${content.version}`
    );
  }
  const rawData = asRecord(content.data);
  const data = entry.dataSchema.parse(entry.normalize(rawData));
  return { ...content, data };
}

export function textualizeOutput(content: {
  template: string;
  version?: string;
  data: unknown;
}): string {
  const entry = getOutputContract(content.template);
  return entry.textualize(entry.normalize(asRecord(content.data)) as any);
}

export function outputInboxPreview(content: {
  template: string;
  version?: string;
  data: unknown;
}): string {
  const entry = getOutputContract(content.template);
  return entry.inboxPreview(entry.normalize(asRecord(content.data)) as any);
}

export function outputNotificationSummary(content: {
  template: string;
  version?: string;
  data: unknown;
}): string {
  const entry = getOutputContract(content.template);
  return truncate(
    entry.notificationSummary(entry.normalize(asRecord(content.data)) as any),
    180
  );
}

export function outputStateEffects(input: {
  content: { template: string; data: unknown };
  action: TrustedMessageAction;
  date: string;
}): Array<{ type: string; key?: string; value?: unknown }> {
  const entry = getOutputContract(input.content.template);
  if (!entry.trustedActions.includes(input.action)) {
    throw new Error(
      `Action ${input.action} is not allowed for ${entry.id} outputs.`
    );
  }
  return (
    entry.stateEffects?.(
      input.action,
      entry.normalize(asRecord(input.content.data)),
      input.date
    ) ?? []
  );
}

function outputEntry(
  id: ScheduledOutputContractId,
  dataSchema: z.ZodTypeAny,
  options: {
    normalize?: (data: Record<string, unknown>) => Record<string, unknown>;
    textualize: (data: Record<string, any>) => string;
    preview: (data: Record<string, any>) => string;
    trustedActions?: readonly TrustedMessageAction[];
    stateEffects?: OutputRegistryEntry["stateEffects"];
  }
): OutputRegistryEntry {
  return {
    id,
    version: "1.0",
    dataSchema,
    normalize: options.normalize ?? ((data) => data),
    textualize: options.textualize,
    inboxPreview: options.preview,
    notificationSummary: (data) =>
      notificationSummary(id, data, options.preview(data)),
    trustedActions: options.trustedActions ?? [],
    stateEffects: options.stateEffects
  };
}

function normalizeStudyGuide(
  data: Record<string, unknown>
): Record<string, unknown> {
  const normalized = { ...data };
  const legacy = normalized.initiallyCollapsed;
  if (
    normalized.initially_collapsed === undefined &&
    typeof legacy === "boolean"
  ) {
    normalized.initially_collapsed = legacy;
  }
  delete normalized.initiallyCollapsed;
  return normalized;
}

function interactiveStateEffects(
  action: TrustedMessageAction,
  data: Record<string, any>,
  date: string
): Array<{ type: string; key?: string; value?: unknown }> {
  if (action === "snooze") return [];
  const effects: Array<{ type: string; key?: string; value?: unknown }> = [
    { type: "history.set", key: date, value: action === "done" }
  ];
  if (action === "skip") {
    const topic =
      typeof data.topic === "string"
        ? data.topic
        : typeof data.title === "string"
          ? data.title
          : null;
    if (topic) effects.push({ type: "topics.remove", value: topic });
  }
  return effects;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Output data must be an object.");
  }
  return value as Record<string, unknown>;
}

function firstLine(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "";
}

function truncate(value: string, max: number): string {
  const clean = value
    .replace(/\s+/g, " ")
    .replace(/[*_`#]/g, "")
    .trim();
  return clean.length <= max
    ? clean
    : `${clean.substring(0, Math.max(0, max - 3))}...`;
}

function notificationSummary(
  id: ScheduledOutputContractId,
  data: Record<string, any>,
  fallback: string
): string {
  if (id === "plain_text") {
    const lines = String(data.body ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines.length > 1 && /^Here's your/i.test(lines[0] ?? "")
      ? lines[1] ?? lines[0]!
      : lines[0] ?? fallback;
  }
  if (id === "data_summary") {
    const item = data.items?.[0];
    return String(
      data.summary ??
        data.description ??
        item?.label ??
        item?.title ??
        item?.subject ??
        data.text ??
        data.title ??
        fallback
    )
      .replace(/^Here's your.*?(digest|summary|update)\.?\s*/i, "")
      .trim();
  }
  if (id === "news_brief") {
    const item =
      data.items?.find(
        (candidate: any) =>
          candidate.headline && candidate.headline.trim().length > 0
      ) ?? data.items?.[0];
    return item
      ? [item.headline, item.summary].filter(Boolean).join(": ")
      : data.title ?? fallback;
  }
  if (id === "daily_task") {
    return `${data.title}: ${data.task}${
      data.estimated_minutes ? ` (${data.estimated_minutes} min)` : ""
    }`;
  }
  if (id === "urgency_list") {
    return data.items?.length > 0
      ? `${data.title}: ${data.items
          .map(
            (item: any) =>
              `${item.label}${item.urgency ? ` (${item.urgency})` : ""}`
          )
          .join(", ")}`
      : data.title ?? fallback;
  }
  if (id === "checklist") {
    if (data.message) return `${data.title}: ${data.message}`;
    const unchecked = data.items?.filter((item: any) => !item.checked) ?? [];
    return unchecked.length > 0
      ? `${data.title}: ${unchecked
          .map((item: any) => item.label)
          .join(", ")}`
      : data.title ?? fallback;
  }
  if (id === "study_guide") {
    return data.definition
      ? `Lesson: ${data.topic} - ${data.definition}`
      : data.topic ?? fallback;
  }
  if (id === "dsa_question") {
    return data.problem
      ? `Problem${
          data.difficulty ? ` (${data.difficulty})` : ""
        }: ${data.title} - ${data.problem}`
      : data.title ?? fallback;
  }
  if (id === "portfolio_watch") {
    return data.stocks?.length > 0
      ? `${data.title}: ${data.stocks
          .map((stock: any) => `${stock.ticker} (${stock.change})`)
          .join(", ")}`
      : `${data.title}: ${data.text}`;
  }
  if (id === "progress_tracker") {
    return `${data.title} (${data.current}/${data.total}): ${data.text}`;
  }
  if (id === "streak_counter") {
    return data.word && data.definition
      ? `${data.label}: ${data.word} - ${data.definition}`
      : `${data.label}: ${data.count} ${data.unit}${
          data.caption ? ` (${data.caption})` : ""
        }`;
  }
  if (id === "comparison") {
    return data.rows?.length > 0
      ? `${data.title}${data.period ? ` (${data.period})` : ""}: ${data.rows
          .map(
            (row: any) => `${row.label} [${row.changes.join(", ")}]`
          )
          .join(" | ")}`
      : data.title ?? fallback;
  }
  if (id === "briefing_card") {
    const firstItem = data.sections?.[0]?.items?.[0];
    return firstItem
      ? `${data.title}: ${firstItem.title}`
      : `${data.title}: ${data.summary}`;
  }
  return fallback;
}

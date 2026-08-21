import type {
  AgentMessageContent,
  RenderedAgentMessage
} from "../output.js";

export type ResponseLimit = "concise" | "balanced" | "detailed";

type JsonRecord = Record<string, unknown>;

const topLevelFieldsByLimit: Record<
  Exclude<ResponseLimit, "detailed">,
  Record<string, readonly string[]>
> = {
  concise: {
    briefing_card: [
      "missing_sources",
      "priorities",
      "cross_source_insights",
      "conflicts"
    ],
    checklist: ["subtitle", "message", "footer"],
    comparison: ["insight", "trending_narrative"],
    daily_task: ["context", "estimated_minutes"],
    news_brief: ["perspectives", "why_it_matters", "timeline"],
    portfolio_watch: ["material_events", "drivers"],
    urgency_list: ["skipped", "skipped_label"]
  },
  balanced: {
    briefing_card: ["conflicts"],
    comparison: ["trending_narrative"],
    news_brief: ["perspectives", "timeline"],
    portfolio_watch: ["drivers"]
  }
};

export function normalizeResponseLimit(value: unknown): ResponseLimit {
  return value === "concise" || value === "detailed" ? value : "balanced";
}

/**
 * Applies the selected response density to structured output after generation.
 * This keeps UI contracts stable while preventing optional context from leaking
 * into concise responses when a model populates every optional field.
 */
export function applyResponseLimitToContent(
  content: AgentMessageContent,
  responseLimit: ResponseLimit
): AgentMessageContent {
  if (responseLimit === "detailed") return content;

  const data = withoutFields(
    asRecord(content.data),
    topLevelFieldsByLimit[responseLimit][content.template] ?? []
  );

  if (content.template === "content_extractor") {
    data.ideas = compactContentIdeas(data.ideas, responseLimit);
  } else if (content.template === "briefing_card" && responseLimit === "concise") {
    data.sections = compactBriefingSections(data.sections);
  } else if (content.template === "dsa_question" && responseLimit === "concise") {
    delete data.input_format;
    delete data.output_format;
    delete data.constraints;
    delete data.complexity;
    delete data.time_complexity;
    delete data.space_complexity;
    delete data.approach;
    delete data.hint;
    data.references = [];
    data.examples = compactDsaExamples(data.examples);
  } else if (content.template === "study_guide" && responseLimit === "concise") {
    data.references = [];
  } else if (content.template === "streak_counter" && responseLimit === "concise") {
    delete data.caption;
    delete data.example;
    delete data.translation;
  } else if (content.template === "urgency_list" && responseLimit === "concise") {
    data.items = compactUrgencyItems(data.items);
  }

  return { ...content, data } as AgentMessageContent;
}

export function applyResponseLimitToRenderedMessage(
  rendered: RenderedAgentMessage,
  responseLimit: ResponseLimit
): RenderedAgentMessage {
  return {
    ...rendered,
    content: applyResponseLimitToContent(rendered.content, responseLimit)
  };
}

function compactContentIdeas(value: unknown, responseLimit: "concise" | "balanced"): unknown {
  if (!Array.isArray(value)) return value;

  return value.map((entry) => {
    const idea = asRecord(entry);
    const compact: JsonRecord = {
      title: idea.title,
      hook: idea.hook
    };
    if (responseLimit === "balanced") {
      if (idea.angle !== undefined) compact.angle = idea.angle;
      if (idea.audience_value !== undefined) {
        compact.audience_value = idea.audience_value;
      }
    }
    return compact;
  });
}

function compactBriefingSections(value: unknown): unknown {
  if (!Array.isArray(value)) return value;

  return value.map((entry) => {
    const section = asRecord(entry);
    const items = Array.isArray(section.items)
      ? section.items.map((item) => {
          const record = asRecord(item);
          return { title: record.title };
        })
      : section.items;
    return { ...section, items };
  });
}

function compactDsaExamples(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    const example = asRecord(entry);
    return {
      input: example.input,
      output: example.output
    };
  });
}

function compactUrgencyItems(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    const item = asRecord(entry);
    return {
      label: item.label,
      ...(item.urgency !== undefined ? { urgency: item.urgency } : {}),
      ...(item.due !== undefined ? { due: item.due } : {})
    };
  });
}

function withoutFields(value: JsonRecord, fields: readonly string[]): JsonRecord {
  const result = { ...value };
  for (const field of fields) delete result[field];
  return result;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

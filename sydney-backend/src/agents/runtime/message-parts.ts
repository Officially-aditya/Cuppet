import type {
  AgentMessageContent,
  AgentMessagePresentation
} from "../output.js";
import { normalizeAndValidateOutput } from "./output-registry.js";

const MAX_PARTS = 3;
const TEXT_SPLIT_THRESHOLD = 2_600;
const LARGE_TEXT_SPLIT_THRESHOLD = 5_200;
const STRUCTURED_SPLIT_THRESHOLD = 2_400;
const LARGE_STRUCTURED_SPLIT_THRESHOLD = 4_800;

type JsonRecord = Record<string, any>;

export function splitAgentMessageContent(
  content: AgentMessageContent,
  groupId: string
): AgentMessageContent[] {
  const validated = normalizeAndValidateOutput(content) as AgentMessageContent;
  const rawParts = splitValidatedContent(validated);
  if (rawParts.length <= 1) return [validated];

  const partCount = Math.min(rawParts.length, MAX_PARTS);
  return rawParts.slice(0, partCount).map((part, partIndex) => {
    const presentation: AgentMessagePresentation = {
      group_id: groupId,
      part_index: partIndex,
      part_count: partCount,
      ...presentationExtras(part)
    };
    const cleanPart = stripInternalPresentationExtras(part);
    return normalizeAndValidateOutput({
      ...cleanPart,
      presentation
    }) as AgentMessageContent;
  });
}

export function mergeAgentMessageContents(
  contents: readonly AgentMessageContent[]
): AgentMessageContent | null {
  if (contents.length === 0) return null;
  const ordered = [...contents].sort(
    (left, right) =>
      presentationIndex(left) - presentationIndex(right)
  );
  if (
    ordered.length === 1 ||
    ordered.some((part) => part.template !== ordered[0]!.template)
  ) {
    return stripPresentation(ordered[0]!);
  }

  const template = ordered[0]!.template;
  const data = ordered.map((part) => part.data as JsonRecord);
  const merged = (() => {
    switch (template) {
      case "plain_text":
        return mergePlainText(data);
      case "data_summary":
        return mergeDataSummary(data);
      case "urgency_list":
        return mergeListData(data, "items", ["source", "timestamp"], [
          "skipped",
          "skipped_label"
        ]);
      case "checklist":
        return mergeListData(data, "items", ["subtitle", "message"], [
          "footer"
        ]);
      case "comparison":
        return mergeListData(data, "rows", ["period"], [
          "insight",
          "trending_narrative"
        ]);
      case "news_brief":
        return {
          title: firstValue(data, "title") ?? "News brief",
          items: combineArrays(data, "items"),
          ...optionalValue("initialItemCount", firstValue(data, "initialItemCount")),
          ...optionalArray("tldr", combineArrays(data, "tldr")),
          ...optionalArray("perspectives", combineArrays(data, "perspectives")),
          ...optionalValue(
            "why_it_matters",
            firstValue(data, "why_it_matters")
          ),
          ...optionalArray("timeline", combineArrays(data, "timeline"))
        };
      case "content_extractor":
        return { ideas: combineArrays(data, "ideas") };
      case "portfolio_watch":
        return {
          title: firstValue(data, "title") ?? "Portfolio watch",
          text: joinTextValues(data, "text"),
          stocks: combineArrays(data, "stocks"),
          footer: lastValue(data, "footer") ?? "",
          ...optionalArray(
            "material_events",
            combineArrays(data, "material_events")
          ),
          ...optionalArray("drivers", combineArrays(data, "drivers")),
          ...optionalValue("as_of", firstValue(data, "as_of")),
          ...optionalValue("data_quality", firstValue(data, "data_quality"))
        };
      case "briefing_card":
        return {
          eyebrow: firstValue(data, "eyebrow") ?? "BRIEFING",
          title: firstValue(data, "title") ?? "Your briefing",
          summary: joinTextValues(data, "summary"),
          sections: mergeBriefingSections(combineArrays(data, "sections")),
          ...optionalArray(
            "missing_sources",
            combineArrays(data, "missing_sources")
          ),
          ...optionalArray("priorities", combineArrays(data, "priorities")),
          ...optionalArray(
            "cross_source_insights",
            combineArrays(data, "cross_source_insights")
          ),
          ...optionalArray("conflicts", combineArrays(data, "conflicts"))
        };
      default:
        return data[0]!;
    }
  })();

  return normalizeAndValidateOutput({
    template,
    version: ordered[0]!.version,
    data: merged
  }) as AgentMessageContent;
}

export function messageGroupId(content: unknown): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const presentation = (content as JsonRecord).presentation;
  return presentation &&
    typeof presentation === "object" &&
    typeof presentation.group_id === "string"
    ? presentation.group_id
    : null;
}

function splitValidatedContent(
  content: AgentMessageContent
): AgentMessageContent[] {
  switch (content.template) {
    case "plain_text":
      return splitPlainText(content);
    case "data_summary":
      return splitDataSummary(content);
    case "urgency_list":
      return splitListContent(content, "items", ["source", "timestamp"], [
        "skipped",
        "skipped_label"
      ]);
    case "checklist":
      return splitListContent(content, "items", ["subtitle", "message"], [
        "footer"
      ]);
    case "comparison":
      return splitListContent(content, "rows", ["period"], [
        "insight",
        "trending_narrative"
      ]);
    case "news_brief":
      return splitNewsBrief(content);
    case "content_extractor":
      return splitContentExtractor(content);
    case "portfolio_watch":
      return splitPortfolioWatch(content);
    case "briefing_card":
      return splitBriefingCard(content);
    default:
      // Interactive and compact deterministic contracts intentionally remain
      // one message so their trusted actions and state effects stay atomic.
      return [content];
  }
}

function splitPlainText(content: AgentMessageContent): AgentMessageContent[] {
  if (content.template !== "plain_text") return [content];
  const body = content.data.body.trim();
  if (body.length <= TEXT_SPLIT_THRESHOLD) return [content];

  const count = body.length > LARGE_TEXT_SPLIT_THRESHOLD ? 3 : 2;
  const chunks = splitTextSemantically(body, count);
  if (chunks.length <= 1) return [content];
  return chunks.map((chunk, index) => ({
    template: "plain_text",
    version: "1.0",
    data: {
      body: chunk,
      ...(index === 0 && content.data.headline
        ? { headline: content.data.headline }
        : {}),
      ...(index === chunks.length - 1 && content.data.footer
        ? { footer: content.data.footer }
        : {}),
      ...(index === chunks.length - 1 && content.data.items
        ? { items: content.data.items }
        : {})
    }
  }));
}

function splitNewsBrief(content: AgentMessageContent): AgentMessageContent[] {
  if (content.template !== "news_brief") return [content];
  const data = content.data;
  if (!data.tldr?.length || data.items.length === 0) {
    return [content];
  }

  const hasContext = Boolean(
    data.perspectives?.length ||
      data.why_it_matters ||
      data.timeline?.length
  );
  const parts: AgentMessageContent[] = [
    {
      template: "news_brief",
      version: "1.0",
      data: {
        title: data.title,
        items: [],
        tldr: data.tldr
      }
    },
    {
      template: "news_brief",
      version: "1.0",
      data: {
        title: `${data.title} — Detailed coverage`,
        items: data.items,
        ...(data.initialItemCount
          ? { initialItemCount: data.initialItemCount }
          : {})
      }
    }
  ];
  if (hasContext) {
    parts.push({
      template: "news_brief",
      version: "1.0",
      data: {
        title: `${data.title} — Context and timeline`,
        items: [],
        ...(data.why_it_matters
          ? { why_it_matters: data.why_it_matters }
          : {}),
        ...(data.perspectives
          ? { perspectives: data.perspectives }
          : {}),
        ...(data.timeline ? { timeline: data.timeline } : {})
      }
    });
  }
  return parts;
}

function splitDataSummary(
  content: AgentMessageContent
): AgentMessageContent[] {
  if (content.template !== "data_summary") return [content];
  const data = content.data as JsonRecord;
  const listKey = ["messages", "timeline", "items"].sort(
    (left, right) =>
      arrayValue(data[right]).length - arrayValue(data[left]).length
  )[0]!;
  const list = arrayValue(data[listKey]);
  const size = visibleSize(data);

  if (list.length === 0) {
    const textKey = ["text", "summary", "description"].find(
      (key) => typeof data[key] === "string" && data[key].length > TEXT_SPLIT_THRESHOLD
    );
    if (!textKey) return [content];
    const chunks = splitTextSemantically(
      data[textKey],
      data[textKey].length > LARGE_TEXT_SPLIT_THRESHOLD ? 3 : 2
    );
    return chunks.map((chunk, index) => ({
      template: "data_summary",
      version: "1.0",
      data: {
        title: data.title,
        ...(data.kind ? { kind: data.kind } : {}),
        [textKey]: chunk,
        ...(index === 0 && data.metrics ? { metrics: data.metrics } : {}),
        ...(index === 0 && data.action_items
          ? { action_items: data.action_items }
          : {}),
        ...(index === chunks.length - 1 && data.footer
          ? { footer: data.footer }
          : {})
      }
    })) as AgentMessageContent[];
  }

  if (size <= STRUCTURED_SPLIT_THRESHOLD && list.length <= 4) {
    return [content];
  }
  const count =
    size > LARGE_STRUCTURED_SPLIT_THRESHOLD || list.length > 8 ? 3 : 2;
  const chunks = balancedChunks(list, count);
  return chunks.map((chunk, index) => {
    const isFirst = index === 0;
    const isLast = index === chunks.length - 1;
    const partData: JsonRecord = {
      title: data.title,
      ...(data.kind ? { kind: data.kind } : {}),
      [listKey]: chunk
    };
    if (isFirst) {
      for (const key of [
        "text",
        "summary",
        "description",
        "metrics",
        "action_items"
      ]) {
        if (data[key] !== undefined) partData[key] = data[key];
      }
    }
    if (isLast) {
      for (const key of ["items", "timeline", "messages"]) {
        if (key !== listKey && data[key] !== undefined) partData[key] = data[key];
      }
      if (data.footer !== undefined) partData.footer = data.footer;
    }
    return {
      template: "data_summary",
      version: "1.0",
      data: partData
    } as AgentMessageContent;
  });
}

function splitListContent(
  content: AgentMessageContent,
  listKey: "items" | "rows",
  firstOnlyKeys: string[],
  lastOnlyKeys: string[]
): AgentMessageContent[] {
  const data = content.data as JsonRecord;
  const items = arrayValue(data[listKey]);
  const size = visibleSize(data);
  if (size <= STRUCTURED_SPLIT_THRESHOLD && items.length <= 6) {
    return [content];
  }
  if (items.length < 2) return [content];

  const count =
    size > LARGE_STRUCTURED_SPLIT_THRESHOLD || items.length > 10 ? 3 : 2;
  const chunks = balancedChunks(items, count);
  return chunks.map((chunk, index) => {
    const partData: JsonRecord = { title: data.title, [listKey]: chunk };
    if (index === 0) {
      for (const key of firstOnlyKeys) {
        if (data[key] !== undefined) partData[key] = data[key];
      }
    }
    if (index === chunks.length - 1) {
      for (const key of lastOnlyKeys) {
        if (data[key] !== undefined) partData[key] = data[key];
      }
    }
    return {
      template: content.template,
      version: content.version,
      data: partData
    } as AgentMessageContent;
  });
}

function splitContentExtractor(
  content: AgentMessageContent
): AgentMessageContent[] {
  if (content.template !== "content_extractor") return [content];
  const ideas = content.data.ideas;
  const size = visibleSize(content.data);
  if (size <= 1_800 || ideas.length < 2) return [content];

  const count = size > LARGE_STRUCTURED_SPLIT_THRESHOLD ? 3 : 2;
  const chunks = balancedChunks(ideas, Math.min(count, ideas.length));
  let offset = 0;
  return chunks.map((ideasChunk) => {
    const part = {
      template: "content_extractor",
      version: "1.0",
      data: { ideas: ideasChunk },
      __item_offset: offset
    } as AgentMessageContent & { __item_offset: number };
    offset += ideasChunk.length;
    return part;
  });
}

function splitPortfolioWatch(
  content: AgentMessageContent
): AgentMessageContent[] {
  if (content.template !== "portfolio_watch") return [content];
  const data = content.data;
  const size = visibleSize(data);
  if (
    data.stocks.length < 2 ||
    (size <= STRUCTURED_SPLIT_THRESHOLD && data.stocks.length <= 4)
  ) {
    return [content];
  }

  const count =
    size > LARGE_STRUCTURED_SPLIT_THRESHOLD || data.stocks.length > 8 ? 3 : 2;
  const chunks = balancedChunks(data.stocks, count);
  return chunks.map((stocks, index) => {
    const isFirst = index === 0;
    const isLast = index === chunks.length - 1;
    return {
      template: "portfolio_watch",
      version: "1.0",
      data: {
        title: data.title,
        text: isFirst ? data.text : "",
        stocks,
        footer: isLast ? data.footer : "",
        ...(isFirst && data.as_of ? { as_of: data.as_of } : {}),
        ...(isFirst && data.data_quality
          ? { data_quality: data.data_quality }
          : {}),
        ...(isLast && data.material_events
          ? { material_events: data.material_events }
          : {}),
        ...(isLast && data.drivers ? { drivers: data.drivers } : {})
      }
    };
  });
}

function splitBriefingCard(
  content: AgentMessageContent
): AgentMessageContent[] {
  if (content.template !== "briefing_card") return [content];
  const data = content.data;
  const itemCount = data.sections.reduce(
    (total, section) => total + section.items.length,
    0
  );
  const size = visibleSize(data);
  if (
    size <= STRUCTURED_SPLIT_THRESHOLD &&
    itemCount <= 5 &&
    data.sections.length <= 2
  ) {
    return [content];
  }
  if (data.sections.length === 0) return [content];

  const count =
    size > LARGE_STRUCTURED_SPLIT_THRESHOLD || itemCount > 10 ? 3 : 2;
  const sectionChunks = splitBriefingSections(data.sections, count);
  return sectionChunks.map((sections, index) => {
    const isFirst = index === 0;
    const isLast = index === sectionChunks.length - 1;
    return {
      template: "briefing_card",
      version: "1.0",
      data: {
        eyebrow: data.eyebrow,
        title: data.title,
        summary: isFirst ? data.summary : "",
        sections,
        ...(isFirst && data.priorities
          ? { priorities: data.priorities }
          : {}),
        ...(isLast && data.missing_sources
          ? { missing_sources: data.missing_sources }
          : {}),
        ...(isLast && data.cross_source_insights
          ? { cross_source_insights: data.cross_source_insights }
          : {}),
        ...(isLast && data.conflicts ? { conflicts: data.conflicts } : {})
      }
    } as unknown as AgentMessageContent;
  });
}

function splitBriefingSections(
  sections: Array<JsonRecord>,
  count: number
): Array<Array<JsonRecord>> {
  const entries = sections.flatMap((section) =>
    arrayValue(section.items).map((item) => ({ section, item }))
  );
  if (entries.length === 0) return balancedChunks(sections, count);

  return balancedChunks(entries, count).map((chunk) => {
    const grouped: JsonRecord[] = [];
    for (const entry of chunk) {
      const previous = grouped[grouped.length - 1];
      if (previous && previous.id === entry.section.id) {
        previous.items.push(entry.item);
      } else {
        grouped.push({ ...entry.section, items: [entry.item] });
      }
    }
    return grouped;
  });
}

function mergePlainText(parts: JsonRecord[]): JsonRecord {
  return {
    body: joinTextValues(parts, "body"),
    ...optionalValue("headline", firstValue(parts, "headline")),
    ...optionalValue("text", firstValue(parts, "text")),
    ...optionalValue("footer", lastValue(parts, "footer")),
    ...optionalArray("items", combineArrays(parts, "items"))
  };
}

function mergeDataSummary(parts: JsonRecord[]): JsonRecord {
  return {
    title: firstValue(parts, "title") ?? "Summary",
    ...optionalValue("text", joinTextValues(parts, "text") || undefined),
    ...optionalValue("summary", joinTextValues(parts, "summary") || undefined),
    ...optionalValue(
      "description",
      joinTextValues(parts, "description") || undefined
    ),
    ...optionalArray("metrics", combineArrays(parts, "metrics")),
    ...optionalArray("items", combineArrays(parts, "items")),
    ...optionalValue("footer", lastValue(parts, "footer")),
    ...optionalValue("kind", firstValue(parts, "kind")),
    ...optionalArray("timeline", combineArrays(parts, "timeline")),
    ...optionalArray("messages", combineArrays(parts, "messages")),
    ...optionalArray("action_items", combineArrays(parts, "action_items"))
  };
}

function mergeListData(
  parts: JsonRecord[],
  listKey: string,
  firstKeys: string[],
  lastKeys: string[]
): JsonRecord {
  const merged: JsonRecord = {
    title: firstValue(parts, "title") ?? "Update",
    [listKey]: combineArrays(parts, listKey)
  };
  for (const key of firstKeys) {
    const value = firstValue(parts, key);
    if (value !== undefined) merged[key] = value;
  }
  for (const key of lastKeys) {
    const value = lastValue(parts, key);
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

function mergeBriefingSections(sections: any[]): any[] {
  const merged: any[] = [];
  const byId = new Map<string, any>();
  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const id = String(section.id ?? `section-${merged.length}`);
    const existing = byId.get(id);
    if (existing) {
      existing.items.push(...arrayValue(section.items));
      continue;
    }
    const copy = { ...section, items: [...arrayValue(section.items)] };
    byId.set(id, copy);
    merged.push(copy);
  }
  return merged;
}

function splitTextSemantically(value: string, requestedCount: number): string[] {
  const count = Math.max(2, Math.min(MAX_PARTS, requestedCount));
  let separator = "\n\n";
  let units = value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (units.length < count) {
    separator = " ";
    units = value
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'([])/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (units.length < count) {
    separator = " ";
    units = splitWords(value, count);
  }

  const target = Math.ceil(value.length / count);
  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    if (
      current &&
      chunks.length < count - 1 &&
      current.length + separator.length + unit.length > target
    ) {
      chunks.push(current.trim());
      current = unit;
    } else {
      current = current ? `${current}${separator}${unit}` : unit;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.slice(0, count - 1).concat(
    chunks.length > count
      ? [chunks.slice(count - 1).join("\n\n")]
      : chunks.slice(count - 1)
  );
}

function splitWords(value: string, count: number): string[] {
  const words = value.trim().split(/\s+/);
  const perPart = Math.ceil(words.length / count);
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += perPart) {
    chunks.push(words.slice(index, index + perPart).join(" "));
  }
  return chunks;
}

function balancedChunks<T>(items: readonly T[], count: number): T[][] {
  if (items.length === 0) return [[]];
  const actualCount = Math.max(1, Math.min(MAX_PARTS, count, items.length));
  const result: T[][] = [];
  let cursor = 0;
  for (let index = 0; index < actualCount; index++) {
    const remaining = items.length - cursor;
    const remainingParts = actualCount - index;
    const size = Math.ceil(remaining / remainingParts);
    result.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return result;
}

function visibleSize(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + visibleSize(item), 0);
  }
  if (value && typeof value === "object") {
    return Object.values(value).reduce(
      (total, item) => total + visibleSize(item),
      0
    );
  }
  return 0;
}

function arrayValue(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function combineArrays(parts: JsonRecord[], key: string): any[] {
  return parts.flatMap((part) => arrayValue(part[key]));
}

function firstValue(parts: JsonRecord[], key: string): any {
  return parts.map((part) => part[key]).find((value) => value !== undefined);
}

function lastValue(parts: JsonRecord[], key: string): any {
  return [...parts]
    .reverse()
    .map((part) => part[key])
    .find((value) => value !== undefined);
}

function joinTextValues(parts: JsonRecord[], key: string): string {
  const values = parts
    .map((part) => part[key])
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    );
  return values.join("\n\n");
}

function optionalValue(key: string, value: any): JsonRecord {
  return value === undefined || value === null || value === ""
    ? {}
    : { [key]: value };
}

function optionalArray(key: string, value: any[]): JsonRecord {
  return value.length === 0 ? {} : { [key]: value };
}

function presentationIndex(content: AgentMessageContent): number {
  return content.presentation?.part_index ?? 0;
}

function stripPresentation(content: AgentMessageContent): AgentMessageContent {
  const { presentation: _presentation, ...rest } = content;
  return rest as AgentMessageContent;
}

function presentationExtras(content: AgentMessageContent): {
  item_offset?: number;
} {
  const offset = (content as AgentMessageContent & { __item_offset?: number })
    .__item_offset;
  return typeof offset === "number" ? { item_offset: offset } : {};
}

function stripInternalPresentationExtras(
  content: AgentMessageContent
): AgentMessageContent {
  const { __item_offset: _offset, ...rest } = content as AgentMessageContent & {
    __item_offset?: number;
  };
  return rest as AgentMessageContent;
}

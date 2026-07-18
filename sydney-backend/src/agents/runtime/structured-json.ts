export type NormalizedNewsBriefJson = {
  tldr?: string[];
  items: Array<{
    headline?: string;
    summary: string;
    category?: string;
    source?: string;
    url?: string;
  }>;
  perspectives?: Array<{
    label: string;
    summary: string;
    source?: string;
    url?: string;
  }>;
  why_it_matters?: string;
  timeline?: Array<{
    date: string;
    event: string;
  }>;
};

export function normalizeNewsBriefJson(
  value: unknown
): NormalizedNewsBriefJson | null {
  if (typeof value === "string") {
    for (const candidate of extractJsonObjects(value)) {
      try {
        const normalized = normalizeNewsRecord(JSON.parse(candidate));
        if (normalized) return normalized;
      } catch {
        // Keep looking, then salvage complete members from truncated JSON.
      }
    }
    return salvageTruncatedNewsJson(value);
  }

  return normalizeNewsRecord(value);
}

function normalizeNewsRecord(value: unknown): NormalizedNewsBriefJson | null {
  const record = asRecord(value);
  if (!record) return null;

  const wrappedData = asRecord(record.data);
  const source =
    record.template === "news_brief" && wrappedData ? wrappedData : record;
  const items = normalizeNewsItems(source.items);
  if (items.length === 0) return null;

  const tldr = stringArray(source.tldr, 3, 500);
  const perspectives = normalizePerspectives(source.perspectives);
  const timeline = normalizeTimeline(source.timeline);
  const whyItMatters = cleanString(source.why_it_matters, 1800);

  return {
    ...(tldr.length > 0 ? { tldr } : {}),
    items,
    ...(perspectives.length > 0 ? { perspectives } : {}),
    ...(whyItMatters ? { why_it_matters: whyItMatters } : {}),
    ...(timeline.length > 0 ? { timeline } : {})
  };
}

function salvageTruncatedNewsJson(
  value: string
): NormalizedNewsBriefJson | null {
  const items = normalizeNewsItems(objectArrayMembers(value, "items"));
  if (items.length === 0) return null;

  const tldrValue = completeArrayValue(value, "tldr");
  const tldr = stringArray(tldrValue, 3, 500);
  const perspectives = normalizePerspectives(
    objectArrayMembers(value, "perspectives")
  );
  const timeline = normalizeTimeline(objectArrayMembers(value, "timeline"));
  const whyItMatters = extractJsonString(value, "why_it_matters", 1800);

  return {
    ...(tldr.length > 0 ? { tldr } : {}),
    items,
    ...(perspectives.length > 0 ? { perspectives } : {}),
    ...(whyItMatters ? { why_it_matters: whyItMatters } : {}),
    ...(timeline.length > 0 ? { timeline } : {})
  };
}

function normalizeNewsItems(value: unknown): NormalizedNewsBriefJson["items"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const item = asRecord(entry);
      if (!item) return null;
      const summary = cleanString(item.summary, 1800);
      if (!summary) return null;
      const headline = cleanString(item.headline, 300);
      const category = cleanString(item.category, 120);
      const source = cleanString(item.source, 300);
      const url = cleanUrl(item.url);
      return {
        ...(headline ? { headline } : {}),
        summary,
        ...(category ? { category } : {}),
        ...(source ? { source } : {}),
        ...(url ? { url } : {})
      };
    })
    .filter(
      (item): item is NormalizedNewsBriefJson["items"][number] => item !== null
    )
    .slice(0, 5);
}

function normalizePerspectives(
  value: unknown
): NonNullable<NormalizedNewsBriefJson["perspectives"]> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const item = asRecord(entry);
      if (!item) return null;
      const label = cleanString(item.label, 160);
      const summary = cleanString(item.summary, 1000);
      if (!label || !summary) return null;
      const source = cleanString(item.source, 300);
      const url = cleanUrl(item.url);
      return {
        label,
        summary,
        ...(source ? { source } : {}),
        ...(url ? { url } : {})
      };
    })
    .filter(
      (
        item
      ): item is NonNullable<
        NormalizedNewsBriefJson["perspectives"]
      >[number] => item !== null
    )
    .slice(0, 6);
}

function normalizeTimeline(
  value: unknown
): NonNullable<NormalizedNewsBriefJson["timeline"]> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const item = asRecord(entry);
      if (!item) return null;
      const date = cleanString(item.date, 120);
      const event = cleanString(item.event, 700);
      return date && event ? { date, event } : null;
    })
    .filter(
      (
        item
      ): item is NonNullable<NormalizedNewsBriefJson["timeline"]>[number] =>
        item !== null
    )
    .slice(0, 5);
}

function completeArrayValue(value: string, key: string): unknown[] | null {
  const contents = arrayContents(value, key, false);
  if (contents === null) return null;
  try {
    const parsed: unknown = JSON.parse(`[${contents}]`);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function objectArrayMembers(value: string, key: string): unknown[] {
  const contents = arrayContents(value, key, true);
  if (contents === null) return [];
  const members: unknown[] = [];
  for (const candidate of extractJsonObjects(contents)) {
    try {
      members.push(JSON.parse(candidate));
    } catch {
      // Ignore an incomplete member while retaining earlier complete members.
    }
  }
  return members;
}

function arrayContents(
  value: string,
  key: string,
  allowTruncated: boolean
): string | null {
  const match = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*\\[`).exec(value);
  if (!match) return null;
  const start = match.index + match[0].length;
  const end = matchingDelimiter(value, start - 1, "[", "]");
  if (end === -1) {
    return allowTruncated ? value.slice(start) : null;
  }
  return value.slice(start, end);
}

function extractJsonString(
  value: string,
  key: string,
  maxLength: number
): string | undefined {
  const match = new RegExp(
    `"${escapeRegExp(key)}"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`
  ).exec(value);
  if (!match?.[1]) return undefined;
  try {
    return cleanString(JSON.parse(match[1]), maxLength);
  } catch {
    return undefined;
  }
}

function extractJsonObjects(value: string): string[] {
  const objects: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "{") continue;
    const end = matchingDelimiter(value, index, "{", "}");
    if (end === -1) continue;
    objects.push(value.slice(index, end + 1));
    index = end;
  }
  return objects;
}

function matchingDelimiter(
  value: string,
  start: number,
  open: string,
  close: string
): number {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function stringArray(
  value: unknown,
  maxItems: number,
  maxLength: number
): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => cleanString(entry, maxLength))
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, maxItems);
}

function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim();
  return clean ? clean.slice(0, maxLength) : undefined;
}

function cleanUrl(value: unknown): string | undefined {
  const clean = cleanString(value, 3000);
  if (!clean) return undefined;
  try {
    const parsed = new URL(clean);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? clean
      : undefined;
  } catch {
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

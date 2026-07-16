export type NamedAgentTargetResolution<T extends { name: string }> =
  | { kind: "resolved"; agent: T }
  | { kind: "not_found"; matches: [] }
  | { kind: "ambiguous"; matches: T[] };

export function resolveAgentTargetFromList<T extends { name: string }>(
  agents: T[],
  target: string
): NamedAgentTargetResolution<T> {
  const normalized = normalizeAgentName(target);
  const exact = agents.filter(
    (agent) => normalizeAgentName(agent.name) === normalized
  );
  if (exact.length === 1) return { kind: "resolved", agent: exact[0]! };
  if (exact.length > 1) return { kind: "ambiguous", matches: exact };

  const prefix = agents.filter((agent) =>
    normalizeAgentName(agent.name).startsWith(normalized)
  );
  if (prefix.length === 1) return { kind: "resolved", agent: prefix[0]! };
  if (prefix.length > 1) return { kind: "ambiguous", matches: prefix };
  return { kind: "not_found", matches: [] };
}

export function normalizeAgentName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

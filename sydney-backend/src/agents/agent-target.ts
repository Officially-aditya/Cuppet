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

  const conciseTarget = normalizeAgentTarget(target);
  const conciseExact = agents.filter(
    (agent) => normalizeAgentTarget(agent.name) === conciseTarget
  );
  if (conciseExact.length === 1) {
    return { kind: "resolved", agent: conciseExact[0]! };
  }
  if (conciseExact.length > 1) {
    return { kind: "ambiguous", matches: conciseExact };
  }

  const prefix = agents.filter((agent) =>
    normalizeAgentTarget(agent.name).startsWith(conciseTarget)
  );
  if (prefix.length === 1) return { kind: "resolved", agent: prefix[0]! };
  if (prefix.length > 1) return { kind: "ambiguous", matches: prefix };

  const targetTokens = conciseTarget.split(" ").filter(Boolean);
  if (targetTokens.length >= 2) {
    const tokenMatches = agents.filter((agent) => {
      const nameTokens = new Set(normalizeAgentTarget(agent.name).split(" "));
      return targetTokens.every((token) => nameTokens.has(token));
    });
    if (tokenMatches.length === 1) {
      return { kind: "resolved", agent: tokenMatches[0]! };
    }
    if (tokenMatches.length > 1) {
      return { kind: "ambiguous", matches: tokenMatches };
    }
  }
  return { kind: "not_found", matches: [] };
}

export function isContextualAgentTarget(value: string): boolean {
  return /^(?:(?:the|this|that|selected|chosen|same|previous|last)\s+)*(?:one|agent)$/i.test(
    normalizeAgentName(value)
  );
}

export function normalizeAgentName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeAgentTarget(value: string): string {
  return normalizeAgentName(value)
    .replace(/^(?:(?:the|my|our)\s+)+/, "")
    .replace(/\s+(?:(?:agent|automation|bot)\s*)+$/, "")
    .trim();
}

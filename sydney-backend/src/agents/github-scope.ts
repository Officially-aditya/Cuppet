const repositoryStopWords = new Set([
  "activity",
  "all",
  "any",
  "change",
  "changes",
  "commit",
  "commits",
  "digest",
  "event",
  "events",
  "for",
  "in",
  "issue",
  "issues",
  "my",
  "monitor",
  "monitoring",
  "owner",
  "on",
  "pr",
  "prs",
  "pull",
  "release",
  "releases",
  "request",
  "requests",
  "status",
  "summary",
  "the",
  "to",
  "update",
  "updates",
  "watch",
  "watcher",
  "workflow",
  "workflows"
]);

const repositoryName = "[A-Za-z0-9][A-Za-z0-9._-]{0,99}";
const fullRepositoryPattern = new RegExp(
  `(?:(?:https?://|git@)?github\\.com[/:])` +
    `(${repositoryName}/${repositoryName})(?:\\.git)?(?=$|[\\s/?#])`,
  "i"
);
const labeledRepositoryPattern = new RegExp(
  `\\b(?:github\\s+)?repo(?:sitory)?\\b\\s*` +
    `(?:(?:named|called|is)\\s*)?(?:[:=#-]\\s*)?` +
    `(?:[\\u0060'\"“”‘’]\\s*)?(${repositoryName}(?:/${repositoryName})?)(?:\\.git)?`,
  "i"
);

export function extractGitHubRepository(prompt: string): string | null {
  const fromUrl = prompt.match(fullRepositoryPattern)?.[1];
  if (fromUrl) return normalizeGitHubRepository(fromUrl);

  const labeled = prompt.match(labeledRepositoryPattern)?.[1];
  return normalizeGitHubRepository(labeled);
}

export function normalizeGitHubRepository(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value
    .trim()
    .replace(/^github\.com[/:]/i, "")
    .replace(/[.,;:!?]+$/, "")
    .replace(/\.git$/i, "");
  if (!trimmed || trimmed.length > 200) return null;

  const parts = trimmed.split("/");
  if (
    parts.length > 2 ||
    parts.some((part) => !new RegExp(`^${repositoryName}$`).test(part))
  ) {
    return null;
  }
  if (parts.length === 1 && repositoryStopWords.has(parts[0]!.toLowerCase())) {
    return null;
  }

  return trimmed;
}

export function githubRepositoryScope(
  parsedIntent: Record<string, unknown>,
  fallbackPrompt?: string
): string | null {
  return (
    normalizeGitHubRepository(parsedIntent.github_repository) ??
    (fallbackPrompt ? extractGitHubRepository(fallbackPrompt) : null)
  );
}

export function githubRepositoryMatches(
  scope: string | null,
  eventRepository: unknown
): boolean {
  if (!scope) return true;

  const repository = normalizeGitHubRepository(eventRepository);
  if (!repository) return false;

  const normalizedScope = scope.toLowerCase();
  const normalizedRepository = repository.toLowerCase();
  return normalizedScope.includes("/")
    ? normalizedRepository === normalizedScope
    : normalizedRepository.split("/").at(-1) === normalizedScope;
}

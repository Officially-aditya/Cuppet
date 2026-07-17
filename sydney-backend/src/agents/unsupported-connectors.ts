/**
 * Connectors the product mentions or users request but cannot fully connect yet.
 * Single source of truth for parser + message router.
 */

/** Used by intent parsing when creating agents. */
export const UNSUPPORTED_CONNECTORS = [
  "instagram",
  "whatsapp",
  "twitter",
  "linkedin",
  "google fit",
  "fitbit"
] as const;

/**
 * Connectors that cannot be added mid-conversation via chat.
 * Includes calendar: agenda agents exist, but chat "add calendar" is not wired.
 */
export const UNSUPPORTED_CHAT_CONNECTORS = [
  ...UNSUPPORTED_CONNECTORS,
  "calendar"
] as const;

/**
 * Named as post formats / audiences for drafting agents — not OAuth connectors.
 * Mentioning these must not block content-extractor create/update flows.
 */
export const DRAFT_OUTPUT_PLATFORMS = new Set([
  "twitter",
  "linkedin",
  "x"
]);

export type UnsupportedConnector = (typeof UNSUPPORTED_CONNECTORS)[number];

/** Find the first unsupported connector name mentioned in free text (case-insensitive). */
export function findUnsupportedConnectorMention(
  text: string,
  list: readonly string[] = UNSUPPORTED_CONNECTORS
): string | undefined {
  const lower = text.toLowerCase();
  return list.find((connector) => lower.includes(connector));
}

/** True when text describes drafting social posts rather than connecting an account. */
export function looksLikeContentDraftPrompt(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes("content extractor")) return true;
  if (lower.includes("content") && lower.includes("extractor")) return true;
  const platform =
    /\b(?:twitter|linkedin|reddit|tweet|tweets)\b/.test(lower) ||
    /\bx\s*\(twitter\)/.test(lower);
  const drafty =
    /\b(?:draft|drafts|post|posts|write|writing|caption|thread|threads|content creation|social media|content ideas?)\b/.test(
      lower
    );
  return platform && drafty;
}

/** Explicit request to connect / authorize an unsupported service. */
export function isUnsupportedConnectorAccessRequest(
  text: string,
  connector: string
): boolean {
  const lower = text.toLowerCase();
  if (!lower.includes(connector)) return false;
  if (
    /\b(?:connect|reconnect|link|authorize|authorise|oauth|login|log in|sign in|integrate)\b/.test(
      lower
    )
  ) {
    return true;
  }
  return new RegExp(
    `\\b(?:my|the)\\s+${connector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:account|access|connection|integration)\\b`
  ).test(lower);
}

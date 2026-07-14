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

export type UnsupportedConnector = (typeof UNSUPPORTED_CONNECTORS)[number];

/** Find the first unsupported connector name mentioned in free text (case-insensitive). */
export function findUnsupportedConnectorMention(
  text: string,
  list: readonly string[] = UNSUPPORTED_CONNECTORS
): string | undefined {
  const lower = text.toLowerCase();
  return list.find((connector) => lower.includes(connector));
}

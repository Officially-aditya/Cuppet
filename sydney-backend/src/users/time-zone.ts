import { z } from "zod";

const ianaTimeZonePattern = /^(?:UTC|[A-Za-z][A-Za-z0-9._+-]*\/[A-Za-z0-9._+\/-]+)$/;

/**
 * Validates a regional IANA time-zone identifier supplied by a device.
 *
 * We deliberately reject fixed numeric offsets and ambiguous abbreviations
 * such as `+05:30`, `IST`, and `PST`: they cannot follow daylight-saving
 * changes reliably. IANA aliases are preserved because the canonical name
 * returned by Node can vary with the ICU/tzdata version (for example,
 * Asia/Kolkata may resolve to Asia/Calcutta on older data).
 */
export function normalizeIanaTimeZone(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  const normalizedUtc = ["UTC", "Etc/UTC", "Etc/GMT", "GMT"].includes(trimmed)
    ? "UTC"
    : trimmed;

  if (
    normalizedUtc.length === 0 ||
    normalizedUtc.length > 100 ||
    !ianaTimeZonePattern.test(normalizedUtc)
  ) {
    return null;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalizedUtc }).format();
    return normalizedUtc;
  } catch {
    return null;
  }
}

export const ianaTimeZoneSchema = z.string().transform((value, context) => {
  const normalized = normalizeIanaTimeZone(value);
  if (!normalized) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Time zone must be a valid IANA identifier, such as Europe/London."
    });
    return z.NEVER;
  }
  return normalized;
});

export function effectiveTimeZone(
  storedTimeZone: unknown,
  legacyFallback: string
): string {
  return (
    normalizeIanaTimeZone(storedTimeZone) ??
    normalizeIanaTimeZone(legacyFallback) ??
    "UTC"
  );
}

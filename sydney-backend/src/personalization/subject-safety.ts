export function normalizeSubjectKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9:_-]/g, "")
    .slice(0, 120);
}

export function isSafeSubjectKey(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 120 &&
    trimmed.split(/\s+/).length <= 8 &&
    !/[\r\n@]/.test(trimmed) &&
    !/https?:\/\//i.test(trimmed) &&
     !/\b(?:password|passcode|token|secret|private key|one[- ]time code|ssn|social security|credit card|bank account|account number|passport|medical record|diagnosis|prescription|health condition|date of birth|home address|phone number)\b/i.test(trimmed);
}

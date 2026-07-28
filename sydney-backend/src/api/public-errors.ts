import type { FastifyInstance, FastifyReply } from "fastify";

export type PublicApiError = {
  code: string;
  message: string;
  retryable: boolean;
  retry_after_seconds?: number;
  [key: string]: unknown;
};

export type PublicApiErrorBody = { error: PublicApiError };

const knownMessages: Record<string, string> = {
  AGENT_NOT_FOUND:
    "That agent is no longer available. Refresh your agents and try again.",
  MESSAGE_NOT_FOUND:
    "That message is no longer available. Refresh the conversation and try again.",
  MEMORY_NOT_FOUND:
    "That memory is no longer available. Refresh Memory settings and try again.",
  COMPACTED_MEMORY_NOT_FOUND:
    "Compacted memory is no longer available. Refresh Memory settings and try again.",
  CONNECTOR_NOT_FOUND:
    "That connector is not available. Refresh the connector list and try again.",
  CONNECTOR_OAUTH_REQUIRED:
    "This connector needs to be connected again before Cuppet can continue.",
  CONNECTOR_OAUTH_FAILED:
    "We couldn’t finish connecting that service. Please try connecting it again.",
  INVALID_CONNECTOR_OAUTH_CALLBACK:
    "We couldn’t verify that connection. Please start the connection again.",
  AUTH_FAILURE:
    "We couldn’t complete sign-in right now. Please wait a moment and try again.",
  GOOGLE_SIGN_IN_FAILED:
    "We couldn’t complete Google sign-in right now. Please try again.",
  INVALID_EMAIL_OR_PASSWORD:
    "That email or password didn’t match. Check your details and try again.",
  INVALID_CREDENTIALS:
    "Those sign-in details didn’t match. Check them and try again.",
  ARCHIVE_DRIVE_AUTH_REQUIRED:
    "Google Drive needs to be connected again before archives can be opened.",
  ARCHIVE_FILE_MISSING:
    "That archive file is no longer available in Google Drive.",
  ARCHIVE_FILE_INVALID:
    "That archive file couldn’t be opened safely. Check the file in Google Drive and try again.",
  REGISTRATION_FAILED:
    "Notifications couldn’t be enabled right now. Please wait a moment and try again.",
  UNREGISTRATION_FAILED:
    "Notification settings couldn’t be updated right now. Please try again.",
  UPLOAD_QUOTA_EXCEEDED:
    "There isn’t enough temporary upload space for that file. Remove an older upload or wait and try again.",
  PAYLOAD_TOO_LARGE:
    "That request is too large. Choose a smaller file or shorter message and try again."
};

export function registerPublicErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const status = publicStatus(error);
    const code = errorCodeForStatus(status, error);
    request.log.error(
      { error, status, requestId: request.id },
      "Request failed"
    );
    if (code === "LLM_TOKEN_LIMIT_EXCEEDED") {
      const retryAfterSeconds =
        isRecord(error) && typeof error.retryAfterSeconds === "number"
          ? error.retryAfterSeconds
          : undefined;
      if (retryAfterSeconds && retryAfterSeconds > 0) {
        reply.header("retry-after", retryAfterSeconds);
      }
      return reply.code(status).send({
        error: {
          code,
          message: publicMessage(
            isRecord(error) ? error.message : undefined,
            status,
            code
          ),
          retryable: false,
          ...(retryAfterSeconds
            ? { retry_after_seconds: retryAfterSeconds }
            : {}),
          ...(isRecord(error) && error.resetAt instanceof Date
            ? { reset_at: error.resetAt.toISOString() }
            : {})
        }
      });
    }
    return reply.code(status).send({
      error: {
        code,
        message: defaultMessage(status),
        retryable: retryableStatus(status)
      }
    });
  });

  app.addHook("onSend", async (request, reply, payload) => {
    if (
      reply.statusCode < 400 ||
      isMachineEndpoint(request.url) ||
      Buffer.isBuffer(payload)
    ) {
      return payload;
    }

    const parsed = parsePayload(payload);
    if (!parsed) return payload;

    const normalized = normalizePublicError(
      parsed,
      reply.statusCode,
      retryAfterSeconds(reply)
    );
    reply.header("content-type", "application/json; charset=utf-8");
    return JSON.stringify(normalized);
  });
}

export function normalizePublicError(
  body: unknown,
  status: number,
  retryAfter?: number
): PublicApiErrorBody {
  const root = isRecord(body) ? body : {};
  const nested = isRecord(root.error) ? root.error : {};
  const bareError = typeof root.error === "string" ? root.error : undefined;
  const rawCode = nested.code ?? root.code ?? codeFromBareError(bareError);
  const code = normalizeCode(rawCode, status);
  const rawMessage = nested.message ?? root.message ?? messageFromBareError(bareError);
  const message = publicMessage(rawMessage, status, code);
  const retryable =
    typeof nested.retryable === "boolean"
      ? nested.retryable
      : retryableStatus(status);
  const extras = Object.fromEntries(
    Object.entries(nested).filter(
      ([key]) =>
        !["code", "message", "retryable", "retry_after_seconds"].includes(key)
    )
  );

  return {
    error: {
      ...extras,
      code,
      message,
      retryable,
      ...(retryAfter && retryAfter > 0
        ? { retry_after_seconds: retryAfter }
        : {})
    }
  };
}

export function publicMessage(
  raw: unknown,
  status: number,
  code: string
): string {
  if (code === "LLM_TOKEN_LIMIT_EXCEEDED") {
    const candidate = typeof raw === "string" ? raw.trim() : "";
    return /^Limit Exhausted\. Your Limit will reset at .+\.$/.test(candidate)
      ? candidate
      : "Limit Exhausted. Your Limit will reset after five hours.";
  }
  const known = knownMessages[code];
  if (known) return known;

  if (status === 401) {
    return "Your session has ended. Please sign in again.";
  }

  // Server failures can contain database, provider, or stack details that may
  // look readable but are never useful or reassuring to an end user.
  if (status >= 500) {
    return defaultMessage(status);
  }

  const candidate = typeof raw === "string" ? raw.trim() : "";
  const base = isSafeHumanMessage(candidate)
    ? candidate
    : contextualMessage(code, status);
  return addRecoveryGuidance(base, status);
}

function contextualMessage(code: string, status: number): string {
  if (code.includes("AUTH") || code.includes("SESSION")) {
    return status === 401
      ? "Your session has ended."
      : "We couldn’t complete authentication right now.";
  }
  if (code.includes("CONNECTOR") || code.includes("OAUTH")) {
    return "We couldn’t update that connection right now.";
  }
  if (code.includes("UPLOAD") || code.includes("FILE")) {
    return "We couldn’t use that file.";
  }
  if (code.includes("ARCHIVE")) {
    return "We couldn’t update your Drive archive right now.";
  }
  if (code.includes("MEMORY")) {
    return "We couldn’t update Assistant memory right now.";
  }
  if (code.includes("AGENT")) {
    return "We couldn’t update that agent right now.";
  }
  if (code.includes("MESSAGE")) {
    return "We couldn’t complete that message action right now.";
  }
  return defaultMessage(status);
}

function addRecoveryGuidance(message: string, status: number): string {
  if (
    /\b(?:try again|wait|sign in|reconnect|refresh|choose|select|enter|add|open|connect again)\b/i.test(
      message
    )
  ) {
    return message;
  }

  const trimmed = message.replace(/\s+$/, "").replace(/[.!?]+$/, "");
  if (status === 401) return `${trimmed}. Please sign in again.`;
  if (status === 403) return `${trimmed}. Check your access and try again.`;
  if (status === 404) return `${trimmed}. Refresh and try again.`;
  if (status === 409) return `${trimmed}. Refresh and try again.`;
  if (status === 408 || status === 425 || status === 429 || status >= 500) {
    return `${trimmed}. Please wait a moment and try again.`;
  }
  if (status === 413) {
    return `${trimmed}. Choose something smaller and try again.`;
  }
  if (status === 415) {
    return `${trimmed}. Choose a supported file and try again.`;
  }
  return `${trimmed}. Check the details and try again.`;
}

function defaultMessage(status: number): string {
  if (status === 400 || status === 422) {
    return "We couldn’t use that request. Check the details and try again.";
  }
  if (status === 401) {
    return "Your session has ended. Please sign in again.";
  }
  if (status === 403) {
    return "Cuppet doesn’t currently have access to do that. Check your access and try again.";
  }
  if (status === 404) {
    return "That item is no longer available. Refresh and try again.";
  }
  if (status === 409) {
    return "That changed before the update finished. Refresh and try again.";
  }
  if (status === 413) {
    return "That request is too large. Choose something smaller and try again.";
  }
  if (status === 415) {
    return "That file type isn’t supported. Choose another file and try again.";
  }
  if (status === 429) {
    return "Cuppet is handling a lot right now. Please wait a moment and try again.";
  }
  return "Cuppet couldn’t complete that right now. Please wait a moment and try again.";
}

function isSafeHumanMessage(value: string): boolean {
  if (!value || value.length > 500) return false;
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(value)) return false;
  if (/^(?:Error|Exception|TypeError|StateError|DioException)\b/i.test(value)) {
    return false;
  }
  if (/^(?:Invalid input|Expected |String must|Number must|Required$|Unrecognized key)/i.test(value)) {
    return false;
  }
  if (/\b(?:stack trace|ECONN[A-Z]*|ENOTFOUND|ETIMEDOUT|SQLSTATE|postgres|redis|API key|client secret|jwt expired)\b/i.test(value)) {
    return false;
  }
  if (/^[\[{].*[\]}]$/s.test(value)) return false;
  return true;
}

function retryableStatus(status: number): boolean {
  return [408, 409, 425, 429].includes(status) || status >= 500;
}

function publicStatus(error: unknown): number {
  const status = isRecord(error) && typeof error.statusCode === "number"
    ? error.statusCode
    : 500;
  return status >= 400 && status <= 599 ? status : 500;
}

function errorCodeForStatus(status: number, error: unknown): string {
  if (
    isRecord(error) &&
    error.code === "LLM_TOKEN_LIMIT_EXCEEDED"
  ) {
    return "LLM_TOKEN_LIMIT_EXCEEDED";
  }
  if (
    status === 400 &&
    isRecord(error) &&
    error.code === "FST_ERR_CTP_INVALID_JSON_BODY"
  ) {
    return "INVALID_JSON";
  }
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 429) return "RATE_LIMITED";
  return status >= 500 ? "INTERNAL_ERROR" : `REQUEST_FAILED_${status}`;
}

function normalizeCode(value: unknown, status: number): string {
  if (typeof value === "string") {
    const normalized = value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toUpperCase();
    if (normalized && normalized.length <= 100) return normalized;
  }
  return status >= 500 ? "INTERNAL_ERROR" : `REQUEST_FAILED_${status}`;
}

function codeFromBareError(value: string | undefined): string | undefined {
  return value && /^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(value)
    ? value
    : undefined;
}

function messageFromBareError(value: string | undefined): string | undefined {
  return value && !codeFromBareError(value) ? value : undefined;
}

function parsePayload(payload: unknown): unknown | null {
  if (isRecord(payload)) return payload;
  if (typeof payload !== "string") return null;
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return null;
  }
}

function retryAfterSeconds(reply: FastifyReply): number | undefined {
  const raw = reply.getHeader("retry-after");
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function isMachineEndpoint(url: string): boolean {
  return url.startsWith("/events/") || url === "/health";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

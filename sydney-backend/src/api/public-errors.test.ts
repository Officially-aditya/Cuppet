import assert from "node:assert/strict";
import test from "node:test";
import { normalizePublicError, publicMessage } from "./public-errors.js";

test("normalizes legacy bare errors into the public contract", () => {
  assert.deepEqual(
    normalizePublicError({ error: "Invalid file ID" }, 400),
    {
      error: {
        code: "REQUEST_FAILED_400",
        message: "Invalid file ID. Check the details and try again.",
        retryable: false
      }
    }
  );
});

test("never exposes code-like provider errors as user copy", () => {
  const result = normalizePublicError(
    {
      error: {
        code: "CONNECTOR_OAUTH_FAILED",
        message: "github_token_exchange_failed_500",
        connector_id: "github"
      }
    },
    400
  );

  assert.deepEqual(result, {
    error: {
      connector_id: "github",
      code: "CONNECTOR_OAUTH_FAILED",
      message:
        "We couldn’t finish connecting that service. Please try connecting it again.",
      retryable: false
    }
  });
});

test("adds calm wait guidance and retry metadata to server failures", () => {
  assert.deepEqual(
    normalizePublicError(
      { message: "connect ECONNREFUSED 127.0.0.1:5432" },
      503,
      12
    ),
    {
      error: {
        code: "INTERNAL_ERROR",
        message:
          "Cuppet couldn’t complete that right now. Please wait a moment and try again.",
        retryable: true,
        retry_after_seconds: 12
      }
    }
  );
});

test("never exposes readable-looking server failure details", () => {
  assert.equal(
    publicMessage("Database connection failed for production", 500, "INTERNAL_ERROR"),
    "Cuppet couldn’t complete that right now. Please wait a moment and try again."
  );
});

test("maps session failures to a clear next action", () => {
  assert.equal(
    publicMessage("jwt expired", 401, "INVALID_SESSION"),
    "Your session has ended. Please sign in again."
  );
});

test("replaces schema-library wording with contextual guidance", () => {
  assert.equal(
    publicMessage(
      "String must contain at least 1 character(s)",
      400,
      "INVALID_MESSAGE"
    ),
    "We couldn’t complete that message action right now. Check the details and try again."
  );
});

test("preserves the dynamic LLM token reset message", () => {
  assert.deepEqual(
    normalizePublicError(
      {
        error: {
          code: "LLM_TOKEN_LIMIT_EXCEEDED",
          message:
            "Limit Exhausted. Your Limit will reset at 2026-07-28T12:34:56.000Z.",
          retryable: false,
          reset_at: "2026-07-28T12:34:56.000Z"
        }
      },
      429,
      18000
    ),
    {
      error: {
        reset_at: "2026-07-28T12:34:56.000Z",
        code: "LLM_TOKEN_LIMIT_EXCEEDED",
        message:
          "Limit Exhausted. Your Limit will reset at 2026-07-28T12:34:56.000Z.",
        retryable: false,
        retry_after_seconds: 18000
      }
    }
  );
});

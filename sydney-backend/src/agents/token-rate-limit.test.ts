import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateLlmInputTokens,
  LLM_INPUT_TOKEN_LIMIT,
  LLM_OUTPUT_TOKEN_LIMIT,
  LLM_TOKEN_WINDOW_MS,
  LlmTokenLimitError,
  markLlmTokenLimitError,
  measuredLlmUsage,
  tokenLimitMessage,
  withLlmUser
} from "./token-rate-limit.js";

test("uses the configured five-hour token budgets", () => {
  assert.equal(LLM_INPUT_TOKEN_LIMIT, 20_000);
  assert.equal(LLM_OUTPUT_TOKEN_LIMIT, 5_000);
  assert.equal(LLM_TOKEN_WINDOW_MS, 5 * 60 * 60 * 1000);
});

test("formats the exhausted-limit message with an unambiguous reset time", () => {
  const resetAt = new Date("2026-07-28T12:34:56.000Z");
  assert.equal(
    tokenLimitMessage(resetAt),
    "Limit Exhausted. Your Limit will reset at 2026-07-28T12:34:56.000Z."
  );
});

test("counts provider cache input as input bandwidth", () => {
  assert.deepEqual(
    measuredLlmUsage({
      input_tokens: 120,
      cache_creation_input_tokens: 30,
      cache_read_input_tokens: 50,
      output_tokens: 42
    }),
    { inputTokens: 200, outputTokens: 42 }
  );
});

test("estimates text and multimodal prompts before reserving a request", () => {
  assert.ok(
    estimateLlmInputTokens({
      system: "You are Cuppet.",
      messages: [
        { role: "user", content: "Please summarize this." },
        {
          role: "assistant",
          content: [
            { type: "text", text: "Here is the context." },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: "image-data"
              }
            }
          ]
        }
      ]
    }) >= 1
  );
});

test("does not let an internal fallback swallow an exhausted-limit error", async () => {
  const error = new LlmTokenLimitError(
    new Date("2026-07-28T12:34:56.000Z"),
    new Date("2026-07-28T07:34:56.000Z")
  );

  await assert.rejects(
    withLlmUser("user-1", async () => {
      try {
        throw error;
      } catch (caught) {
        markLlmTokenLimitError(caught);
        return "fallback";
      }
    }),
    (caught) => caught === error
  );
});

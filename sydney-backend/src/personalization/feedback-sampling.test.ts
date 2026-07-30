import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isDeterministicPeriodicSample,
  shouldRequestFeedback,
  type FeedbackSamplingInput
} from "./feedback-sampling.js";

describe("Feedback Sampling Logic", () => {
  it("never requests feedback for non-substantive results", async () => {
    const baseInput: FeedbackSamplingInput = {
      userId: "user-1",
      agentId: "agent-1",
      messageId: "msg-1",
      resultType: "all_clear",
      isFirstSuccessfulResult: true,
      agentRecentlyChanged: false
    };

    const resultAllClear = await shouldRequestFeedback(baseInput);
    assert.equal(resultAllClear.requestFeedback, false);

    const resultError = await shouldRequestFeedback({
      ...baseInput,
      resultType: "error"
    });
    assert.equal(resultError.requestFeedback, false);

    const resultPartial = await shouldRequestFeedback({
      ...baseInput,
      resultType: "partial"
    });
    assert.equal(resultPartial.requestFeedback, false);

    const resultSystem = await shouldRequestFeedback({
      ...baseInput,
      resultType: "system"
    });
    assert.equal(resultSystem.requestFeedback, false);
  });

  it("calculates deterministic periodic sample hashes consistently across devices", () => {
    const hash1 = isDeterministicPeriodicSample("agent-123", "msg-456", 6);
    const hash2 = isDeterministicPeriodicSample("agent-123", "msg-456", 6);
    assert.equal(hash1, hash2);

    // Hash should be boolean
    assert.equal(typeof hash1, "boolean");
  });
});

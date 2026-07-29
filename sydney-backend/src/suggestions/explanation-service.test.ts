import assert from "node:assert/strict";
import test from "node:test";
import { suggestionExplanation } from "./explanation-service.js";

test("suggestion explanations identify used and unused data categories", () => {
  const explanation = suggestionExplanation({
    evidence_summary: { profile_weight: 0.8, dimension: "topic" },
    consent_purposes: ["explicit_feedback"],
    reason_codes: ["stable_interest"]
  });

  assert.deepEqual(explanation.data_categories, ["Direct feedback you gave Cuppet"]);
  assert.equal(
    explanation.data_categories_not_used.includes("Browser activity"),
    true
  );
  assert.deepEqual(explanation.signals, ["stable interest"]);
});

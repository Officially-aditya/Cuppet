import assert from "node:assert/strict";
import test from "node:test";
import {
  cooldownDaysForDecision,
  evaluateSuggestionPolicy,
  suggestionCooldownDays,
  suggestionThresholds
} from "./policy.js";

const base = {
  score: 0.82,
  confidence: 0.84,
  frequency: "balanced" as const,
  hasConsent: true,
  deliveredThisWeek: 0,
  deliveredForSubjectRecently: false,
  dismissedForSubjectRecently: false,
  hasUnresolvedSuggestion: false
};

test("suggestion policy requires consent", () => {
  const result = evaluateSuggestionPolicy({ ...base, hasConsent: false });
  assert.equal(result.eligible, false);
  assert.equal(result.suppressionReason, "no_consent");
});

test("suggestion policy caps weekly delivery", () => {
  const result = evaluateSuggestionPolicy({ ...base, deliveredThisWeek: 2 });
  assert.equal(result.eligible, false);
  assert.equal(result.suppressionReason, "frequency_cap");
});

test("suggestion policy suppresses low confidence and duplicates", () => {
  const lowConfidence = evaluateSuggestionPolicy({ ...base, confidence: 0.5 });
  assert.equal(lowConfidence.suppressionReason, "low_confidence");

  const duplicate = evaluateSuggestionPolicy({
    ...base,
    deliveredForSubjectRecently: true
  });
  assert.equal(duplicate.suppressionReason, "duplicate");
});

test("policy supports stricter thresholds for proactive surfaces", () => {
  const decision = evaluateSuggestionPolicy({
    ...base,
    score: 0.88,
    confidence: 0.95,
    minimumScore: 0.94
  });

  assert.equal(decision.eligible, false);
  assert.equal(decision.suppressionReason, "low_confidence");
});

test("suggestion decisions have distinct cooldown windows", () => {
  assert.equal(cooldownDaysForDecision("not_now"), 7);
  assert.equal(cooldownDaysForDecision("dismissed"), 30);
  assert.deepEqual(suggestionCooldownDays, { not_now: 7, dismissed: 30 });
});

test("delivery thresholds are explicit and ordered by interruption cost", () => {
  assert.deepEqual(suggestionThresholds, {
    contextual: 0.7,
    deferred: 0.8,
    proactive: 0.87,
    push: 0.94
  });
});

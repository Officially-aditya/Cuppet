import assert from "node:assert/strict";
import test from "node:test";
import { scoreSuggestion } from "./ranker.js";

test("ranker returns an inspectable bounded score breakdown", () => {
  const score = scoreSuggestion({
    candidate: {
      relevance_score: 0.9,
      confidence_score: 0.8,
      interruption_cost: 0.1
    },
    hasExplicitMatch: true
  });

  assert.equal(score.explicitPreferenceMatch, 0.2);
  assert.ok(score.finalScore >= 0 && score.finalScore <= 1);
  assert.ok(Number.isFinite(score.finalScore));
});

test("semantic matching remains explicit in the score breakdown", () => {
  const withoutSemantic = scoreSuggestion({
    candidate: {
      relevance_score: 0.7,
      confidence_score: 0.8,
      interruption_cost: 0
    }
  });
  const withSemantic = scoreSuggestion({
    candidate: {
      relevance_score: 0.7,
      confidence_score: 0.8,
      interruption_cost: 0
    },
    semanticInterestMatch: 0.8
  });

  assert.equal(withoutSemantic.semanticInterestMatch, 0);
  assert.equal(withSemantic.semanticInterestMatch, 0.12);
  assert.ok(withSemantic.finalScore > withoutSemantic.finalScore);
});

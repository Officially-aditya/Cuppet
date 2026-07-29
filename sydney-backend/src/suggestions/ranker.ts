import type { SuggestionCandidateRow, SuggestionScoreBreakdown } from "./types.js";

export function scoreSuggestion(input: {
  candidate: Pick<
    SuggestionCandidateRow,
    "relevance_score" | "confidence_score" | "interruption_cost"
  >;
  hasExplicitMatch?: boolean;
  semanticInterestMatch?: number;
  conversationRelevance?: number;
  novelty?: number;
  repetitionPenalty?: number;
  dismissalPenalty?: number;
  privacyPenalty?: number;
}): SuggestionScoreBreakdown {
  const relevance = clamp(Number(input.candidate.relevance_score));
  const confidence = clamp(Number(input.candidate.confidence_score));
  const explicitPreferenceMatch = input.hasExplicitMatch ? 0.2 : 0;
  const semanticInterestMatch = clamp(input.semanticInterestMatch ?? 0) * 0.15;
  const conversationRelevance = clamp(input.conversationRelevance ?? relevance) * 0.2;
  const behavioralMatch = confidence * 0.2;
  const expectedUtility = relevance * 0.2;
  const novelty = clamp(input.novelty ?? 1) * 0.1;
  const repetitionPenalty = clamp(input.repetitionPenalty ?? 0) * 0.15;
  const dismissalPenalty = clamp(input.dismissalPenalty ?? 0) * 0.15;
  const interruptionCost = clamp(Number(input.candidate.interruption_cost)) * 0.1;
  const privacyPenalty = clamp(input.privacyPenalty ?? 0) * 0.2;
  const finalScore = clamp(
    explicitPreferenceMatch +
      semanticInterestMatch +
      conversationRelevance +
      behavioralMatch +
      expectedUtility +
      novelty -
      repetitionPenalty -
      dismissalPenalty -
      interruptionCost -
      privacyPenalty
  );

  return {
    explicitPreferenceMatch,
    semanticInterestMatch,
    conversationRelevance,
    behavioralMatch,
    expectedUtility,
    novelty,
    repetitionPenalty,
    dismissalPenalty,
    interruptionCost,
    privacyPenalty,
    finalScore
  };
}

export function rankCandidates(
  candidates: SuggestionCandidateRow[],
  scoreFor: (candidate: SuggestionCandidateRow) => SuggestionScoreBreakdown = (candidate) =>
    scoreSuggestion({ candidate })
): Array<{ candidate: SuggestionCandidateRow; score: SuggestionScoreBreakdown }> {
  return candidates
    .map((candidate) => ({ candidate, score: scoreFor(candidate) }))
    .sort((left, right) => right.score.finalScore - left.score.finalScore);
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

import type { PersonalizationFrequency } from "../personalization/types.js";

export const suggestionCooldownDays = {
  not_now: 7,
  dismissed: 30
} as const;

export const suggestionThresholds = {
  contextual: 0.7,
  deferred: 0.8,
  proactive: 0.87,
  push: 0.94
} as const;

export function cooldownDaysForDecision(decision: "not_now" | "dismissed"): number {
  return suggestionCooldownDays[decision];
}

export type SuggestionPolicyDecision = {
  eligible: boolean;
  score: number;
  suppressionReason?:
    | "no_consent"
    | "low_confidence"
    | "frequency_cap"
    | "recent_dismissal"
    | "duplicate"
    | "privacy_boundary"
    | "unsafe_action"
    | "poor_timing";
};

export function evaluateSuggestionPolicy(input: {
  score: number;
  confidence: number;
  frequency: PersonalizationFrequency;
  hasConsent: boolean;
  deliveredThisWeek: number;
  deliveredForSubjectRecently: boolean;
  dismissedForSubjectRecently: boolean;
  hasUnresolvedSuggestion: boolean;
  unsafeAction?: boolean;
  poorTiming?: boolean;
  minimumScore?: number;
}): SuggestionPolicyDecision {
  const score = Number.isFinite(input.score) ? input.score : 0;
  if (!input.hasConsent) return { eligible: false, score, suppressionReason: "no_consent" };
  if (input.unsafeAction) return { eligible: false, score, suppressionReason: "unsafe_action" };
  if (input.poorTiming) return { eligible: false, score, suppressionReason: "poor_timing" };
   if (input.confidence < 0.7 || score < (input.minimumScore ?? suggestionThresholds.contextual)) {
    return { eligible: false, score, suppressionReason: "low_confidence" };
  }
  const cap = input.frequency === "low" ? 1 : 2;
  if (input.deliveredThisWeek >= cap) {
    return { eligible: false, score, suppressionReason: "frequency_cap" };
  }
  if (input.hasUnresolvedSuggestion || input.deliveredForSubjectRecently) {
    return { eligible: false, score, suppressionReason: "duplicate" };
  }
  if (input.dismissedForSubjectRecently) {
    return { eligible: false, score, suppressionReason: "recent_dismissal" };
  }
  return { eligible: true, score };
}

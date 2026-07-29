import type { PersonalizationPurpose } from "../personalization/types.js";

export const suggestionTypes = [
  "agent_creation",
  "agent_refinement",
  "capability_connection",
  "content",
  "attention_reduction"
] as const;

export type SuggestionType = (typeof suggestionTypes)[number];

export const suggestionOrigins = [
  "user_pattern",
  "current_context",
  "agent_improvement",
  "capability_gap",
  "user_interest"
] as const;

export type SuggestionOrigin = (typeof suggestionOrigins)[number];

export type SuggestionDecision =
  | "accept"
  | "not_now"
  | "dismiss"
  | "less_like_this"
  | "explain";

export type SuggestionScoreBreakdown = {
  explicitPreferenceMatch: number;
  semanticInterestMatch: number;
  conversationRelevance: number;
  behavioralMatch: number;
  expectedUtility: number;
  novelty: number;
  repetitionPenalty: number;
  dismissalPenalty: number;
  interruptionCost: number;
  privacyPenalty: number;
  finalScore: number;
};

export type SuggestionCandidateRow = {
  id: string;
  user_id: string;
  suggestion_type: SuggestionType;
  generator_key: string;
  origin: SuggestionOrigin;
  subject_type: string;
  subject_key: string;
  title: string;
  body: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  reason_codes: string[];
  evidence_summary: Record<string, unknown>;
  score_breakdown: SuggestionScoreBreakdown | Record<string, unknown>;
  relevance_score: number | string;
  confidence_score: number | string;
  interruption_cost: number | string;
  consent_purposes: PersonalizationPurpose[];
  eligible_after: Date | string;
  expires_at: Date | string;
  status: string;
  created_at: Date | string;
};

export type SuggestionRow = {
  id: string;
  candidate_id: string;
  user_id: string;
  message_id: string | null;
  suggestion_type: SuggestionType;
  action_type: string;
  action_payload: Record<string, unknown>;
  status: "delivered" | "accepted" | "not_now" | "dismissed" | "expired" | "failed";
  delivered_at: Date | string;
  decided_at: Date | string | null;
  expires_at: Date | string;
  push_sent_at?: Date | string | null;
  continuation_started_at?: Date | string | null;
  continuation_message_id?: string | null;
  delivery_surface?: "in_chat" | "proactive" | "push";
};

export type SuggestionExclusionRow = {
  id: string;
  user_id: string;
  subject_type: string;
  subject_key: string;
  source_suggestion_id: string | null;
  created_at: Date | string;
};

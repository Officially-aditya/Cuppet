import type { SuggestionCandidateRow } from "./types.js";

export function suggestionExplanation(candidate: Pick<
  SuggestionCandidateRow,
  "evidence_summary" | "consent_purposes" | "reason_codes"
>): {
  summary: string;
  data_categories: string[];
  data_categories_not_used: string[];
  signals: string[];
} {
  const count = Number(candidate.evidence_summary.request_count ?? 0);
  const feedbackCount = Number(candidate.evidence_summary.feedback_count ?? 0);
  const agentName = candidate.evidence_summary.agent_name?.toString();
  const connectorName = candidate.evidence_summary.connector_name?.toString();
  const profileWeight = Number(candidate.evidence_summary.profile_weight ?? 0);
  const summary =
    connectorName
      ? `${connectorName} was needed for your current Assistant request.`
      : profileWeight > 0
        ? `Your profile shows a sustained interest in ${candidate.evidence_summary.dimension ?? "this area"}.`
        : feedbackCount > 1
      ? `${agentName ?? "An agent"} received ${feedbackCount} unhelpful-result signals recently.`
      : count > 1
        ? `You made a similar request ${count} times recently.`
        : "This suggestion matched a recent Assistant interaction.";
  const dataCategories = candidate.consent_purposes.map(dataCategoryForPurpose);
  const allDataCategories = [
    "Direct feedback you gave Cuppet",
    "Activity inside Cuppet",
    "Connected account patterns",
    "Browser activity",
    "Combined authorized sources"
  ];
  return {
    summary,
    data_categories: dataCategories,
    data_categories_not_used: allDataCategories.filter(
      (category) => !dataCategories.includes(category)
    ),
    signals: candidate.reason_codes.map((code) => code.replace(/_/g, " "))
  };
}

function dataCategoryForPurpose(purpose: string): string {
  switch (purpose) {
    case "explicit_feedback":
      return "Direct feedback you gave Cuppet";
    case "cuppet_activity":
      return "Activity inside Cuppet";
    case "connected_content":
      return "Connected account patterns";
    case "browser_activity":
      return "Browser activity";
    case "cross_source":
      return "Combined authorized sources";
    default:
      return "Cuppet activity";
  }
}

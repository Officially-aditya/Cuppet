export type AgentSourceOutcomeStatus =
  | "completed"
  | "partial"
  | "access_required"
  | "failed";

export type AgentSourceOutcome<T = unknown> =
  | {
      status: "completed";
      checkedCount: number;
      relevantCount: number;
      items: T[];
    }
  | {
      status: "partial";
      checkedCount: number;
      relevantCount: number;
      unavailableCount: number;
      items: T[];
    }
  | {
      status: "access_required";
      provider: string;
      code?: UserFacingErrorCode;
    }
  | {
      status: "failed";
      code: UserFacingErrorCode | string;
      retryable: boolean;
      message?: string;
    };

export type UserFacingErrorCode =
  | "ACCESS_REQUIRED"
  | "ACCESS_RECONNECT_REQUIRED"
  | "PERMISSION_MISSING"
  | "SOURCE_NOT_SHARED"
  | "TEMPORARILY_UNAVAILABLE"
  | "PARTIAL_RESULT"
  | "UNKNOWN";

export type OutcomeStateReason =
  | "no_relevant_items"
  | "empty_source"
  | "partial_results"
  | "access_required"
  | "failed";

export interface OutcomeCopyDefinition {
  no_relevant_items: string;
  empty_source?: string;
  partial_results?: string;
  access_required?: string;
  failed?: string;
}

export const DEFAULT_OUTCOME_COPY_REGISTRY: Record<string, OutcomeCopyDefinition> = {
  inbox_attention: {
    no_relevant_items: "Nothing in your inbox needs your attention right now.",
    empty_source: "There are no new emails to review.",
    partial_results: "Reviewed available inbox messages. Some emails could not be checked.",
    access_required: "Reconnect Gmail so this agent can continue.",
    failed: "I couldn’t check your inbox right now. I’ll try again on the next run."
  },

  email_followup_watcher: {
    no_relevant_items: "No messages are waiting for your reply.",
    empty_source: "No sent emails require follow-up.",
    partial_results: "Checked available email threads. Some messages couldn't be scanned.",
    access_required: "Reconnect Gmail so this agent can monitor follow-ups.",
    failed: "I couldn’t check for email follow-ups right now. I’ll try again on the next run."
  },

  github_ci_watch: {
    no_relevant_items: "No workflow failures need your attention.",
    empty_source: "No active GitHub repositories or workflows found.",
    partial_results: "Checked available repositories. Some workflow updates were unavailable.",
    access_required: "Connect your GitHub account so this agent can check CI builds.",
    failed: "I couldn’t check GitHub workflow status right now. I’ll try again on the next run."
  },

  github_digest: {
    no_relevant_items: "No repository updates or pull requests need your review right now.",
    empty_source: "No repositories were found in your connected GitHub account.",
    partial_results: "Checked available repositories. Some updates couldn't be loaded.",
    access_required: "Connect your GitHub account so this agent can load repository updates.",
    failed: "I couldn’t check GitHub updates right now. I’ll try again on the next run."
  },

  google_drive_watch: {
    no_relevant_items: "No recent document edits or shared files need your review.",
    empty_source: "No Google Drive files were found in your workspace.",
    partial_results: "Checked available files. Some document details were unavailable.",
    access_required: "Connect Google Drive so this agent can monitor document changes.",
    failed: "I couldn’t check Google Drive right now. I’ll try again on the next run."
  },

  slack_attention: {
    no_relevant_items: "No unread Slack mentions or messages need your attention.",
    empty_source: "No new Slack channels or messages found.",
    partial_results: "Checked available Slack channels. Some messages couldn't be fetched.",
    access_required: "Connect Slack so this agent can monitor team communications.",
    failed: "I couldn’t check Slack messages right now. I’ll try again on the next run."
  },

  notion_digest: {
    no_relevant_items: "No updated Notion pages or database items require review.",
    empty_source: "No shared Notion workspace pages found.",
    partial_results: "Checked available Notion pages. Some updates couldn't be loaded.",
    access_required: "Connect Notion so this agent can monitor workspace updates.",
    failed: "I couldn’t check Notion pages right now. I’ll try again on the next run."
  },

  default_connector: {
    no_relevant_items: "Everything is up to date and no items need your attention right now.",
    empty_source: "No source data found for this agent.",
    partial_results: "Checked available items, but some sources were temporarily unavailable.",
    access_required: "Reconnect your connected integration so this agent can continue.",
    failed: "I couldn’t complete this check right now. I’ll try again on the next run."
  }
};

export function resolveOutcomeCopy(
  intentOrRecipeId: string,
  state: OutcomeStateReason,
  overrideCopy?: Partial<OutcomeCopyDefinition>
): string {
  const registryEntry = DEFAULT_OUTCOME_COPY_REGISTRY[intentOrRecipeId] ?? DEFAULT_OUTCOME_COPY_REGISTRY.default_connector!;
  
  if (overrideCopy?.[state]) {
    return overrideCopy[state]!;
  }
  
  if (registryEntry[state]) {
    return registryEntry[state]!;
  }

  // Fallbacks if specific state not set
  if (state === "empty_source" && registryEntry.no_relevant_items) {
    return registryEntry.no_relevant_items;
  }
  
  return DEFAULT_OUTCOME_COPY_REGISTRY.default_connector![state] ?? "Everything is up to date.";
}

export function formatOutcomeErrorCodeMessage(code: UserFacingErrorCode, provider?: string): string {
  const provName = provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : "the integration";
  switch (code) {
    case "ACCESS_REQUIRED":
    case "ACCESS_RECONNECT_REQUIRED":
      return `Reconnect ${provName} so this agent can continue.`;
    case "PERMISSION_MISSING":
      return `Additional permissions are needed for ${provName} to complete this request.`;
    case "SOURCE_NOT_SHARED":
      return `No shared files or repositories were found for ${provName}.`;
    case "TEMPORARILY_UNAVAILABLE":
      return `I couldn’t reach ${provName} right now. I’ll try again on the next run.`;
    case "PARTIAL_RESULT":
      return `Some updates from ${provName} were temporarily unavailable.`;
    case "UNKNOWN":
    default:
      return `I couldn’t check ${provName} right now. I’ll try again on the next run.`;
  }
}

export const TECHNICAL_BOILERPLATE_PATTERNS = [
  /no matching/i,
  /for this run/i,
  /not wired/i,
  /connector token/i,
  /source:\s*gmail/i,
  /source:\s*google/i,
  /source:\s*github/i,
  /no content was invented/i,
  /no notable updates found/i,
  /fake data/i,
];

export function isTechnicalBoilerplate(text: string): boolean {
  return TECHNICAL_BOILERPLATE_PATTERNS.some((pattern) => pattern.test(text));
}

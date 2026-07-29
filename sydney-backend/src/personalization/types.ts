export const personalizationPurposes = [
  "explicit_feedback",
  "cuppet_activity",
  "connected_content",
  "browser_activity",
  "cross_source"
] as const;

export type PersonalizationPurpose = (typeof personalizationPurposes)[number];

export const preferenceDimensions = [
  "topic",
  "source",
  "format",
  "timing",
  "agent_type",
  "capability",
  "notification_policy",
  "exclusion"
] as const;

export type PreferenceDimension = (typeof preferenceDimensions)[number];

export type PersonalizationFrequency = "low" | "balanced" | "high";

export type PersonalizationSettings = {
  enabled: boolean;
  learning_paused: boolean;
  frequency: PersonalizationFrequency;
  in_chat: boolean;
  proactive: boolean;
  push: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
};

export type PersonalizationConsent = {
  id: string;
  purpose: PersonalizationPurpose;
  status: "granted" | "revoked";
  policy_version: string;
  granted_at: Date | string | null;
  revoked_at: Date | string | null;
  source: string;
  created_at: Date | string;
};

export type PersonalizationConsentContext = {
  userId: string;
  consentId: string;
  purpose: PersonalizationPurpose;
  policyVersion: string;
};

export type PreferenceProfileItem = {
  id: string;
  user_id?: string;
  dimension: PreferenceDimension;
  key: string;
  weight: number | string;
  confidence: number | string;
  evidence_count: number;
  strongest_evidence_type: string;
  derived_from: string[];
  first_observed_at: Date | string;
  last_observed_at: Date | string;
  expires_at: Date | string | null;
  metadata: Record<string, unknown>;
  updated_at: Date | string;
};

export type PreferenceEventInput = {
  userId: string;
  purpose: PersonalizationPurpose;
  eventType: string;
  subjectType: PreferenceDimension;
  subjectKey: string;
  polarity: -1 | 0 | 1;
  strength: number;
  provenanceType: string;
  provenanceId?: string;
  serviceKey?: string;
  agentId?: string;
  messageId?: string;
  properties?: Record<string, unknown>;
  occurredAt?: Date;
  expiresAt?: Date;
};

export type PreferenceEventWriteResult =
  | { stored: true; eventId: string; outboxId: string }
  | { stored: false; reason: "no_consent" | "paused" };

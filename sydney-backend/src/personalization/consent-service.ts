import { pool } from "../db/index.js";
import {
  personalizationPurposes,
  type PersonalizationConsent,
  type PersonalizationFrequency,
  type PersonalizationPurpose,
  type PersonalizationSettings
} from "./types.js";

export const personalizationPolicyVersion = "2026-07-29.v1";

const defaultSettings: PersonalizationSettings = {
  enabled: false,
  learning_paused: false,
  frequency: "balanced",
  in_chat: true,
  proactive: false,
  push: false,
  quiet_hours_start: "21:00:00",
  quiet_hours_end: "08:00:00"
};

export async function getPersonalizationSettings(
  userId: string
): Promise<PersonalizationSettings> {
  const { rows } = await pool.query<PersonalizationSettings>(
    `SELECT enabled, learning_paused, frequency, in_chat, proactive, push,
            quiet_hours_start, quiet_hours_end
     FROM personalization_settings WHERE user_id = $1`,
    [userId]
  );
  return rows[0] ?? { ...defaultSettings };
}

export async function updatePersonalizationSettings(
  userId: string,
  input: Partial<PersonalizationSettings>
): Promise<PersonalizationSettings> {
  const current = await getPersonalizationSettings(userId);
  const proactive = input.proactive ?? current.proactive;
  const next = {
    ...current,
    ...input,
    proactive,
    push: proactive && (input.push ?? current.push)
  } satisfies PersonalizationSettings;
  const { rows } = await pool.query<PersonalizationSettings>(
    `INSERT INTO personalization_settings
       (user_id, enabled, learning_paused, frequency, in_chat, proactive, push,
        quiet_hours_start, quiet_hours_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       learning_paused = EXCLUDED.learning_paused,
       frequency = EXCLUDED.frequency,
       in_chat = EXCLUDED.in_chat,
       proactive = EXCLUDED.proactive,
       push = EXCLUDED.push,
       quiet_hours_start = EXCLUDED.quiet_hours_start,
       quiet_hours_end = EXCLUDED.quiet_hours_end
     RETURNING enabled, learning_paused, frequency, in_chat, proactive, push,
               quiet_hours_start, quiet_hours_end`,
    [
      userId,
      next.enabled,
      next.learning_paused,
      next.frequency,
      next.in_chat,
      next.proactive,
      next.push,
      next.quiet_hours_start,
      next.quiet_hours_end
    ]
  );
  return rows[0] ?? next;
}

export async function listLatestConsents(
  userId: string
): Promise<PersonalizationConsent[]> {
  const { rows } = await pool.query<PersonalizationConsent>(
    `SELECT DISTINCT ON (purpose)
       id, purpose, status, policy_version, granted_at, revoked_at, source, created_at
     FROM personalization_consents
     WHERE user_id = $1
     ORDER BY purpose, created_at DESC`,
    [userId]
  );
  return rows.sort(
    (left, right) =>
      personalizationPurposes.indexOf(left.purpose) -
      personalizationPurposes.indexOf(right.purpose)
  );
}

export async function listConsentHistory(
  userId: string
): Promise<PersonalizationConsent[]> {
  const { rows } = await pool.query<PersonalizationConsent>(
    `SELECT id, purpose, status, policy_version, granted_at, revoked_at, source, created_at
     FROM personalization_consents
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function getActiveConsent(
  userId: string,
  purpose: PersonalizationPurpose
): Promise<PersonalizationConsent | null> {
  const { rows } = await pool.query<PersonalizationConsent>(
    `SELECT id, purpose, status, policy_version, granted_at, revoked_at, source, created_at
     FROM personalization_consents
     WHERE user_id = $1 AND purpose = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, purpose]
  );
  const consent = rows[0];
  return consent?.status === "granted" ? consent : null;
}

export async function setConsent(input: {
  userId: string;
  purpose: PersonalizationPurpose;
  granted: boolean;
  source: string;
}): Promise<PersonalizationConsent> {
  const { rows } = await pool.query<PersonalizationConsent>(
    `INSERT INTO personalization_consents
       (user_id, purpose, status, policy_version, granted_at, revoked_at, source)
     VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'granted' THEN NOW() END,
             CASE WHEN $3 = 'revoked' THEN NOW() END, $5)
     RETURNING id, purpose, status, policy_version, granted_at, revoked_at, source, created_at`,
    [
      input.userId,
      input.purpose,
      input.granted ? "granted" : "revoked",
      personalizationPolicyVersion,
      input.source.slice(0, 80)
    ]
  );
  return rows[0]!;
}

export function isPersonalizationPurpose(value: unknown): value is PersonalizationPurpose {
  return typeof value === "string" && (personalizationPurposes as readonly string[]).includes(value);
}

export function isPersonalizationFrequency(value: unknown): value is PersonalizationFrequency {
  return value === "low" || value === "balanced" || value === "high";
}

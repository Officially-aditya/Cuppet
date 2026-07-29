import { pool } from "../db/index.js";
import { rebuildPreferenceProfile } from "./profile-builder.js";

export async function cleanPersonalizationRetention(): Promise<{
  events: number;
  suggestions: number;
  candidates: number;
  productEvents: number;
  outbox: number;
  profileItems: number;
}> {
  const affected = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT user_id
     FROM preference_events
     WHERE created_at < NOW() - INTERVAL '90 days'
       AND provenance_type <> 'confirmed_memory'
       AND NOT (polarity = -1 AND provenance_type IN (
         'assistant_feedback', 'user_instruction', 'suggestion_decision'
       ))`
  );
  const events = await pool.query(
    `DELETE FROM preference_events
     WHERE created_at < NOW() - INTERVAL '90 days'
       AND provenance_type <> 'confirmed_memory'
       AND NOT (polarity = -1 AND provenance_type IN (
         'assistant_feedback', 'user_instruction', 'suggestion_decision'
       ))`
  );
  const suggestions = await pool.query(
    `DELETE FROM suggestions
     WHERE delivered_at < NOW() - INTERVAL '180 days'`
  );
  const candidates = await pool.query(
    `DELETE FROM suggestion_candidates
     WHERE created_at < NOW() - INTERVAL '180 days'`
  );
  const productEvents = await pool.query(
    `DELETE FROM personalization_product_events
      WHERE created_at < NOW() - INTERVAL '180 days'`
  );
  const outbox = await pool.query(
    `DELETE FROM personalization_outbox
     WHERE status IN ('completed', 'failed')
       AND created_at < NOW() - INTERVAL '30 days'`
  );
  const expiredProfileUsers = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT user_id
     FROM preference_profile_items
     WHERE expires_at IS NOT NULL AND expires_at <= NOW()`
  );
  const profileItems = await pool.query(
    `DELETE FROM preference_profile_items
     WHERE expires_at IS NOT NULL AND expires_at <= NOW()`
  );
  await Promise.all(affected.rows.map((row) => rebuildPreferenceProfile(row.user_id)));
  await Promise.all(expiredProfileUsers.rows.map((row) => rebuildPreferenceProfile(row.user_id)));
  return {
    events: events.rowCount ?? 0,
    suggestions: suggestions.rowCount ?? 0,
    candidates: candidates.rowCount ?? 0,
    productEvents: productEvents.rowCount ?? 0,
    outbox: outbox.rowCount ?? 0,
    profileItems: profileItems.rowCount ?? 0
  };
}

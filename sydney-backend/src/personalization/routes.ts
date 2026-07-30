import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { isUuid } from "../api/ids.js";
import { requireAuth } from "../auth/middleware.js";
import { pool } from "../db/index.js";
import {
  getActiveConsent,
  getPersonalizationSettings,
  isPersonalizationPurpose,
  listConsentHistory,
  listLatestConsents,
  setConsent,
  updatePersonalizationSettings
} from "./consent-service.js";
import {
  deletePersonalizationData,
  deletePreferenceProfileItem,
  listPreferenceProfile,
  rebuildPreferenceProfile,
  updatePreferenceProfileItem
} from "./profile-builder.js";
import {
  recordPreferenceEvent,
  removePreferenceEventsByProvenance,
  removePreferenceEventsByPurpose
} from "./event-writer.js";
import { isSafeSubjectKey, normalizeSubjectKey } from "./subject-safety.js";
import { preferenceDimensions, personalizationPurposes } from "./types.js";
import {
  browserPreferenceEventSchema,
  recordBrowserPreferenceEvent
} from "./browser-events.js";
import {
  createBrowserConnection,
  hasBrowserConnection,
  revokeBrowserConnection,
  userIdForBrowserToken
} from "./browser-connections.js";
import { activityEventTypes, recordCuppetActivitySignal } from "./activity-events.js";
import { recordPersonalizationProductEvent } from "./analytics.js";
import { createSuggestionExclusion } from "../suggestions/repository.js";

const settingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    learning_paused: z.boolean().optional(),
    frequency: z.enum(["low", "balanced", "high"]).optional(),
    in_chat: z.boolean().optional(),
    proactive: z.boolean().optional(),
    push: z.boolean().optional(),
    quiet_hours_start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
    quiet_hours_end: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional()
  })
  .strict();

const consentSchema = z
  .object({
    purpose: z.enum(personalizationPurposes),
    source: z.string().trim().min(1).max(80).default("settings")
  })
  .strict();

const profilePatchSchema = z
  .object({
    weight: z.number().min(-1).max(1).optional(),
    key: z.string().trim().min(1).max(180).optional()
  })
  .strict()
  .refine((value) => value.weight !== undefined || value.key !== undefined, {
    message: "A profile weight or key is required."
  });

const feedbackSchema = z
  .object({
    feedback_type: z.enum([
      "useful",
      "not_useful",
      "more_like_this",
      "less_like_this",
      "too_noisy",
      "wrong_priority",
      "wrong_format",
      "not_relevant",
      "not_interested_topic",
      "not_interested_source"
    ]),
    subject_type: z.enum(preferenceDimensions).optional(),
    subject_key: z.string().trim().min(1).max(180).optional()
  })
  .strict();

const activitySchema = z
  .object({
    activity_type: z.enum(activityEventTypes),
    subject_type: z.enum(preferenceDimensions).default("agent_type"),
    subject_key: z.string().trim().min(1).max(180)
  })
  .strict();

const exclusionSchema = z
  .object({
    subject_type: z.enum([
      "topic",
      "source",
      "format",
      "timing",
      "agent_type",
      "capability",
      "notification_policy"
    ]),
    subject_key: z.string().trim().min(1).max(120)
  })
  .strict();

export async function personalizationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/users/me/personalization", { preHandler: requireAuth }, async (request) => {
    const userId = request.auth!.userId;
    const [settings, consents, profile, browserConnected, recentSuggestions, feedback] = await Promise.all([
      getPersonalizationSettings(userId),
      listLatestConsents(userId),
      listPreferenceProfile(userId),
      hasBrowserConnection(userId),
      pool.query(
        `SELECT s.id, s.suggestion_type, s.status, s.delivered_at, s.decided_at,
                c.title, c.body
         FROM suggestions s
         JOIN suggestion_candidates c ON c.id = s.candidate_id
         WHERE s.user_id = $1
         ORDER BY s.delivered_at DESC
         LIMIT 20`,
        [userId]
      ),
      pool.query(
        `SELECT message_id, feedback_type FROM message_feedback WHERE user_id = $1`,
        [userId]
      )
    ]);
    return {
      settings,
      consents,
      browser_connected: browserConnected,
      recent_suggestions: recentSuggestions.rows,
      feedback: feedback.rows,
      profile_count: profile.length
    };
  });

  app.post(
    "/users/me/personalization/browser-connection",
    { preHandler: requireAuth },
    async (request, reply) => {
      const connection = await createBrowserConnection(request.auth!.userId);
      return reply.code(201).send({ connection });
    }
  );

  app.delete(
    "/users/me/personalization/browser-connection",
    { preHandler: requireAuth },
    async (request) => ({
      revoked: await revokeBrowserConnection(request.auth!.userId)
    })
  );

  app.post(
    "/users/me/personalization/browser-events",
    async (request, reply) => {
      const header = request.headers["x-cuppet-browser-token"];
      const token = Array.isArray(header) ? header[0] : header;
      const userId = token ? await userIdForBrowserToken(token) : null;
      if (!userId) {
        return reply.code(401).send({
          error: {
            code: "INVALID_BROWSER_CONNECTION",
            message: "Connect an approved browser integration before sending activity."
          }
        });
      }
      const parsed = browserPreferenceEventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_BROWSER_EVENT",
            message: parsed.error.issues[0]?.message ?? "Invalid browser activity event."
          }
        });
      }
      return recordBrowserPreferenceEvent(userId, parsed.data);
    }
  );

  app.patch("/users/me/personalization", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "INVALID_PERSONALIZATION_SETTINGS", message: parsed.error.issues[0]?.message }
      });
    }
    const currentSettings = await getPersonalizationSettings(request.auth!.userId);
    const nextProactive = parsed.data.proactive ?? currentSettings.proactive;
    if (parsed.data.push === true && !nextProactive) {
      return reply.code(400).send({
        error: {
          code: "PUSH_REQUIRES_PROACTIVE",
          message: "Enable proactive suggestions before enabling push delivery."
        }
      });
    }
    const settings = await updatePersonalizationSettings(request.auth!.userId, parsed.data);
    if (!settings.enabled || settings.learning_paused) {
      await pool.query(
        `UPDATE suggestion_candidates
         SET status = 'suppressed'
         WHERE user_id = $1 AND status IN ('candidate', 'eligible')`,
        [request.auth!.userId]
      );
      await pool.query(
        `UPDATE suggestions
         SET status = 'expired', decided_at = COALESCE(decided_at, NOW())
         WHERE user_id = $1 AND status = 'delivered'`,
        [request.auth!.userId]
      );
      await resolveSuggestionMessages(request.auth!.userId);
      await pool.query(
        `UPDATE suggestion_candidates c
         SET status = 'superseded'
         FROM suggestions s
         WHERE s.candidate_id = c.id AND s.user_id = $1
           AND s.status = 'expired' AND c.status = 'delivered'`,
        [request.auth!.userId]
      );
    }
    if (!settings.in_chat) {
      await expireDeliveredSurface(request.auth!.userId, "in_chat");
    }
    if (!settings.proactive) {
      await expireDeliveredSurface(request.auth!.userId, "proactive");
    }
    return { settings };
  });

  app.post("/users/me/personalization/consents", { preHandler: requireAuth }, async (request, reply) => {
    const parsed = consentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "INVALID_PERSONALIZATION_CONSENT", message: parsed.error.issues[0]?.message }
      });
    }
    const consent = await setConsent({
      userId: request.auth!.userId,
      purpose: parsed.data.purpose,
      granted: true,
      source: parsed.data.source
    });
    void recordPersonalizationProductEvent({
      userId: request.auth!.userId,
      eventName: "personalization_consent_changed",
      metadata: { purpose: parsed.data.purpose, status: "granted" }
    }).catch(() => undefined);
    return reply.code(201).send({ consent });
  });

  app.delete(
    "/users/me/personalization/consents/:purpose",
    { preHandler: requireAuth },
    async (request, reply) => {
      const purpose = (request.params as { purpose: string }).purpose;
      if (!isPersonalizationPurpose(purpose)) {
        return reply.code(400).send({
          error: { code: "INVALID_PERSONALIZATION_PURPOSE", message: "Unknown personalization purpose." }
        });
      }
      const consent = await setConsent({
        userId: request.auth!.userId,
        purpose,
        granted: false,
        source: "settings"
      });
      if (purpose === "browser_activity") {
        await revokeBrowserConnection(request.auth!.userId);
      }
      await removePreferenceEventsByPurpose(request.auth!.userId, purpose);
      if (purpose === "explicit_feedback") {
        await pool.query(
          `DELETE FROM message_feedback WHERE user_id = $1`,
          [request.auth!.userId]
        );
        await pool.query(
          `DELETE FROM preference_profile_items
           WHERE user_id = $1
             AND (
               'assistant_feedback' = ANY(derived_from)
               OR 'confirmed_memory' = ANY(derived_from)
               OR 'suggestion_decision' = ANY(derived_from)
               OR 'explicit_exclusion' = ANY(derived_from)
             )`,
          [request.auth!.userId]
        );
      }
      void recordPersonalizationProductEvent({
        userId: request.auth!.userId,
        eventName: "personalization_consent_changed",
        metadata: { purpose, status: "revoked" }
      }).catch(() => undefined);
      await pool.query(
        `UPDATE suggestion_candidates
         SET status = 'suppressed'
         WHERE user_id = $1 AND $2 = ANY(consent_purposes)
           AND status IN ('candidate', 'eligible')`,
        [request.auth!.userId, purpose]
      );
      await pool.query(
        `UPDATE suggestions s
         SET status = 'expired', decided_at = COALESCE(s.decided_at, NOW())
         FROM suggestion_candidates c
         WHERE s.candidate_id = c.id
           AND s.user_id = $1
           AND $2 = ANY(c.consent_purposes)
           AND s.status = 'delivered'`,
        [request.auth!.userId, purpose]
      );
      await resolveSuggestionMessages(request.auth!.userId, purpose);
      await pool.query(
        `UPDATE suggestion_candidates
         SET status = 'superseded'
         WHERE user_id = $1 AND $2 = ANY(consent_purposes)
           AND status = 'delivered'`,
        [request.auth!.userId, purpose]
      );
      await pool.query(
        `DELETE FROM preference_profile_items
         WHERE user_id = $1 AND $2 = ANY(derived_from)`,
        [request.auth!.userId, purpose]
      );
      await rebuildPreferenceProfile(request.auth!.userId);
      return { consent };
    }
  );

  app.get("/users/me/preference-profile", { preHandler: requireAuth }, async (request) => ({
    items: await listPreferenceProfile(request.auth!.userId)
  }));

  app.post(
    "/users/me/preference-profile/exclusions",
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = exclusionSchema.safeParse(request.body);
      if (!parsed.success || !isSafeSubjectKey(parsed.data.subject_key)) {
        return reply.code(400).send({
          error: { code: "INVALID_EXCLUSION", message: "Enter a safe topic or source to avoid." }
        });
      }
      const settings = await getPersonalizationSettings(request.auth!.userId);
      if (!settings.enabled || !(await getActiveConsent(request.auth!.userId, "explicit_feedback"))) {
        return reply.code(403).send({
          error: {
            code: "EXPLICIT_FEEDBACK_CONSENT_REQUIRED",
            message: "Enable personalization and Direct feedback before adding an exclusion."
          }
        });
      }
      const exclusion = await createSuggestionExclusion({
        userId: request.auth!.userId,
        subjectType: parsed.data.subject_type,
        subjectKey: normalizeSubjectKey(parsed.data.subject_key)
      });
      await pool.query(
        `UPDATE suggestion_candidates
         SET status = 'superseded'
         WHERE user_id = $1 AND status IN ('candidate', 'eligible')
           AND (
             (subject_type = $2 AND subject_key = $3)
             OR (action_payload->>'preference_subject_type' = $2
                 AND action_payload->>'preference_subject_key' = $3)
           )`,
        [request.auth!.userId, exclusion.subject_type, exclusion.subject_key]
      );
      await rebuildPreferenceProfile(request.auth!.userId);
      return reply.code(201).send({ exclusion });
    }
  );

  app.patch(
    "/users/me/preference-profile/:itemId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const itemId = (request.params as { itemId: string }).itemId;
      if (!isUuid(itemId)) {
        return reply.code(404).send({ error: { code: "PROFILE_ITEM_NOT_FOUND", message: "Preference not found." } });
      }
      const parsed = profilePatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: "INVALID_PROFILE_ITEM", message: parsed.error.issues[0]?.message } });
      }
      const item = await updatePreferenceProfileItem(request.auth!.userId, itemId, parsed.data);
      return item
        ? { item }
        : reply.code(404).send({ error: { code: "PROFILE_ITEM_NOT_FOUND", message: "Preference not found." } });
    }
  );

  app.delete(
    "/users/me/preference-profile/:itemId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const itemId = (request.params as { itemId: string }).itemId;
      if (!isUuid(itemId) || !(await deletePreferenceProfileItem(request.auth!.userId, itemId))) {
        return reply.code(404).send({ error: { code: "PROFILE_ITEM_NOT_FOUND", message: "Preference not found." } });
      }
      return reply.code(204).send();
    }
  );

  app.delete("/users/me/preference-profile", { preHandler: requireAuth }, async (request) => {
    await deletePersonalizationData(request.auth!.userId);
    return { deleted: true };
  });

  app.get("/users/me/preference-profile/export", { preHandler: requireAuth }, async (request) => {
    const userId = request.auth!.userId;
    const [settings, consents, profile, events, suggestions, exclusions, analytics, feedback, browser] = await Promise.all([
      getPersonalizationSettings(userId),
        listConsentHistory(userId),
        listPreferenceProfile(userId),
      pool.query(
        `SELECT id, consent_id, event_type, subject_type, subject_key, polarity, strength,
                provenance_type, provenance_id, service_key, occurred_at, expires_at
         FROM preference_events WHERE user_id = $1 ORDER BY occurred_at DESC`,
        [userId]
      ),
      pool.query(
          `SELECT s.id, s.suggestion_type, s.status, s.delivered_at, s.decided_at,
                 s.expires_at, s.delivery_surface, c.title, c.body, c.reason_codes,
                 c.evidence_summary
          FROM suggestions s
         JOIN suggestion_candidates c ON c.id = s.candidate_id
         WHERE s.user_id = $1 ORDER BY s.delivered_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT id, subject_type, subject_key, source_suggestion_id, created_at
         FROM suggestion_exclusions WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT id, event_name, suggestion_id, metadata, occurred_at
         FROM personalization_product_events
         WHERE user_id = $1 ORDER BY occurred_at DESC`,
          [userId]
        ),
      pool.query(
        `SELECT id, message_id, feedback_type, subject_type, subject_key, metadata, created_at
         FROM message_feedback
         WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      ),
      pool.query(
        `SELECT id, connected_at, expires_at, last_used_at
         FROM personalization_browser_connections
         WHERE user_id = $1 AND revoked_at IS NULL
         ORDER BY connected_at DESC LIMIT 1`,
        [userId]
      )
      ]);
    return {
      exported_at: new Date().toISOString(),
      settings,
      consents,
      profile,
      events: events.rows,
      suggestions: suggestions.rows,
      exclusions: exclusions.rows,
      analytics: analytics.rows,
      feedback: feedback.rows,
      browser_connection: browser.rows[0] ?? null
    };
  });

  app.post("/messages/:messageId/feedback", { preHandler: requireAuth }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    if (!isUuid(messageId)) {
      return reply.code(404).send({ error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." } });
    }
    const parsed = feedbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "INVALID_MESSAGE_FEEDBACK", message: parsed.error.issues[0]?.message } });
    }
    const userId = request.auth!.userId;
    const settings = await getPersonalizationSettings(userId);
    const consent = await getActiveConsent(userId, "explicit_feedback");
    if (!settings.enabled || settings.learning_paused || !consent) {
      return { stored: false, reason: "no_consent" };
    }
    const message = await pool.query<{ agent_id: string }>(
      `SELECT agent_id FROM agent_messages WHERE id = $1 AND user_id = $2`,
      [messageId, userId]
    );
    const messageRow = message.rows[0];
    if (!messageRow) {
      return reply.code(404).send({ error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." } });
    }
    const subjectType = parsed.data.subject_type ?? "agent_type";
    if (parsed.data.subject_key && !isSafeSubjectKey(parsed.data.subject_key)) {
      return reply.code(400).send({
        error: { code: "INVALID_MESSAGE_FEEDBACK", message: "The feedback subject is invalid." }
      });
    }
    const subjectKey = normalizeSubjectKey(
      parsed.data.subject_key ?? `agent_${messageRow.agent_id}`
    );
    if (!subjectKey) {
      return reply.code(400).send({
        error: { code: "INVALID_MESSAGE_FEEDBACK", message: "The feedback subject is invalid." }
      });
    }
    const replaced = await pool.query<{ id: string }>(
      `DELETE FROM message_feedback
       WHERE user_id = $1 AND message_id = $2 AND feedback_type <> $3
       RETURNING id`,
      [userId, messageId, parsed.data.feedback_type]
    );
    for (const row of replaced.rows) {
      await removePreferenceEventsByProvenance(userId, "assistant_feedback", row.id);
      await removePreferenceEventsByProvenance(userId, "cuppet_activity", row.id);
    }
    const previous = await pool.query<{ id: string }>(
      `SELECT id FROM message_feedback
       WHERE user_id = $1 AND message_id = $2 AND feedback_type = $3`,
      [userId, messageId, parsed.data.feedback_type]
    );
    if (previous.rows[0]) {
      await removePreferenceEventsByProvenance(
        userId,
        "assistant_feedback",
        previous.rows[0].id
      );
      await removePreferenceEventsByProvenance(
        userId,
        "cuppet_activity",
        previous.rows[0].id
      );
    }
    const feedback = await pool.query<{ id: string }>(
      `INSERT INTO message_feedback (user_id, message_id, feedback_type, subject_type, subject_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, message_id, feedback_type) DO UPDATE
       SET subject_type = EXCLUDED.subject_type, subject_key = EXCLUDED.subject_key
       RETURNING id`,
      [userId, messageId, parsed.data.feedback_type, subjectType, subjectKey]
    );
    const negative = new Set([
      "not_useful",
      "less_like_this",
      "too_noisy",
      "wrong_priority",
      "wrong_format",
      "not_relevant",
      "not_interested_topic",
      "not_interested_source"
    ]).has(parsed.data.feedback_type);
    const event = await recordPreferenceEvent({
      userId,
      purpose: "explicit_feedback",
      eventType: `message_${parsed.data.feedback_type}`,
      subjectType,
      subjectKey,
      polarity: negative ? -1 : 1,
      strength: 0.9,
      provenanceType: "assistant_feedback",
      provenanceId: feedback.rows[0]!.id,
      messageId
    });
    void recordPersonalizationProductEvent({
      userId,
      eventName: "message_feedback",
      metadata: { feedback_type: parsed.data.feedback_type }
    }).catch(() => undefined);
    if (negative) {
      void recordCuppetActivitySignal({
        userId,
        eventType: "result_dismissed",
        subjectType,
        subjectKey,
        provenanceId: feedback.rows[0]!.id,
        messageId,
        agentId: messageRow.agent_id
      }).catch(() => undefined);
    }
    return { stored: true, feedback_id: feedback.rows[0]!.id, event };
  });

  app.delete("/messages/:messageId/feedback", { preHandler: requireAuth }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    if (!isUuid(messageId)) return reply.code(404).send({ error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." } });
    const userId = request.auth!.userId;
    const { rows } = await pool.query<{ id: string }>(
      `DELETE FROM message_feedback WHERE user_id = $1 AND message_id = $2 RETURNING id`,
      [userId, messageId]
    );
    for (const row of rows) {
      await removePreferenceEventsByProvenance(userId, "assistant_feedback", row.id);
      await removePreferenceEventsByProvenance(userId, "cuppet_activity", row.id);
    }
    return reply.code(204).send();
  });

  app.post("/messages/:messageId/activity", { preHandler: requireAuth }, async (request, reply) => {
    const { messageId } = request.params as { messageId: string };
    if (!isUuid(messageId)) {
      return reply.code(404).send({ error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." } });
    }
    const parsed = activitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "INVALID_MESSAGE_ACTIVITY", message: parsed.error.issues[0]?.message }
      });
    }
    const message = await pool.query<{ agent_id: string }>(
      `SELECT agent_id FROM agent_messages WHERE id = $1 AND user_id = $2`,
      [messageId, request.auth!.userId]
    );
    const messageRow = message.rows[0];
    if (!messageRow) {
      return reply.code(404).send({ error: { code: "MESSAGE_NOT_FOUND", message: "Message not found." } });
    }
    if (!isSafeSubjectKey(parsed.data.subject_key)) {
      return reply.code(400).send({
        error: { code: "INVALID_MESSAGE_ACTIVITY", message: "The activity subject is invalid." }
      });
    }
    return recordCuppetActivitySignal({
      userId: request.auth!.userId,
      eventType: parsed.data.activity_type,
      subjectType: parsed.data.subject_type,
      subjectKey: parsed.data.subject_key,
      provenanceId: messageId,
      messageId,
      agentId: messageRow.agent_id
    });
  });
}

async function expireDeliveredSurface(
  userId: string,
  surface: "in_chat" | "proactive"
): Promise<void> {
  await pool.query(
    `UPDATE suggestions
     SET status = 'expired', decided_at = COALESCE(decided_at, NOW())
     WHERE user_id = $1 AND delivery_surface = $2 AND status = 'delivered'`,
    [userId, surface]
  );
  await pool.query(
    `UPDATE suggestion_candidates c
     SET status = 'superseded'
     FROM suggestions s
     WHERE s.candidate_id = c.id AND s.user_id = $1
       AND s.delivery_surface = $2 AND s.status = 'expired'
       AND c.status = 'delivered'`,
    [userId, surface]
  );
  await pool.query(
    `UPDATE agent_messages m
     SET content = jsonb_set(
       m.content,
       '{data}',
       COALESCE(m.content->'data', '{}'::jsonb) ||
         '{"resolved": true, "resolution": "delivery_disabled"}'::jsonb,
       true
     )
     FROM suggestions s
     WHERE s.message_id = m.id
       AND s.user_id = $1
       AND s.delivery_surface = $2
       AND s.status = 'expired'`,
    [userId, surface]
  );
}

async function resolveSuggestionMessages(userId: string, purpose?: string): Promise<void> {
  await pool.query(
    `UPDATE agent_messages m
     SET content = jsonb_set(
       m.content,
       '{data}',
       COALESCE(m.content->'data', '{}'::jsonb) ||
         '{"resolved": true, "resolution": "personalization_disabled"}'::jsonb,
       true
     )
     FROM suggestions s
     LEFT JOIN suggestion_candidates c ON c.id = s.candidate_id
     WHERE s.message_id = m.id
       AND s.user_id = $1
       AND s.status = 'expired'
       AND ($2::text IS NULL OR $2 = ANY(c.consent_purposes))`,
    [userId, purpose ?? null]
  );
}

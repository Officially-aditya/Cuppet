import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import type { FastifyInstance } from "fastify";

const connectionString = process.env.TEST_DATABASE_URL;

test.after(async () => {
  if (connectionString) {
    const { closeQueue } = await import("../queue/index.js");
    await closeQueue();
  }
});

type Harness = {
  app: FastifyInstance;
  db: pg.Pool;
  userId: string;
  sessionToken: string;
};

test(
  "authenticated personalization export and reset delete every personal record",
  { skip: !connectionString },
  async () => {
    const harness = await createHarness();
    try {
      const unauthorized = await harness.app.inject({
        method: "GET",
        url: "/users/me/personalization"
      });
      assert.equal(unauthorized.statusCode, 401);

      const initial = await harness.app.inject({
        method: "GET",
        url: "/users/me/personalization",
        headers: authHeaders(harness.sessionToken)
      });
      assert.equal(initial.statusCode, 200);
      assert.equal(initial.json().settings.enabled, false);
      assert.equal(initial.json().profile_count, 0);

      for (const purpose of ["explicit_feedback", "browser_activity"]) {
        const response = await harness.app.inject({
          method: "POST",
          url: "/users/me/personalization/consents",
          headers: jsonAuthHeaders(harness.sessionToken),
          payload: { purpose, source: "integration_test" }
        });
        assert.equal(response.statusCode, 201);
        assert.equal(response.json().consent.status, "granted");
      }

      const settings = await harness.app.inject({
        method: "PATCH",
        url: "/users/me/personalization",
        headers: jsonAuthHeaders(harness.sessionToken),
        payload: {
          enabled: true,
          learning_paused: false,
          frequency: "high",
          in_chat: true,
          proactive: false,
          push: false
        }
      });
      assert.equal(settings.statusCode, 200);
      assert.equal(settings.json().settings.enabled, true);
      assert.equal(settings.json().settings.frequency, "high");

      const browserConnection = await harness.app.inject({
        method: "POST",
        url: "/users/me/personalization/browser-connection",
        headers: authHeaders(harness.sessionToken)
      });
      assert.equal(browserConnection.statusCode, 201);
      const browserToken = browserConnection.json().connection.token as string;
      assert.match(browserToken, /^cup_browser_/);

      await seedExportData(harness.db, harness.userId);
      await waitFor(async () => {
        const result = await harness.db.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM personalization_product_events
           WHERE user_id = $1`,
          [harness.userId]
        );
        return Number(result.rows[0]?.count ?? 0) >= 2;
      });

      const exported = await harness.app.inject({
        method: "GET",
        url: "/users/me/preference-profile/export",
        headers: authHeaders(harness.sessionToken)
      });
      assert.equal(exported.statusCode, 200);
      const exportBody = exported.json();
      assert.equal(exportBody.settings.enabled, true);
      assert.equal(exportBody.events.length, 1);
      assert.equal(exportBody.profile.length, 1);
      assert.equal(exportBody.suggestions.length, 1);
      assert.equal(exportBody.exclusions.length, 1);
      assert.ok(exportBody.browser_connection);
      assert.equal("token" in exportBody.browser_connection, false);

      const reset = await harness.app.inject({
        method: "DELETE",
        url: "/users/me/preference-profile",
        headers: authHeaders(harness.sessionToken)
      });
      assert.equal(reset.statusCode, 200);
      assert.deepEqual(reset.json(), { deleted: true });

      const counts = await harness.db.query<{
        settings: string;
        consents: string;
        events: string;
        profile: string;
        outbox: string;
        candidates: string;
        suggestions: string;
        exclusions: string;
        browser: string;
        vectors: string;
        productEvents: string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM personalization_settings WHERE user_id = $1)::text AS settings,
           (SELECT COUNT(*) FROM personalization_consents WHERE user_id = $1)::text AS consents,
           (SELECT COUNT(*) FROM preference_events WHERE user_id = $1)::text AS events,
           (SELECT COUNT(*) FROM preference_profile_items WHERE user_id = $1)::text AS profile,
           (SELECT COUNT(*) FROM personalization_outbox WHERE user_id = $1)::text AS outbox,
           (SELECT COUNT(*) FROM suggestion_candidates WHERE user_id = $1)::text AS candidates,
           (SELECT COUNT(*) FROM suggestions WHERE user_id = $1)::text AS suggestions,
           (SELECT COUNT(*) FROM suggestion_exclusions WHERE user_id = $1)::text AS exclusions,
           (SELECT COUNT(*) FROM personalization_browser_connections WHERE user_id = $1)::text AS browser,
           (SELECT COUNT(*) FROM preference_vectors WHERE user_id = $1)::text AS vectors,
           (SELECT COUNT(*) FROM personalization_product_events WHERE user_id = $1)::text AS "productEvents"`,
        [harness.userId]
      );
      assert.deepEqual(counts.rows[0], {
        settings: "0",
        consents: "7",
        events: "0",
        profile: "0",
        outbox: "0",
        candidates: "0",
        suggestions: "0",
        exclusions: "0",
        browser: "0",
        vectors: "0",
        productEvents: "0"
      });

      const afterReset = await harness.app.inject({
        method: "GET",
        url: "/users/me/personalization",
        headers: authHeaders(harness.sessionToken)
      });
      assert.equal(afterReset.statusCode, 200);
      assert.equal(afterReset.json().settings.enabled, false);
      assert.equal(afterReset.json().browser_connected, false);
      assert.equal(afterReset.json().profile_count, 0);
      assert.equal(afterReset.json().consents.length, 5);
      assert.ok(afterReset.json().consents.every((consent: { status: string }) => consent.status === "revoked"));

      const oldBrowserToken = await harness.app.inject({
        method: "POST",
        url: "/users/me/personalization/browser-events",
        headers: { "x-cuppet-browser-token": browserToken },
        payload: {
          event_id: "reset-token-invalid",
          event_type: "page_view",
          domain: "example.com"
        }
      });
      assert.equal(oldBrowserToken.statusCode, 401);

      const emptyExport = await harness.app.inject({
        method: "GET",
        url: "/users/me/preference-profile/export",
        headers: authHeaders(harness.sessionToken)
      });
      assert.equal(emptyExport.statusCode, 200);
      assert.equal(emptyExport.json().events.length, 0);
      assert.equal(emptyExport.json().profile.length, 0);
      assert.equal(emptyExport.json().suggestions.length, 0);
      assert.equal(emptyExport.json().browser_connection, null);
    } finally {
      await destroyHarness(harness);
    }
  }
);

test(
  "expired browser connections cannot authenticate browser events",
  { skip: !connectionString },
  async () => {
    const harness = await createHarness();
    try {
      const connection = await harness.app.inject({
        method: "POST",
        url: "/users/me/personalization/browser-connection",
        headers: authHeaders(harness.sessionToken)
      });
      assert.equal(connection.statusCode, 201);
      const token = connection.json().connection.token as string;

      await harness.db.query(
        `UPDATE personalization_browser_connections
         SET expires_at = NOW() - INTERVAL '1 minute'
         WHERE user_id = $1`,
        [harness.userId]
      );

      const response = await harness.app.inject({
        method: "POST",
        url: "/users/me/personalization/browser-events",
        headers: { "x-cuppet-browser-token": token },
        payload: {
          event_id: "expired-token-event",
          event_type: "save",
          domain: "example.com",
          category: "testing"
        }
      });
      assert.equal(response.statusCode, 401);

      const settings = await harness.app.inject({
        method: "GET",
        url: "/users/me/personalization",
        headers: authHeaders(harness.sessionToken)
      });
      assert.equal(settings.statusCode, 200);
      assert.equal(settings.json().browser_connected, false);
    } finally {
      await destroyHarness(harness);
    }
  }
);

test(
  "concurrent outbox workers process one pending row once",
  { skip: !connectionString },
  async () => {
    const { processPersonalizationOutbox } = await import("../workers/personalization-worker.js");
    const db = createDatabasePool();
    const userId = `personalization-outbox-${randomUUID()}`;
    try {
      await db.query(
        `INSERT INTO users (id, name, email, email_verified)
         VALUES ($1, 'Personalization Outbox Test', $2, TRUE)`,
        [userId, `${userId}@example.test`]
      );
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO personalization_outbox (user_id, event_name, payload)
         VALUES ($1, 'preference_event.created', '{"event_id":"integration"}'::jsonb)
         RETURNING id`,
        [userId]
      );
      const outboxId = inserted.rows[0]!.id;

      const results = await Promise.all([
        processPersonalizationOutbox(outboxId),
        processPersonalizationOutbox(outboxId)
      ]);
      assert.equal(results.filter((result) => result.processed).length, 1);
      assert.equal(results.filter((result) => !result.processed).length, 1);

      const row = await db.query<{ status: string; attempts: number; processed_at: Date | null }>(
        `SELECT status, attempts, processed_at
         FROM personalization_outbox
         WHERE id = $1`,
        [outboxId]
      );
      assert.equal(row.rows[0]?.status, "completed");
      assert.equal(row.rows[0]?.attempts, 1);
      assert.ok(row.rows[0]?.processed_at);

      assert.deepEqual(await processPersonalizationOutbox(outboxId), { processed: false });
      const afterDuplicate = await db.query<{ attempts: number }>(
        "SELECT attempts FROM personalization_outbox WHERE id = $1",
        [outboxId]
      );
      assert.equal(afterDuplicate.rows[0]?.attempts, 1);

      const stale = await db.query<{ id: string }>(
        `INSERT INTO personalization_outbox
           (user_id, event_name, payload, status, attempts, processing_started_at)
         VALUES ($1, 'preference_event.created', '{"event_id":"stale"}'::jsonb,
                 'processing', 2, NOW() - INTERVAL '16 minutes')
         RETURNING id`,
        [userId]
      );
      const staleId = stale.rows[0]!.id;
      assert.deepEqual(await processPersonalizationOutbox(staleId), { processed: true });
      const recovered = await db.query<{ status: string; attempts: number }>(
        "SELECT status, attempts FROM personalization_outbox WHERE id = $1",
        [staleId]
      );
      assert.deepEqual(recovered.rows[0], { status: "completed", attempts: 3 });
      assert.deepEqual(await processPersonalizationOutbox(staleId), { processed: false });
    } finally {
      await db.query("DELETE FROM users WHERE id = $1", [userId]);
      await db.end();
    }
  }
);

async function createHarness(): Promise<Harness> {
  assert.ok(connectionString);
  const [{ buildApp }, { config }] = await Promise.all([
    import("../app.js"),
    import("../config.js")
  ]);
  assert.equal(
    config.DATABASE_URL,
    connectionString,
    "TEST_DATABASE_URL must point to the same database configured for the app"
  );
  const db = createDatabasePool();
  const userId = `personalization-integration-${randomUUID()}`;
  const sessionToken = `integration-session-${randomUUID()}`;
  await db.query(
    `INSERT INTO users (id, name, email, email_verified)
     VALUES ($1, 'Personalization Integration Test', $2, TRUE)`,
    [userId, `${userId}@example.test`]
  );
  await db.query(
    `INSERT INTO sessions (id, user_id, token, expires_at)
     VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
    [randomUUID(), userId, sessionToken]
  );
  const app = await buildApp();
  await app.ready();
  return { app, db, userId, sessionToken };
}

async function destroyHarness(harness: Harness): Promise<void> {
  await harness.app.close();
  await harness.db.query("DELETE FROM users WHERE id = $1", [harness.userId]);
  await harness.db.end();
}

function createDatabasePool(): pg.Pool {
  assert.ok(connectionString);
  return new pg.Pool({ connectionString });
}

function authHeaders(sessionToken: string): Record<string, string> {
  return { authorization: `Bearer ${sessionToken}` };
}

function jsonAuthHeaders(sessionToken: string): Record<string, string> {
  return { ...authHeaders(sessionToken), "content-type": "application/json" };
}

async function seedExportData(db: pg.Pool, userId: string): Promise<void> {
  const consent = await db.query<{ id: string }>(
    `SELECT id
     FROM personalization_consents
     WHERE user_id = $1 AND purpose = 'browser_activity' AND status = 'granted'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  const consentId = consent.rows[0]!.id;
  await db.query(
    `INSERT INTO preference_events
       (user_id, consent_id, event_type, subject_type, subject_key,
        polarity, strength, provenance_type, provenance_id, properties, occurred_at)
     VALUES ($1, $2, 'browser_save', 'source', 'example.com', 1, 0.8,
             'browser_activity', 'integration-browser-event', '{"category":"testing"}'::jsonb, NOW())`,
    [userId, consentId]
  );
  await db.query(
    `INSERT INTO preference_profile_items
       (user_id, dimension, key, weight, confidence, evidence_count,
        strongest_evidence_type, derived_from, first_observed_at, last_observed_at)
     VALUES ($1, 'source', 'example.com', 0.8, 0.8, 1, 'browser_save',
             ARRAY['browser_activity']::text[], NOW(), NOW())`,
    [userId]
  );
  const candidate = await db.query<{ id: string }>(
    `INSERT INTO suggestion_candidates
       (user_id, suggestion_type, generator_key, origin, subject_type, subject_key,
        title, body, action_type, action_payload, reason_codes, evidence_summary,
        relevance_score, confidence_score, interruption_cost, consent_purposes,
        expires_at, status)
     VALUES ($1, 'content', 'integration', 'user_pattern', 'source', 'example.com',
             'Integration suggestion', 'A test suggestion', 'open_url',
             '{"url":"https://example.com"}'::jsonb, ARRAY['integration']::text[],
             '{"source":"browser"}'::jsonb, 0.8, 0.9, 0.1,
             ARRAY['browser_activity']::text[], NOW() + INTERVAL '1 day', 'delivered')
     RETURNING id`,
    [userId]
  );
  await db.query(
    `INSERT INTO suggestions
       (candidate_id, user_id, suggestion_type, action_type, action_payload,
        status, delivered_at, expires_at, delivery_surface)
     VALUES ($1, $2, 'content', 'open_url', '{"url":"https://example.com"}'::jsonb,
             'delivered', NOW(), NOW() + INTERVAL '1 day', 'in_chat')`,
    [candidate.rows[0]!.id, userId]
  );
  await db.query(
    `INSERT INTO suggestion_exclusions (user_id, subject_type, subject_key)
     VALUES ($1, 'topic', 'integration_testing')`,
    [userId]
  );
  await db.query(
    `INSERT INTO personalization_outbox (user_id, event_name, payload)
     VALUES ($1, 'preference_profile.rebuild', '{}'::jsonb)`,
    [userId]
  );
  await db.query(
    `INSERT INTO personalization_product_events (user_id, event_name, metadata)
     VALUES ($1, 'suggestion_delivered', '{"surface":"in_chat"}'::jsonb)`,
    [userId]
  );
  await db.query(
    `INSERT INTO preference_vectors (user_id, namespace, vector, source_item_count)
     VALUES ($1, 'suggestions', '[0.1, 0.2]'::jsonb, 1)`,
    [userId]
  );
}

async function waitFor(condition: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("Timed out waiting for integration data");
}

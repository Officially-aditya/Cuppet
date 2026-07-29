exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE personalization_settings (
      user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled           BOOLEAN NOT NULL DEFAULT FALSE,
      learning_paused   BOOLEAN NOT NULL DEFAULT FALSE,
       frequency         TEXT NOT NULL DEFAULT 'balanced'
                          CHECK (frequency IN ('low', 'balanced')),
      in_chat           BOOLEAN NOT NULL DEFAULT TRUE,
      proactive         BOOLEAN NOT NULL DEFAULT FALSE,
      push              BOOLEAN NOT NULL DEFAULT FALSE,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TRIGGER trg_personalization_settings_updated_at
      BEFORE UPDATE ON personalization_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TABLE personalization_consents (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose       TEXT NOT NULL CHECK (purpose IN (
        'explicit_feedback',
        'cuppet_activity',
        'connected_content',
        'browser_activity',
        'cross_source'
      )),
      status        TEXT NOT NULL CHECK (status IN ('granted', 'revoked')),
      policy_version TEXT NOT NULL,
      granted_at    TIMESTAMPTZ,
      revoked_at    TIMESTAMPTZ,
      source        TEXT NOT NULL,
      metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_personalization_consents_user
      ON personalization_consents(user_id, purpose, created_at DESC);

    CREATE TABLE preference_events (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      consent_id       UUID NOT NULL REFERENCES personalization_consents(id),
      event_type       TEXT NOT NULL,
      subject_type     TEXT NOT NULL CHECK (subject_type IN (
        'topic',
        'source',
        'format',
        'timing',
        'agent_type',
        'capability',
        'notification_policy',
        'exclusion'
      )),
      subject_key      TEXT NOT NULL CHECK (char_length(subject_key) BETWEEN 1 AND 180),
      polarity         SMALLINT NOT NULL CHECK (polarity IN (-1, 0, 1)),
      strength         DOUBLE PRECISION NOT NULL CHECK (strength >= 0 AND strength <= 1),
      provenance_type  TEXT NOT NULL,
      provenance_id    TEXT,
      service_key      TEXT,
      agent_id         UUID REFERENCES agents(id) ON DELETE SET NULL,
      message_id       UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
      properties       JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at      TIMESTAMPTZ NOT NULL,
      expires_at       TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_preference_events_user_time
      ON preference_events(user_id, occurred_at DESC);
    CREATE INDEX idx_preference_events_subject
      ON preference_events(user_id, subject_type, subject_key);
    CREATE INDEX idx_preference_events_provenance
      ON preference_events(user_id, provenance_type, provenance_id);

    CREATE TABLE preference_profile_items (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      dimension             TEXT NOT NULL CHECK (dimension IN (
        'topic',
        'source',
        'format',
        'timing',
        'agent_type',
        'capability',
        'notification_policy',
        'exclusion'
      )),
      key                   TEXT NOT NULL,
      weight                DOUBLE PRECISION NOT NULL,
      confidence            DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
      evidence_count        INTEGER NOT NULL DEFAULT 0,
      strongest_evidence_type TEXT NOT NULL,
      derived_from          TEXT[] NOT NULL DEFAULT '{}',
      first_observed_at     TIMESTAMPTZ NOT NULL,
      last_observed_at      TIMESTAMPTZ NOT NULL,
      expires_at            TIMESTAMPTZ,
      metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, dimension, key)
    );

    CREATE INDEX idx_preference_profile_user
      ON preference_profile_items(user_id, dimension, weight DESC);

    CREATE TABLE personalization_outbox (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_name    TEXT NOT NULL,
      payload       JSONB NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      attempts      INTEGER NOT NULL DEFAULT 0,
      available_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_personalization_outbox_pending
      ON personalization_outbox(status, available_at);

    CREATE TABLE suggestion_candidates (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      suggestion_type     TEXT NOT NULL CHECK (suggestion_type IN (
        'agent_creation',
        'agent_refinement',
        'capability_connection',
        'content',
        'attention_reduction'
      )),
      generator_key       TEXT NOT NULL,
      origin              TEXT NOT NULL CHECK (origin IN (
        'user_pattern',
        'current_context',
        'agent_improvement',
        'capability_gap',
        'user_interest'
      )),
      subject_type        TEXT NOT NULL,
      subject_key         TEXT NOT NULL,
      title               TEXT NOT NULL,
      body                TEXT NOT NULL,
      action_type         TEXT NOT NULL,
      action_payload      JSONB NOT NULL,
      reason_codes        TEXT[] NOT NULL,
      evidence_summary    JSONB NOT NULL DEFAULT '{}'::jsonb,
      score_breakdown     JSONB NOT NULL DEFAULT '{}'::jsonb,
      relevance_score     DOUBLE PRECISION NOT NULL,
      confidence_score    DOUBLE PRECISION NOT NULL,
      interruption_cost   DOUBLE PRECISION NOT NULL DEFAULT 0,
      consent_purposes    TEXT[] NOT NULL DEFAULT '{}',
      eligible_after      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at          TIMESTAMPTZ NOT NULL,
      status              TEXT NOT NULL DEFAULT 'candidate'
                          CHECK (status IN (
                            'candidate',
                            'eligible',
                            'suppressed',
                            'delivered',
                            'accepted',
                            'dismissed',
                            'expired',
                            'superseded'
                          )),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_suggestion_candidates_user_status
      ON suggestion_candidates(user_id, status, eligible_after);
    CREATE INDEX idx_suggestion_candidates_subject
      ON suggestion_candidates(user_id, generator_key, subject_key, created_at DESC);

    CREATE TABLE suggestions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      candidate_id    UUID NOT NULL REFERENCES suggestion_candidates(id),
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id      UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
      suggestion_type TEXT NOT NULL,
      action_type     TEXT NOT NULL,
      action_payload  JSONB NOT NULL,
      status          TEXT NOT NULL CHECK (status IN (
        'delivered',
        'accepted',
        'not_now',
        'dismissed',
        'expired',
        'failed'
      )),
      delivered_at    TIMESTAMPTZ NOT NULL,
      decided_at      TIMESTAMPTZ,
      expires_at      TIMESTAMPTZ NOT NULL,
      UNIQUE(candidate_id)
    );

    CREATE INDEX idx_suggestions_user_status
      ON suggestions(user_id, status, delivered_at DESC);
    CREATE INDEX idx_suggestions_user_subject
      ON suggestions(user_id, suggestion_type, delivered_at DESC);

    CREATE TABLE message_feedback (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id    UUID NOT NULL REFERENCES agent_messages(id) ON DELETE CASCADE,
      feedback_type TEXT NOT NULL,
      subject_type  TEXT,
      subject_key   TEXT,
      metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, message_id, feedback_type)
    );

    CREATE INDEX idx_message_feedback_user
      ON message_feedback(user_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS message_feedback;
    DROP TABLE IF EXISTS suggestions;
    DROP TABLE IF EXISTS suggestion_candidates;
    DROP TABLE IF EXISTS personalization_outbox;
    DROP TABLE IF EXISTS preference_profile_items;
    DROP TABLE IF EXISTS preference_events;
    DROP TABLE IF EXISTS personalization_consents;
    DROP TRIGGER IF EXISTS trg_personalization_settings_updated_at ON personalization_settings;
    DROP TABLE IF EXISTS personalization_settings;
  `);
};

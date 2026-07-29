exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE personalization_outbox
      ADD COLUMN processing_started_at TIMESTAMPTZ;

    CREATE INDEX idx_personalization_outbox_processing
      ON personalization_outbox(status, processing_started_at)
      WHERE status = 'processing';

    CREATE TABLE suggestion_exclusions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_type TEXT NOT NULL,
      subject_key TEXT NOT NULL,
      source_suggestion_id UUID REFERENCES suggestions(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, subject_type, subject_key)
    );

    CREATE INDEX idx_suggestion_exclusions_user
      ON suggestion_exclusions(user_id, subject_type, subject_key);

    ALTER TABLE suggestions
      ADD COLUMN continuation_started_at TIMESTAMPTZ,
      ADD COLUMN continuation_message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL;

    CREATE TABLE personalization_browser_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX idx_browser_connections_active_user
      ON personalization_browser_connections(user_id)
      WHERE revoked_at IS NULL;

    CREATE TABLE personalization_product_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_name TEXT NOT NULL,
      suggestion_id UUID REFERENCES suggestions(id) ON DELETE SET NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_personalization_product_events_time
      ON personalization_product_events(event_name, occurred_at DESC);
    CREATE INDEX idx_personalization_product_events_user
      ON personalization_product_events(user_id, occurred_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_personalization_product_events_user;
    DROP INDEX IF EXISTS idx_personalization_product_events_time;
    DROP TABLE IF EXISTS personalization_product_events;
    DROP INDEX IF EXISTS idx_browser_connections_active_user;
    DROP TABLE IF EXISTS personalization_browser_connections;
    ALTER TABLE suggestions
      DROP COLUMN IF EXISTS continuation_message_id,
      DROP COLUMN IF EXISTS continuation_started_at;
    DROP INDEX IF EXISTS idx_suggestion_exclusions_user;
    DROP TABLE IF EXISTS suggestion_exclusions;
    DROP INDEX IF EXISTS idx_personalization_outbox_processing;
    ALTER TABLE personalization_outbox
      DROP COLUMN IF EXISTS processing_started_at;
  `);
};

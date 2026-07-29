exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE personalization_browser_connections
      ADD COLUMN expires_at TIMESTAMPTZ NOT NULL
        DEFAULT (NOW() + INTERVAL '365 days'),
      ADD COLUMN last_used_at TIMESTAMPTZ;

    CREATE INDEX idx_browser_connections_active_token
      ON personalization_browser_connections(token_hash, expires_at)
      WHERE revoked_at IS NULL;

    CREATE UNIQUE INDEX idx_browser_preference_event_dedupe
      ON preference_events(user_id, provenance_type, provenance_id,
                          subject_type, subject_key)
      WHERE provenance_type = 'browser_activity'
        AND provenance_id IS NOT NULL;

    CREATE TABLE preference_vectors (
      user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      namespace         TEXT NOT NULL,
      vector            JSONB NOT NULL,
      source_item_count INTEGER NOT NULL DEFAULT 0,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, namespace)
    );
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS preference_vectors;
    DROP INDEX IF EXISTS idx_browser_preference_event_dedupe;
    DROP INDEX IF EXISTS idx_browser_connections_active_token;
    ALTER TABLE personalization_browser_connections
      DROP COLUMN IF EXISTS last_used_at,
      DROP COLUMN IF EXISTS expires_at;
  `);
};

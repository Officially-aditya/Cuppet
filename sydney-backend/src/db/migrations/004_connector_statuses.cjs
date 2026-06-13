exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS connector_statuses (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connector_id  TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'disconnected'
                    CHECK (status IN ('connected', 'disconnected')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, connector_id)
    );

    CREATE INDEX IF NOT EXISTS idx_connector_statuses_user
      ON connector_statuses(user_id);

    DROP TRIGGER IF EXISTS trg_connector_statuses_updated_at
      ON connector_statuses;

    CREATE TRIGGER trg_connector_statuses_updated_at
    BEFORE UPDATE ON connector_statuses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS connector_statuses;
  `);
};

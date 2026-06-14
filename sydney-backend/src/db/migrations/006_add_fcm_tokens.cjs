exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE fcm_tokens (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token         TEXT NOT NULL,
      device_info   JSONB,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, token)
    );

    CREATE INDEX idx_fcm_tokens_user_id ON fcm_tokens(user_id);
    CREATE INDEX idx_fcm_tokens_token ON fcm_tokens(token);

    CREATE TRIGGER trg_fcm_tokens_updated_at
    BEFORE UPDATE ON fcm_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS fcm_tokens;
  `);
};

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE llm_token_usage_windows (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      window_key         UUID NOT NULL,
      window_started_at  TIMESTAMPTZ NOT NULL,
      window_ends_at     TIMESTAMPTZ NOT NULL,
      input_tokens       BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
      output_tokens      BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE llm_token_reservations (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      window_key    UUID NOT NULL,
      input_tokens  INTEGER NOT NULL CHECK (input_tokens >= 0),
      output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
      expires_at    TIMESTAMPTZ NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_llm_token_reservations_window
      ON llm_token_reservations(user_id, window_key, expires_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_llm_token_reservations_window;
    DROP TABLE IF EXISTS llm_token_reservations;
    DROP TABLE IF EXISTS llm_token_usage_windows;
  `);
};

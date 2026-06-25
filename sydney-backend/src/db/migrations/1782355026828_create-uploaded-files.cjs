exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      mime_type    TEXT NOT NULL,
      data         BYTEA NOT NULL,
      size         INTEGER NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day')
    );

    CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);
    CREATE INDEX IF NOT EXISTS idx_uploaded_files_expires_at ON uploaded_files(expires_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS uploaded_files;
  `);
};

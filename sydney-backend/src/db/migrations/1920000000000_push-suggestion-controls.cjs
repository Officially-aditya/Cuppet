exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE suggestions
      ADD COLUMN push_sent_at TIMESTAMPTZ;

    CREATE INDEX idx_suggestions_user_push
      ON suggestions(user_id, push_sent_at DESC)
      WHERE push_sent_at IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_suggestions_user_push;
    ALTER TABLE suggestions DROP COLUMN IF EXISTS push_sent_at;
  `);
};

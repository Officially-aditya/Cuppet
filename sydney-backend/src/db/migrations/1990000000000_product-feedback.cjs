exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE product_feedback (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      topic      TEXT NOT NULL CHECK (topic IN (
        'product_idea',
        'something_went_wrong',
        'general_feedback'
      )),
      message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX product_feedback_user_time_idx
      ON product_feedback(user_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS product_feedback_user_time_idx;
    DROP TABLE IF EXISTS product_feedback;
  `);
};

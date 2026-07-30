exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE feedback_requests (
      message_id UUID PRIMARY KEY
        REFERENCES agent_messages(id)
        ON DELETE CASCADE,

      user_id TEXT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      agent_id UUID NOT NULL
        REFERENCES agents(id)
        ON DELETE CASCADE,

      reason TEXT NOT NULL,

      requested_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW(),

      responded_at TIMESTAMPTZ,

      feedback_type TEXT
    );

    CREATE INDEX feedback_requests_user_time_idx
      ON feedback_requests(user_id, requested_at DESC);

    CREATE INDEX feedback_requests_agent_time_idx
      ON feedback_requests(agent_id, requested_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS feedback_requests_agent_time_idx;
    DROP INDEX IF EXISTS feedback_requests_user_time_idx;
    DROP TABLE IF EXISTS feedback_requests;
  `);
};

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS agent_instruction_updates (
      id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id                 UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source_message_id        UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
      kind                     TEXT NOT NULL
                                 CHECK (kind IN ('chat', 'update_agent', 'run_now', 'clarification_needed', 'unsupported')),
      status                   TEXT NOT NULL
                                 CHECK (status IN ('applied', 'recorded', 'queued', 'rejected', 'clarification_needed')),
      confidence               NUMERIC(4, 3) NOT NULL DEFAULT 0,
      reason                   TEXT NOT NULL,
      patch                    JSONB NOT NULL DEFAULT '{}'::jsonb,
      previous_prompt          TEXT,
      previous_parsed_intent   JSONB,
      previous_schedule_cron   TEXT,
      next_prompt              TEXT,
      next_parsed_intent       JSONB,
      next_schedule_cron       TEXT,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_agent_instruction_updates_agent
      ON agent_instruction_updates(agent_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_agent_instruction_updates_message
      ON agent_instruction_updates(source_message_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS agent_instruction_updates;
  `);
};

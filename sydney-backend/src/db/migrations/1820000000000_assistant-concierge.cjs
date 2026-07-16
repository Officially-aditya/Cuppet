exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE assistant_memories (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      canonical_key       TEXT NOT NULL,
      memory_type         TEXT NOT NULL
                            CHECK (memory_type IN ('preference', 'constraint', 'project', 'profile_fact')),
      value               JSONB NOT NULL,
      confidence          NUMERIC(4, 3) NOT NULL DEFAULT 1,
      reinforcement_count INTEGER NOT NULL DEFAULT 1,
      status              TEXT NOT NULL DEFAULT 'candidate'
                            CHECK (status IN ('candidate', 'confirmed', 'dismissed')),
      source_message_ids  UUID[] NOT NULL DEFAULT '{}',
      confirmation_shown_at TIMESTAMPTZ,
      last_accessed_at    TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, canonical_key)
    );

    CREATE INDEX idx_assistant_memories_confirmed
      ON assistant_memories(user_id, updated_at DESC)
      WHERE status = 'confirmed';

    CREATE TRIGGER trg_assistant_memories_updated_at
      BEFORE UPDATE ON assistant_memories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TABLE assistant_pending_actions (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assistant_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      target_agent_id   UUID REFERENCES agents(id) ON DELETE CASCADE,
      source_message_id UUID REFERENCES agent_messages(id) ON DELETE CASCADE,
      action_type       TEXT NOT NULL
                          CHECK (action_type IN ('delete_agent', 'forget_everything', 'confirm_memory')),
      payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
      expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
      consumed_at       TIMESTAMPTZ,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_assistant_pending_actions_active
      ON assistant_pending_actions(user_id, assistant_id, created_at DESC)
      WHERE consumed_at IS NULL;

    CREATE TABLE assistant_agent_action_audits (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assistant_id      UUID REFERENCES agents(id) ON DELETE SET NULL,
      target_agent_id   UUID,
      source_message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
      action            TEXT NOT NULL,
      status            TEXT NOT NULL,
      detail            JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_assistant_agent_action_audits_user
      ON assistant_agent_action_audits(user_id, created_at DESC);

    CREATE TABLE message_attachments (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id        UUID NOT NULL REFERENCES agent_messages(id) ON DELETE CASCADE,
      uploaded_file_id  UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
      user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name              TEXT NOT NULL,
      mime_type         TEXT NOT NULL,
      size              INTEGER NOT NULL,
      extracted_context TEXT,
      analysis_status   TEXT NOT NULL DEFAULT 'pending'
                          CHECK (analysis_status IN ('pending', 'complete', 'failed', 'unsupported')),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(message_id, uploaded_file_id)
    );

    CREATE INDEX idx_message_attachments_message
      ON message_attachments(message_id, created_at);
    CREATE INDEX idx_message_attachments_user
      ON message_attachments(user_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS message_attachments;
    DROP TABLE IF EXISTS assistant_agent_action_audits;
    DROP TABLE IF EXISTS assistant_pending_actions;
    DROP TABLE IF EXISTS assistant_memories;
  `);
};

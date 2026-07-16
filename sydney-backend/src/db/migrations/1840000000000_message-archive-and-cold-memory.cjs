exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX idx_agent_messages_retention
      ON agent_messages(created_at, user_id, agent_id);

    CREATE TABLE assistant_memory_digests (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      summary TEXT NOT NULL DEFAULT '',
      item_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (jsonb_typeof(items) = 'array'),
      CHECK (item_count >= 0)
    );

    CREATE TRIGGER trg_assistant_memory_digests_updated_at
      BEFORE UPDATE ON assistant_memory_digests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TABLE message_archive_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT NOT NULL DEFAULT 'disabled'
        CHECK (status IN ('disabled', 'authorizing', 'active', 'action_required', 'disconnected')),
      drive_folder_id TEXT,
      drive_folder_link TEXT,
      last_success_at TIMESTAMPTZ,
      error_code TEXT,
      enabled_at TIMESTAMPTZ,
      warning_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TRIGGER trg_message_archive_settings_updated_at
      BEFORE UPDATE ON message_archive_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TABLE message_archive_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      message_date DATE NOT NULL,
      part INTEGER NOT NULL CHECK (part > 0),
      stable_key TEXT NOT NULL,
      drive_file_id TEXT,
      drive_file_name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0 CHECK (message_count >= 0),
      byte_count INTEGER NOT NULL DEFAULT 0 CHECK (byte_count >= 0),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'uploading', 'uploaded', 'failed', 'missing', 'invalid')),
      error_code TEXT,
      next_attempt_at TIMESTAMPTZ,
      archived_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, stable_key),
      UNIQUE(user_id, agent_id, message_date, part)
    );

    CREATE INDEX idx_message_archive_batches_scan
      ON message_archive_batches(user_id, agent_id, message_date DESC, part DESC);

    CREATE TABLE message_archive_entries (
      message_id UUID PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      batch_id UUID NOT NULL REFERENCES message_archive_batches(id) ON DELETE CASCADE,
      content_checksum TEXT NOT NULL,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_message_archive_entries_batch
      ON message_archive_entries(batch_id);

    CREATE TABLE message_archive_failure_receipts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
      message_date DATE NOT NULL,
      message_count INTEGER NOT NULL CHECK (message_count > 0),
      error_code TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, agent_id, message_date, error_code)
    );

    CREATE INDEX idx_message_archive_failures_user
      ON message_archive_failure_receipts(user_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS message_archive_failure_receipts;
    DROP TABLE IF EXISTS message_archive_entries;
    DROP TABLE IF EXISTS message_archive_batches;
    DROP TABLE IF EXISTS message_archive_settings;
    DROP TABLE IF EXISTS assistant_memory_digests;
    DROP INDEX IF EXISTS idx_agent_messages_retention;
  `);
};

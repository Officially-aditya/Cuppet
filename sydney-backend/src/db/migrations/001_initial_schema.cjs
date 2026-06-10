exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TABLE users (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
      image           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TABLE sessions (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ NOT NULL,
      ip_address  TEXT,
      user_agent  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_sessions_token ON sessions(token);
    CREATE INDEX idx_sessions_user_id ON sessions(user_id);

    CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TABLE accounts (
      id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id               TEXT NOT NULL,
      provider_id              TEXT NOT NULL,
      access_token             TEXT,
      refresh_token            TEXT,
      access_token_expires_at  TIMESTAMPTZ,
      refresh_token_expires_at TIMESTAMPTZ,
      scope                    TEXT,
      id_token                 TEXT,
      password                 TEXT,
      created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_accounts_user_id ON accounts(user_id);
    CREATE UNIQUE INDEX idx_accounts_provider_account
      ON accounts(provider_id, account_id);

    CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TABLE verifications (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      identifier  TEXT NOT NULL,
      value       TEXT NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_verifications_identifier ON verifications(identifier);

    CREATE TRIGGER trg_verifications_updated_at
    BEFORE UPDATE ON verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TABLE connector_tokens (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connector_id       TEXT NOT NULL,
      access_token_enc   TEXT NOT NULL,
      refresh_token_enc  TEXT NOT NULL,
      token_expires_at   TIMESTAMPTZ NOT NULL,
      scopes             TEXT[] NOT NULL DEFAULT '{}',
      status             TEXT NOT NULL DEFAULT 'connected'
                           CHECK (status IN ('connected', 'disconnected')),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, connector_id)
    );

    CREATE INDEX idx_connector_tokens_user ON connector_tokens(user_id);

    CREATE TRIGGER trg_connector_tokens_updated_at
    BEFORE UPDATE ON connector_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TABLE agents (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name             TEXT NOT NULL,
      avatar           TEXT NOT NULL,
      prompt           TEXT NOT NULL,
      parsed_intent    JSONB NOT NULL DEFAULT '{}'::jsonb,
      connector_ids    TEXT[] NOT NULL DEFAULT '{}',
      schedule_cron    TEXT,
      is_assistant     BOOLEAN NOT NULL DEFAULT FALSE,
      status           TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'paused', 'error')),
      safety_level     TEXT NOT NULL DEFAULT 'read'
                         CHECK (safety_level IN ('read', 'suggest', 'act')),
      last_message_at  TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_agents_user_id ON agents(user_id);
    CREATE INDEX idx_agents_last_message
      ON agents(user_id, last_message_at DESC NULLS LAST);
    CREATE UNIQUE INDEX idx_agents_one_assistant_per_user
      ON agents(user_id)
      WHERE is_assistant = TRUE;

    CREATE TRIGGER trg_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    CREATE TABLE agent_messages (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id     UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role         TEXT NOT NULL CHECK (role IN ('agent', 'user', 'system')),
      content      JSONB NOT NULL,
      source_refs  JSONB,
      read_at      TIMESTAMPTZ,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_messages_agent_id
      ON agent_messages(agent_id, created_at DESC);
    CREATE INDEX idx_messages_user_unread
      ON agent_messages(user_id, read_at)
      WHERE read_at IS NULL;

    CREATE TABLE agent_runs (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at   TIMESTAMPTZ,
      status         TEXT NOT NULL
                       CHECK (status IN ('running', 'success', 'failed', 'partial', 'expired')),
      message_id     UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
      error_message  TEXT,
      tokens_used    INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_runs_agent_id
      ON agent_runs(agent_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS agent_runs;
    DROP TABLE IF EXISTS agent_messages;
    DROP TABLE IF EXISTS agents;
    DROP TABLE IF EXISTS connector_tokens;
    DROP TABLE IF EXISTS verifications;
    DROP TABLE IF EXISTS accounts;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS users;
    DROP FUNCTION IF EXISTS update_updated_at_column();
  `);
};

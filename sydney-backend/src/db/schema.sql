-- Reference schema for Sydney.
-- The executable migration lives in src/db/migrations/001_initial_schema.cjs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  image           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE verifications (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  identifier  TEXT NOT NULL,
  value       TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verifications_identifier ON verifications(identifier);

CREATE TABLE jwks (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "publicKey"   TEXT NOT NULL,
  "privateKey"  TEXT NOT NULL,
  alg           TEXT,
  crv           TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt"   TIMESTAMPTZ
);

CREATE INDEX idx_jwks_created_at
  ON jwks("createdAt" DESC);

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

CREATE TABLE agent_instruction_updates (
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

CREATE INDEX idx_agent_instruction_updates_agent
  ON agent_instruction_updates(agent_id, created_at DESC);
CREATE INDEX idx_agent_instruction_updates_message
  ON agent_instruction_updates(source_message_id);

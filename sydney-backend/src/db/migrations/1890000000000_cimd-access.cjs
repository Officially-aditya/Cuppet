exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE agents
      ADD COLUMN access_refs JSONB NOT NULL DEFAULT '[]'::jsonb;

    ALTER TABLE agent_config_revisions
      DROP CONSTRAINT IF EXISTS agent_config_revisions_definition_check;
    ALTER TABLE agent_config_revisions
      DROP CONSTRAINT IF EXISTS agent_config_revisions_check;
    ALTER TABLE agent_config_revisions
      ADD CONSTRAINT agent_config_revisions_schema_version_check
      CHECK ((definition->>'schema_version')::integer IN (1, 2));

    CREATE TABLE access_connections (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id          TEXT NOT NULL,
      provider_kind        TEXT NOT NULL CHECK (provider_kind IN ('native', 'mcp')),
      external_account_id  TEXT,
      account_label        TEXT,
      endpoint             TEXT,
      capabilities         TEXT[] NOT NULL DEFAULT '{}',
      metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
      status               TEXT NOT NULL DEFAULT 'connected'
                             CHECK (status IN ('connected', 'disconnected', 'action_required')),
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, provider_id, external_account_id)
    );

    CREATE INDEX idx_access_connections_user
      ON access_connections(user_id, updated_at DESC);
    CREATE INDEX idx_access_connections_provider
      ON access_connections(provider_id, status);

    CREATE TABLE access_connection_credentials (
      connection_id       UUID PRIMARY KEY REFERENCES access_connections(id) ON DELETE CASCADE,
      access_token_enc    TEXT NOT NULL,
      refresh_token_enc   TEXT,
      token_expires_at    TIMESTAMPTZ NOT NULL,
      scopes              TEXT[] NOT NULL DEFAULT '{}',
      metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE access_oauth_transactions (
      id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      state_hash             TEXT NOT NULL UNIQUE,
      user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id            TEXT NOT NULL,
      callback_scheme        TEXT NOT NULL,
      redirect_uri           TEXT NOT NULL,
      code_verifier_enc      TEXT NOT NULL,
      authorization_endpoint TEXT NOT NULL,
      token_endpoint         TEXT NOT NULL,
      issuer                 TEXT,
      resource               TEXT,
      status                 TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      connection_id          UUID REFERENCES access_connections(id) ON DELETE SET NULL,
      expires_at             TIMESTAMPTZ NOT NULL,
      completed_at           TIMESTAMPTZ,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_access_oauth_transactions_user
      ON access_oauth_transactions(user_id, created_at DESC);

    CREATE TABLE access_tool_snapshots (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id  UUID NOT NULL REFERENCES access_connections(id) ON DELETE CASCADE,
      tool_name      TEXT NOT NULL,
      description    TEXT,
      input_schema   JSONB NOT NULL DEFAULT '{}'::jsonb,
      annotations    JSONB NOT NULL DEFAULT '{}'::jsonb,
      observed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(connection_id, tool_name)
    );

    CREATE INDEX idx_access_tool_snapshots_connection
      ON access_tool_snapshots(connection_id, tool_name);

    CREATE TABLE access_resource_snapshots (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id  UUID NOT NULL REFERENCES access_connections(id) ON DELETE CASCADE,
      resource_uri   TEXT NOT NULL,
      name           TEXT,
      description    TEXT,
      mime_type      TEXT,
      observed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(connection_id, resource_uri)
    );

    CREATE TABLE access_grants (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connection_id      UUID NOT NULL REFERENCES access_connections(id) ON DELETE CASCADE,
      agent_id           UUID REFERENCES agents(id) ON DELETE CASCADE,
      capability         TEXT NOT NULL,
      approval_policy    TEXT NOT NULL DEFAULT 'read_only'
                           CHECK (approval_policy IN ('read_only', 'suggest', 'explicit')),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, connection_id, agent_id, capability)
    );

    CREATE UNIQUE INDEX idx_access_grants_scope
      ON access_grants(user_id, connection_id, capability,
                       COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid));

    CREATE TABLE access_request_continuations (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id           UUID REFERENCES agents(id) ON DELETE CASCADE,
      request_hash       TEXT NOT NULL,
      requirements       JSONB NOT NULL DEFAULT '[]'::jsonb,
      status             TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'resumed', 'expired', 'cancelled')),
      expires_at         TIMESTAMPTZ NOT NULL,
      resumed_at         TIMESTAMPTZ,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE UNIQUE INDEX idx_access_continuations_request
      ON access_request_continuations(user_id, request_hash);

    CREATE INDEX idx_access_continuations_user
      ON access_request_continuations(user_id, status, expires_at);

    CREATE TRIGGER trg_access_connections_updated_at
      BEFORE UPDATE ON access_connections
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER trg_access_connection_credentials_updated_at
      BEFORE UPDATE ON access_connection_credentials
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    CREATE TRIGGER trg_access_grants_updated_at
      BEFORE UPDATE ON access_grants
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_access_grants_updated_at ON access_grants;
    DROP TRIGGER IF EXISTS trg_access_connection_credentials_updated_at ON access_connection_credentials;
    DROP TRIGGER IF EXISTS trg_access_connections_updated_at ON access_connections;
    DROP INDEX IF EXISTS idx_access_continuations_request;
    DROP INDEX IF EXISTS idx_access_grants_scope;
    DROP TABLE IF EXISTS access_request_continuations;
    DROP TABLE IF EXISTS access_grants;
    DROP TABLE IF EXISTS access_resource_snapshots;
    DROP TABLE IF EXISTS access_tool_snapshots;
    DROP TABLE IF EXISTS access_oauth_transactions;
    DROP TABLE IF EXISTS access_connection_credentials;
    DROP TABLE IF EXISTS access_connections;
    ALTER TABLE agents DROP COLUMN IF EXISTS access_refs;
    ALTER TABLE agent_config_revisions
      DROP CONSTRAINT IF EXISTS agent_config_revisions_schema_version_check;
    ALTER TABLE agent_config_revisions
      ADD CONSTRAINT agent_config_revisions_definition_check
      CHECK ((definition->>'schema_version')::integer = 1);
  `);
};

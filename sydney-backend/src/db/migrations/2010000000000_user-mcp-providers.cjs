exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE user_mcp_providers (
      id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id            TEXT NOT NULL UNIQUE,
      display_name           TEXT NOT NULL,
      description            TEXT NOT NULL DEFAULT '',
      icon_name              TEXT NOT NULL DEFAULT 'Extension',
      category               TEXT NOT NULL DEFAULT 'CUSTOM MCP',
      endpoint               TEXT NOT NULL,
      capabilities           TEXT[] NOT NULL DEFAULT '{}',
      allowed_tools          TEXT[] NOT NULL DEFAULT '{}',
      oauth_scopes           TEXT[] NOT NULL DEFAULT '{}',
      authorization_endpoint TEXT,
      token_endpoint         TEXT,
      issuer                 TEXT,
      resource               TEXT,
      created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_user_mcp_providers_user
      ON user_mcp_providers(user_id, updated_at DESC);

    CREATE INDEX idx_user_mcp_providers_endpoint
      ON user_mcp_providers(user_id, endpoint);

    CREATE TRIGGER trg_user_mcp_providers_updated_at
      BEFORE UPDATE ON user_mcp_providers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_user_mcp_providers_updated_at ON user_mcp_providers;
    DROP INDEX IF EXISTS idx_user_mcp_providers_endpoint;
    DROP INDEX IF EXISTS idx_user_mcp_providers_user;
    DROP TABLE IF EXISTS user_mcp_providers;
  `);
};

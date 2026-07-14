exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE connector_installations (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connector_id         TEXT NOT NULL,
      external_account_id  TEXT NOT NULL,
      external_account_name TEXT,
      metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, connector_id)
    );

    CREATE INDEX idx_connector_installations_external
      ON connector_installations(connector_id, external_account_id);

    CREATE TABLE inbound_events (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source                TEXT NOT NULL,
      external_event_id     TEXT NOT NULL,
      event_type            TEXT NOT NULL,
      external_account_id   TEXT NOT NULL,
      subject_id            TEXT,
      payload               JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at           TIMESTAMPTZ NOT NULL,
      received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(source, external_event_id)
    );

    CREATE INDEX idx_inbound_events_account
      ON inbound_events(source, external_account_id, occurred_at DESC);

    CREATE TABLE provider_subscriptions (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      connector_id         TEXT NOT NULL,
      channel_id           TEXT NOT NULL UNIQUE,
      channel_token_hash   TEXT NOT NULL,
      resource_id          TEXT,
      resource_uri         TEXT,
      expires_at           TIMESTAMPTZ NOT NULL,
      metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_provider_subscriptions_renewal
      ON provider_subscriptions(connector_id, expires_at);

    CREATE TABLE event_deliveries (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id        UUID NOT NULL REFERENCES inbound_events(id) ON DELETE CASCADE,
      agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      status          TEXT NOT NULL
                       CHECK (status IN ('queued', 'delivered', 'suppressed', 'failed')),
      reason          TEXT,
      run_id          UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
      message_id      UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(event_id, agent_id)
    );

    CREATE INDEX idx_event_deliveries_agent
      ON event_deliveries(agent_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS event_deliveries;
    DROP TABLE IF EXISTS provider_subscriptions;
    DROP TABLE IF EXISTS inbound_events;
    DROP TABLE IF EXISTS connector_installations;
  `);
};

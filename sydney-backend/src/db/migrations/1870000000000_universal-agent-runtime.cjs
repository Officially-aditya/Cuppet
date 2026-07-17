exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE agent_config_revisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK (revision > 0),
      definition JSONB NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(agent_id, revision),
      CHECK ((definition->>'schema_version')::integer = 1)
    );

    CREATE INDEX idx_agent_config_revisions_agent
      ON agent_config_revisions(agent_id, revision DESC);

    CREATE TABLE agent_config_heads (
      agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
      revision_id UUID NOT NULL UNIQUE
        REFERENCES agent_config_revisions(id) ON DELETE CASCADE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE agent_runtime_states (
      agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
      state JSONB NOT NULL DEFAULT
        '{"history":{},"topics_covered":[],"current_chunk":0}'::jsonb,
      version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (jsonb_typeof(state->'history') = 'object'),
      CHECK (jsonb_typeof(state->'topics_covered') = 'array'),
      CHECK (jsonb_typeof(state->'current_chunk') = 'number')
    );

    ALTER TABLE agent_runs
      ADD COLUMN config_revision UUID
        REFERENCES agent_config_revisions(id) ON DELETE CASCADE;

    CREATE INDEX idx_agent_runs_config_revision
      ON agent_runs(config_revision);

    CREATE OR REPLACE FUNCTION reject_agent_revision_update()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'agent_config_revisions are immutable';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_agent_config_revisions_immutable
      BEFORE UPDATE ON agent_config_revisions
      FOR EACH ROW EXECUTE FUNCTION reject_agent_revision_update();

    COMMENT ON COLUMN agents.parsed_intent IS
      'Assistant-only and legacy-cutover metadata. Configured agent compatibility views are computed from revisions and runtime state.';
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS trg_agent_config_revisions_immutable
      ON agent_config_revisions;
    DROP FUNCTION IF EXISTS reject_agent_revision_update();
    DROP INDEX IF EXISTS idx_agent_runs_config_revision;
    ALTER TABLE agent_runs DROP COLUMN IF EXISTS config_revision;
    DROP TABLE IF EXISTS agent_runtime_states;
    DROP TABLE IF EXISTS agent_config_heads;
    DROP TABLE IF EXISTS agent_config_revisions;
  `);
};

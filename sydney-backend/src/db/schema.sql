-- Reference schema for Sydney.
-- The executable migration lives in src/db/migrations/001_initial_schema.cjs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  image           TEXT,
  avatar          SMALLINT CHECK (avatar BETWEEN 1 AND 9),
  time_zone       TEXT,
  follow_device_time_zone BOOLEAN NOT NULL DEFAULT TRUE,
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
                       CHECK (status IN ('connected', 'disconnected', 'action_required')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, connector_id)
);

CREATE INDEX idx_connector_tokens_user ON connector_tokens(user_id);

CREATE TABLE connector_statuses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connector_id  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'disconnected'
                  CHECK (status IN ('connected', 'disconnected', 'action_required')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, connector_id)
);

CREATE INDEX idx_connector_statuses_user
  ON connector_statuses(user_id);

CREATE TABLE agents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  avatar           TEXT NOT NULL,
  prompt           TEXT NOT NULL,
  parsed_intent    JSONB NOT NULL DEFAULT '{}'::jsonb,
  connector_ids    TEXT[] NOT NULL DEFAULT '{}',
  access_refs      JSONB NOT NULL DEFAULT '[]'::jsonb,
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

CREATE TABLE agent_config_revisions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  revision    INTEGER NOT NULL CHECK (revision > 0),
  definition  JSONB NOT NULL,
  created_by  TEXT NOT NULL DEFAULT 'system',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, revision),
  CONSTRAINT agent_config_revisions_schema_version_check
    CHECK ((definition->>'schema_version')::integer IN (1, 2))
);

CREATE INDEX idx_agent_config_revisions_agent
  ON agent_config_revisions(agent_id, revision DESC);

CREATE TABLE agent_config_heads (
  agent_id     UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  revision_id  UUID NOT NULL UNIQUE
                 REFERENCES agent_config_revisions(id) ON DELETE CASCADE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_runtime_states (
  agent_id    UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  state       JSONB NOT NULL DEFAULT
                '{"history":{},"topics_covered":[],"current_chunk":0}'::jsonb,
  version     INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(state->'history') = 'object'),
  CHECK (jsonb_typeof(state->'topics_covered') = 'array'),
  CHECK (jsonb_typeof(state->'current_chunk') = 'number')
);

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
CREATE INDEX idx_agent_messages_retention
  ON agent_messages(created_at, user_id, agent_id);

-- Assistant-only durable memory. Candidate rows are never injected into a
-- prompt until the user confirms them.
CREATE TABLE assistant_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  canonical_key TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'constraint', 'project', 'profile_fact')),
  value JSONB NOT NULL,
  confidence NUMERIC(4, 3) NOT NULL DEFAULT 1,
  reinforcement_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'confirmed', 'dismissed')),
  source_message_ids UUID[] NOT NULL DEFAULT '{}',
  confirmation_shown_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, canonical_key)
);

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

CREATE TABLE agent_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  queue_job_id   TEXT UNIQUE,
  config_revision UUID REFERENCES agent_config_revisions(id) ON DELETE CASCADE,
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

CREATE TABLE connector_installations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connector_id          TEXT NOT NULL,
  external_account_id   TEXT NOT NULL,
  external_account_name TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, connector_id)
);

CREATE INDEX idx_connector_installations_external
  ON connector_installations(connector_id, external_account_id);

CREATE TABLE inbound_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source              TEXT NOT NULL,
  external_event_id   TEXT NOT NULL,
  event_type          TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  subject_id          TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at         TIMESTAMPTZ NOT NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, external_event_id)
);

CREATE INDEX idx_inbound_events_account
  ON inbound_events(source, external_account_id, occurred_at DESC);

CREATE TABLE provider_subscriptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connector_id       TEXT NOT NULL,
  channel_id         TEXT NOT NULL UNIQUE,
  channel_token_hash TEXT NOT NULL,
  resource_id        TEXT,
  resource_uri       TEXT,
  expires_at         TIMESTAMPTZ NOT NULL,
  metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_provider_subscriptions_renewal
  ON provider_subscriptions(connector_id, expires_at);

CREATE TABLE event_deliveries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES inbound_events(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status      TEXT NOT NULL
               CHECK (status IN ('queued', 'delivered', 'suppressed', 'failed')),
  reason      TEXT,
  run_id      UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  message_id  UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, agent_id)
);

CREATE INDEX idx_event_deliveries_agent
  ON event_deliveries(agent_id, created_at DESC);

CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data BYTEA NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day')
);

CREATE TABLE assistant_pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assistant_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  target_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  source_message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('delete_agent', 'forget_everything', 'confirm_memory', 'select_agent', 'confirm_intent')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE assistant_agent_action_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assistant_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  target_agent_id UUID,
  source_message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES agent_messages(id) ON DELETE CASCADE,
  uploaded_file_id UUID REFERENCES uploaded_files(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  extracted_context TEXT,
  context_expires_at TIMESTAMPTZ NOT NULL,
  context_purged_at TIMESTAMPTZ,
  analysis_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (analysis_status IN ('pending', 'complete', 'failed', 'unsupported')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, uploaded_file_id)
);

CREATE TABLE llm_token_usage_windows (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  window_key         UUID NOT NULL,
  window_started_at  TIMESTAMPTZ NOT NULL,
  window_ends_at     TIMESTAMPTZ NOT NULL,
  input_tokens       BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens      BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE llm_token_reservations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_key    UUID NOT NULL,
  input_tokens  INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE personalization_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  learning_paused BOOLEAN NOT NULL DEFAULT FALSE,
  frequency TEXT NOT NULL DEFAULT 'balanced' CHECK (frequency IN ('low', 'balanced', 'high')),
  in_chat BOOLEAN NOT NULL DEFAULT TRUE,
  proactive BOOLEAN NOT NULL DEFAULT FALSE,
  push BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TIME NOT NULL DEFAULT '21:00:00',
  quiet_hours_end TIME NOT NULL DEFAULT '08:00:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE personalization_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN (
    'explicit_feedback', 'cuppet_activity', 'connected_content',
    'browser_activity', 'cross_source'
  )),
  status TEXT NOT NULL CHECK (status IN ('granted', 'revoked')),
  policy_version TEXT NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  source TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_personalization_consents_user
  ON personalization_consents(user_id, purpose, created_at DESC);

CREATE TABLE preference_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_id UUID NOT NULL REFERENCES personalization_consents(id),
  event_type TEXT NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN (
    'topic', 'source', 'format', 'timing', 'agent_type', 'capability',
    'notification_policy', 'exclusion'
  )),
  subject_key TEXT NOT NULL CHECK (char_length(subject_key) BETWEEN 1 AND 180),
  polarity SMALLINT NOT NULL CHECK (polarity IN (-1, 0, 1)),
  strength DOUBLE PRECISION NOT NULL CHECK (strength >= 0 AND strength <= 1),
  provenance_type TEXT NOT NULL,
  provenance_id TEXT,
  service_key TEXT,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_preference_events_user_time ON preference_events(user_id, occurred_at DESC);
CREATE INDEX idx_preference_events_subject ON preference_events(user_id, subject_type, subject_key);

CREATE TABLE preference_profile_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL CHECK (dimension IN (
    'topic', 'source', 'format', 'timing', 'agent_type', 'capability',
    'notification_policy', 'exclusion'
  )),
  key TEXT NOT NULL,
  weight DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  strongest_evidence_type TEXT NOT NULL,
  derived_from TEXT[] NOT NULL DEFAULT '{}',
  first_observed_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, dimension, key)
);

CREATE INDEX idx_preference_profile_user ON preference_profile_items(user_id, dimension, weight DESC);

CREATE TABLE personalization_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_personalization_outbox_pending
  ON personalization_outbox(status, available_at);

CREATE INDEX idx_personalization_outbox_processing
  ON personalization_outbox(status, processing_started_at)
  WHERE status = 'processing';

CREATE TABLE suggestion_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN (
    'agent_creation', 'agent_refinement', 'capability_connection',
    'content', 'attention_reduction'
  )),
  generator_key TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN (
    'user_pattern', 'current_context', 'agent_improvement',
    'capability_gap', 'user_interest'
  )),
  subject_type TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  reason_codes TEXT[] NOT NULL,
  evidence_summary JSONB NOT NULL DEFAULT '{}',
  score_breakdown JSONB NOT NULL DEFAULT '{}',
  relevance_score DOUBLE PRECISION NOT NULL,
  confidence_score DOUBLE PRECISION NOT NULL,
  interruption_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  consent_purposes TEXT[] NOT NULL DEFAULT '{}',
  eligible_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN (
    'candidate', 'eligible', 'suppressed', 'delivered', 'accepted',
    'dismissed', 'expired', 'superseded'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suggestion_candidates_user_status
  ON suggestion_candidates(user_id, status, eligible_after);

CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES suggestion_candidates(id),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  suggestion_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'delivered', 'accepted', 'not_now', 'dismissed', 'expired', 'failed'
  )),
  delivered_at TIMESTAMPTZ NOT NULL,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  push_sent_at TIMESTAMPTZ,
  continuation_started_at TIMESTAMPTZ,
  continuation_message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  delivery_surface TEXT NOT NULL DEFAULT 'in_chat' CHECK (
    delivery_surface IN ('in_chat', 'proactive', 'push')
  ),
  UNIQUE(candidate_id)
);

CREATE INDEX idx_suggestions_user_status ON suggestions(user_id, status, delivered_at DESC);
CREATE INDEX idx_suggestions_user_surface
  ON suggestions(user_id, delivery_surface, delivered_at DESC);
CREATE INDEX idx_suggestions_user_push
  ON suggestions(user_id, push_sent_at DESC)
  WHERE push_sent_at IS NOT NULL;

CREATE TABLE suggestion_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN (
    'topic', 'source', 'format', 'timing', 'agent_type', 'capability',
    'notification_policy', 'exclusion'
  )),
  subject_key TEXT NOT NULL CHECK (char_length(subject_key) BETWEEN 1 AND 180),
  source_suggestion_id UUID REFERENCES suggestions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, subject_type, subject_key)
);

CREATE INDEX idx_suggestion_exclusions_user
  ON suggestion_exclusions(user_id, subject_type, subject_key);

CREATE TABLE personalization_browser_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '365 days'),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_browser_connections_active_user
  ON personalization_browser_connections(user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_browser_connections_active_token
  ON personalization_browser_connections(token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX idx_browser_preference_event_dedupe
  ON preference_events(user_id, provenance_type, provenance_id,
                      subject_type, subject_key)
  WHERE provenance_type = 'browser_activity'
    AND provenance_id IS NOT NULL;

CREATE TABLE preference_vectors (
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  namespace         TEXT NOT NULL,
  vector            JSONB NOT NULL,
  source_item_count INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, namespace)
);

CREATE TABLE personalization_product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  suggestion_id UUID REFERENCES suggestions(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_personalization_product_events_time
  ON personalization_product_events(event_name, occurred_at DESC);
CREATE INDEX idx_personalization_product_events_user
  ON personalization_product_events(user_id, occurred_at DESC);

CREATE TABLE message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES agent_messages(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL,
  subject_type TEXT,
  subject_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, message_id, feedback_type)
);

CREATE TABLE product_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic      TEXT NOT NULL CHECK (topic IN (
    'product_idea',
    'something_went_wrong',
    'general_feedback'
  )),
  message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX product_feedback_user_time_idx
  ON product_feedback(user_id, created_at DESC);

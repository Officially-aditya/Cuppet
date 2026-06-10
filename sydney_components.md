# Sydney — Component Breakdown
### Internal alias: Sydney | Version 1.0
### This document expands each of Sydney's three buildable components in detail.
### Every design decision is explained. Use this as your primary build reference.

---

## Overview

Sydney is built from three components. They are built in this order:

```
1. Node.js Backend     → the brain. Built first because everything depends on it.
2. Flutter App         → the face. Built second, talks to the backend.
3. Website             → the front door. Built last, mostly static.
```

They share one backend. The Flutter app and the website both call the same
Node.js API. There is no duplication of business logic. The backend owns
all intelligence, all data, all agent execution. The frontend components
are purely interfaces.

```
┌──────────────┐     ┌──────────────┐
│  Flutter App │     │   Website    │
│  (Android)   │     │  (Next.js)   │
└──────┬───────┘     └──────┬───────┘
       │                    │
       └─────────┬──────────┘
                 │ REST + WebSocket
      ┌──────────▼──────────┐
      │   Node.js Backend   │
      │   (Fastify)         │
      └──────────┬──────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
 PostgreSQL    Redis       MCP Servers
              BullMQ      (Gmail, Slack,
                           Drive, Search)
```

---

## Component 1 — Node.js Backend

### What it is
The entire brain of Sydney. Every piece of intelligence, every agent
execution, every token, every message — lives here. The Flutter app
and website are dumb clients. They display what the backend tells them.

### Why it is built first
Nothing else works without it. The Flutter app has no data to show.
The website has nothing to link to. Auth, agents, messages, scheduling
— all of it lives in the backend. Build this first, test it with curl
and Postman before writing a single line of Flutter.

### Why Node.js
**Design decision:** The official MCP TypeScript SDK is Anthropic-maintained,
the most complete MCP implementation available, and written in TypeScript.
Using Node.js means the backend API, the MCP client, the agent runtime,
and the job workers all share one language, one type system, and one
dependency tree. No serialisation boundary between layers. No Python
subprocess calls. No language mismatch bugs. Everything is TypeScript
end to end.

### Why Fastify over Express
**Design decision:** Fastify is 2–3× faster than Express in benchmarks,
has native TypeScript support without extra setup, enforces JSON schema
validation on every route (catches malformed requests before they hit
business logic), and has faster cold starts on Railway. Express is
familiar but Fastify is strictly better for a new project with no
existing Express debt.

---

### 1.1 Project structure

```
sydney-backend/
├── src/
│   ├── index.ts              → entry point, starts Fastify
│   ├── config.ts             → environment variables, validated at start
│   ├── db/
│   │   ├── index.ts          → pg Pool initialisation
│   │   ├── migrations/       → node-pg-migrate SQL files
│   │   └── schema.sql        → reference schema (not run directly)
│   ├── auth/
│   │   ├── index.ts          → Better Auth initialisation
│   │   ├── middleware.ts      → JWT verification middleware
│   │   └── routes.ts         → /auth/* routes
│   ├── agents/
│   │   ├── index.ts          → agent CRUD
│   │   ├── parser.ts         → intent parsing via Haiku
│   │   ├── scheduler.ts      → BullMQ repeatable job registration
│   │   └── routes.ts         → /agents/* routes
│   ├── messages/
│   │   ├── index.ts          → message read/write
│   │   ├── threads.ts        → thread retrieval, pagination
│   │   └── routes.ts         → /messages/* routes
│   ├── chat/
│   │   ├── index.ts          → chat routing (connected vs general)
│   │   ├── intent.ts         → detects if message needs connectors
│   │   └── routes.ts         → /chat/* routes
│   ├── connectors/
│   │   ├── index.ts          → connector registry
│   │   ├── gmail.ts          → Gmail OAuth flow
│   │   ├── slack.ts          → Slack OAuth flow
│   │   ├── drive.ts          → Google Drive OAuth flow
│   │   └── routes.ts         → /connectors/* routes
│   ├── vault/
│   │   ├── index.ts          → encrypt, decrypt, getValidToken
│   │   └── refresh.ts        → per-provider token refresh logic
│   ├── mcp/
│   │   ├── client.ts         → MCP client factory
│   │   └── servers/
│   │       ├── gmail.ts      → Gmail MCP server wrapper
│   │       ├── slack.ts      → Slack MCP server wrapper
│   │       ├── drive.ts      → Drive MCP server wrapper
│   │       └── search.ts     → Anthropic web search wrapper
│   ├── workers/
│   │   ├── index.ts          → BullMQ worker entry point
│   │   ├── executor.ts       → agent job execution logic
│   │   └── templates/        → per-agent output builders
│   │       ├── news.ts
│   │       ├── email-digest.ts
│   │       ├── slack-digest.ts
│   │       └── study-plan.ts
│   ├── queue/
│   │   ├── index.ts          → BullMQ queue and scheduler init
│   │   └── producer.ts       → enqueue agent jobs
│   ├── notifications/
│   │   └── fcm.ts            → Firebase Cloud Messaging send
│   └── api/
│       └── index.ts          → registers all route plugins
├── worker.ts                 → worker entry point (different from api)
├── docker-compose.yml        → local dev environment
├── Dockerfile                → production container
├── package.json
└── tsconfig.json
```

**Design decision — two entry points:**
`src/index.ts` starts the API server. `worker.ts` starts BullMQ workers.
Same codebase, different processes. On Railway they deploy as separate
services from the same repo using different start commands. This means
workers can be scaled independently of the API. If agent volume spikes,
scale workers without touching the API server.

---

### 1.2 Database — PostgreSQL

**Design decision — no ORM, no Supabase:**
ORMs (Prisma, TypeORM) add abstraction that costs performance and hides
what SQL is actually being executed. At Sydney's scale this matters — agent
queries run thousands of times per day. Direct `pg` queries are explicit,
fast, and debuggable. Every query is visible. No magic.

Supabase adds a $25–100/month cost, wraps Postgres in an abstraction layer,
and provides auth and storage that Better Auth and the vault already cover.
Supabase's value is speed of initial setup. That speed isn't worth the
ongoing cost and vendor dependency.

**Migration strategy:**
`node-pg-migrate` runs SQL files in sequence. Every schema change is a
numbered migration file. Migrations run on deploy. Schema is always in sync.
No manual database changes ever.

**Full schema with rationale:**

```sql
-- ================================================================
-- USERS
-- ================================================================
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Design decision: UUID not integer PKs throughout.
-- UUIDs are safe to expose in APIs without leaking row counts.
-- gen_random_uuid() is built into Postgres 13+, no extension needed.

-- ================================================================
-- SESSIONS (managed by Better Auth)
-- ================================================================
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,         -- SHA-256 of the actual token
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Design decision: store token hash not token.
-- If database is breached, raw tokens are not exposed.
-- SHA-256 is fast to compute on every request.

-- ================================================================
-- CONNECTOR TOKENS (the vault)
-- ================================================================
CREATE TABLE connector_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  connector_id      TEXT NOT NULL,   -- 'gmail' | 'slack' | 'drive'
  access_token_enc  TEXT NOT NULL,   -- AES-256-GCM encrypted, base64
  refresh_token_enc TEXT NOT NULL,   -- AES-256-GCM encrypted, base64
  token_expires_at  TIMESTAMPTZ NOT NULL,
  scopes            TEXT[],          -- granted OAuth scopes
  status            TEXT DEFAULT 'connected', -- 'connected' | 'disconnected'
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, connector_id)
);

CREATE INDEX idx_connector_tokens_user ON connector_tokens(user_id);

-- Design decision: UNIQUE(user_id, connector_id).
-- One row per user per connector. Reconnecting Gmail upserts
-- the existing row rather than creating duplicates.
-- ON CONFLICT ... DO UPDATE handles reconnection cleanly.

-- Design decision: store encrypted tokens in Postgres not a secrets manager.
-- AWS Secrets Manager / HashiCorp Vault add latency and cost.
-- AES-256-GCM with a key loaded from environment is sufficient security
-- for this use case and keeps the stack simple. The key itself
-- never touches the database.

-- ================================================================
-- AGENTS
-- ================================================================
CREATE TABLE agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,         -- "Tech News", "Email Digest"
  avatar          TEXT NOT NULL,         -- emoji: "📰" or icon id
  prompt          TEXT NOT NULL,         -- original user prompt
  parsed_intent   JSONB NOT NULL,        -- structured intent from Haiku
  connector_ids   TEXT[] DEFAULT '{}',   -- required connectors
  schedule_cron   TEXT,                  -- null for on-demand agents
  is_assistant    BOOLEAN DEFAULT FALSE, -- true for pre-installed contact
  status          TEXT DEFAULT 'active', -- 'active'|'paused'|'error'
  safety_level    TEXT DEFAULT 'read',   -- 'read'|'suggest'|'act'
  last_message_at TIMESTAMPTZ,           -- for inbox sort order
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_agents_last_message ON agents(user_id, last_message_at DESC);

-- Design decision: JSONB for parsed_intent.
-- Agent intent has variable structure depending on type.
-- A study agent intent has exam_date, subjects, phase.
-- A news agent intent has topics, sources.
-- JSONB stores this without forcing a rigid column structure.
-- Indexed JSONB fields can be queried efficiently when needed.

-- Design decision: last_message_at indexed with user_id.
-- The inbox query is: "give me all agents for this user,
-- sorted by most recent message." This composite index
-- makes that query a single index scan — fast at any scale.

-- ================================================================
-- AGENT MESSAGES
-- ================================================================
CREATE TABLE agent_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID REFERENCES agents(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,     -- 'agent' | 'user' | 'system'
  content     JSONB NOT NULL,    -- structured template payload
  source_refs JSONB,             -- links, email IDs, doc refs
  read_at     TIMESTAMPTZ,       -- null = unread
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_agent_id ON agent_messages(agent_id, created_at DESC);
CREATE INDEX idx_messages_user_unread ON agent_messages(user_id, read_at)
  WHERE read_at IS NULL;

-- Design decision: JSONB content not TEXT.
-- Messages are not plain text — they are typed template payloads.
-- A progress_tracker message contains day_current, progress_bars,
-- actions. Storing as JSONB means the backend can query into message
-- content if needed (e.g. find all messages where agent completed today).
-- Flutter receives this JSONB and renders the right widget.

-- Design decision: single agent_messages table for everything.
-- Agent outputs, user replies, system messages, assistant chat —
-- all stored here with role distinguishing them.
-- This means one query retrieves a full conversation thread.
-- No joins across multiple tables to render a chat thread.

-- Design decision: partial index on unread messages.
-- idx_messages_user_unread only indexes rows where read_at IS NULL.
-- As messages get read, they fall out of this index automatically.
-- The unread count query (used for inbox badges) stays fast
-- because it only scans unread rows, not the full message history.

-- ================================================================
-- AGENT RUNS (execution history)
-- ================================================================
CREATE TABLE agent_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     UUID REFERENCES agents(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status       TEXT NOT NULL,   -- 'success'|'failed'|'partial'|'expired'
  message_id   UUID REFERENCES agent_messages(id),
  error_message TEXT,
  tokens_used  INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_runs_agent_id ON agent_runs(agent_id, created_at DESC);

-- Design decision: agent_runs is internal, not shown in chat UI.
-- Users see outputs as messages. Engineers see runs for debugging.
-- This separation keeps the UI clean while giving full observability
-- into what every agent did, when, how long it took, and how many tokens.
-- tokens_used feeds into cost monitoring and per-user usage analytics.
```

---

### 1.3 Authentication — Better Auth

**Design decision — Better Auth over Supabase Auth, Auth0, Clerk:**
All managed auth providers charge per monthly active user — typically
$0.02–0.05/MAU. At 10,000 users that's $200–500/month just for auth.
Better Auth is open source, self-hosted as a library inside the backend,
zero per-user cost, TypeScript-native, and ships with the exact plugins
needed: JWT, OAuth 2.1 provider, Agent Auth, and generic OAuth for
connector flows.

**Setup:**

```typescript
// src/auth/index.ts
import { betterAuth } from 'better-auth';
import { jwt, oauthProvider, agentAuth, genericOAuth } from 'better-auth/plugins';
import { pool } from '../db';

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET!, // min 32 chars, random
  emailAndPassword: { enabled: true },
  plugins: [
    jwt({
      jwt: {
        expirationTime: '15m',
        issuer: 'sydney-api'
      },
      refreshToken: {
        expirationTime: '30d'
      }
    }),
    oauthProvider({
      loginPage: '/sign-in',
      consentPage: '/consent'
    }),
    agentAuth(),
    genericOAuth({
      config: [
        {
          providerId: 'google',
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
          tokenUrl: 'https://oauth2.googleapis.com/token',
          // Note: connector OAuth is separate from user sign-in OAuth
          // This config is for initiating connector flows only
        }
      ]
    })
  ]
});
```

**JWT middleware — applied to every protected route:**

```typescript
// src/auth/middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { auth } from './index';

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) return reply.status(401).send({ error: 'Unauthorized' });

  const session = await auth.verifyToken(token);
  if (!session) return reply.status(401).send({ error: 'Invalid token' });

  request.userId = session.userId; // attached to request for downstream use
}
```

---

### 1.4 Token vault

**Design decision — custom AES-256-GCM over Composio, HashiCorp Vault,
AWS Secrets Manager:**
All managed secret stores add latency (network call per token read),
cost ($0.05 per 10,000 API calls at AWS), and vendor dependency.
The vault is simple enough to build in-house: one encrypt function,
one decrypt function, one getValidToken function. Built once, runs forever,
costs nothing.

AES-256-GCM is authenticated encryption — it guarantees both confidentiality
(nobody can read the token) and integrity (nobody can tamper with it
without detection). The authentication tag (16 bytes) is stored alongside
the ciphertext and checked on every decryption. Tampered ciphertext throws
immediately.

```typescript
// src/vault/index.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { pool } from '../db';
import { sendSystemMessage } from '../notifications/fcm';

const KEY = Buffer.from(process.env.VAULT_ENCRYPTION_KEY!, 'hex');
// KEY must be exactly 32 bytes (64 hex chars)
// Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Store in environment. Never in code. Never in database. Never in logs.

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);          // 96-bit IV, unique per encryption
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();     // 128-bit auth tag
  // Layout: iv(12) || tag(16) || ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(stored: string): string {
  const buf = Buffer.from(stored, 'base64');
  const iv        = buf.subarray(0, 12);
  const tag       = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher  = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  // Throws if tag doesn't match — tampering detected
  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]).toString('utf8');
}

export const vault = {
  async store(userId: string, connectorId: string, tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // unix ms
  }): Promise<void> {
    await pool.query(`
      INSERT INTO connector_tokens
        (user_id, connector_id, access_token_enc, refresh_token_enc,
         token_expires_at, status)
      VALUES ($1, $2, $3, $4, $5, 'connected')
      ON CONFLICT (user_id, connector_id) DO UPDATE SET
        access_token_enc  = $3,
        refresh_token_enc = $4,
        token_expires_at  = $5,
        status            = 'connected',
        updated_at        = NOW()
    `, [
      userId,
      connectorId,
      encrypt(tokens.accessToken),
      encrypt(tokens.refreshToken),
      new Date(tokens.expiresAt)
    ]);
  },

  async getValidToken(userId: string, connectorId: string): Promise<string> {
    const { rows } = await pool.query(`
      SELECT * FROM connector_tokens
      WHERE user_id = $1 AND connector_id = $2 AND status = 'connected'
    `, [userId, connectorId]);

    if (!rows[0]) {
      throw new Error(`${connectorId} not connected for user ${userId}`);
    }

    const row = rows[0];
    const expiresAt = new Date(row.token_expires_at).getTime();
    const needsRefresh = Date.now() > expiresAt - 5 * 60 * 1000; // 5min buffer

    if (!needsRefresh) {
      // Token is valid — decrypt and return
      // Decrypted token is in memory only for the duration of this call
      return decrypt(row.access_token_enc);
    }

    // Refresh needed
    return this.refresh(userId, connectorId, decrypt(row.refresh_token_enc));
  },

  async refresh(
    userId: string,
    connectorId: string,
    refreshToken: string
  ): Promise<string> {
    const providers: Record<string, string> = {
      gmail: 'https://oauth2.googleapis.com/token',
      drive: 'https://oauth2.googleapis.com/token',
      slack: 'https://slack.com/api/oauth.v2.access'
    };

    try {
      const res = await fetch(providers[connectorId], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     process.env[`${connectorId.toUpperCase()}_CLIENT_ID`]!,
          client_secret: process.env[`${connectorId.toUpperCase()}_CLIENT_SECRET`]!,
          refresh_token: refreshToken,
          grant_type:    'refresh_token'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refresh failed');

      // Store new access token (refresh token typically unchanged)
      await pool.query(`
        UPDATE connector_tokens SET
          access_token_enc = $1,
          token_expires_at = $2,
          updated_at       = NOW()
        WHERE user_id = $3 AND connector_id = $4
      `, [
        encrypt(data.access_token),
        new Date(Date.now() + data.expires_in * 1000),
        userId,
        connectorId
      ]);

      return data.access_token;

    } catch (err) {
      // Mark disconnected
      await pool.query(`
        UPDATE connector_tokens SET status = 'disconnected'
        WHERE user_id = $1 AND connector_id = $2
      `, [userId, connectorId]);

      // Surface failure as a message in the agent thread
      // so user sees it, not a silent failure
      await sendSystemMessage(userId, connectorId,
        `I lost access to your ${connectorId}. Tap here to reconnect.`
      );

      throw err;
    }
  }
};
```

---

### 1.5 Intent parser

When a user types "deliver tech news at 7am daily", this function turns
that into a structured agent definition.

**Design decision — Haiku not Sonnet for intent parsing:**
Intent parsing is a classification task, not a reasoning task. The input
is a short user prompt. The output is a small JSON object. Haiku handles
this at ~100ms for a fraction of Sonnet's cost. The structured output
prompt is tight enough that Haiku never hallucinates the schema.

```typescript
// src/agents/parser.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SUPPORTED_CONNECTORS = ['gmail', 'slack', 'drive', 'web_search'];

const SYSTEM_PROMPT = `
You are an intent parser for Sydney, an AI agent platform.
The user describes what they want an agent to do in plain language.
You extract the structured intent.

Return ONLY valid JSON. No explanation. No markdown. No backticks.
Use null for fields that don't apply.

Available connectors: ${SUPPORTED_CONNECTORS.join(', ')}
Available output_templates: plain_text, progress_tracker, urgency_list,
data_summary, checklist, streak_counter, comparison, system

If the required connector is not in the available list, set
connector to null and set unsupported_connector to the name
of the connector the user mentioned.

Schedule rules:
- "every morning" or "daily" = cron "0 7 * * *" (7am daily)
- "at Xam/pm daily" = parse to correct cron
- "every friday" = cron "0 9 * * 5"
- "every week" = cron "0 9 * * 1" (Monday 9am)
- "immediately" or no schedule = null (on-demand)

Safety levels:
- read = agent only reads and summarizes data
- suggest = agent suggests actions but doesn't take them
- act = agent takes actions (Phase 3 only, default to read)
`.trim();

export interface ParsedIntent {
  name: string;                    // short agent name e.g. "Tech News"
  avatar: string;                  // single emoji
  intent: string;                  // snake_case intent type
  connector: string | null;        // primary connector or null
  connector_ids: string[];         // all required connectors
  unsupported_connector: string | null;
  action: string;                  // what the agent does
  schedule_cron: string | null;    // cron expression or null
  output_template: string;         // template type
  template_config: Record<string, boolean>;
  safety_level: 'read' | 'suggest' | 'act';
  risk_level: 'low' | 'medium' | 'high';
  permissions_needed: string[];    // human-readable list for confirmation card
}

export async function parseIntent(prompt: string): Promise<ParsedIntent> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  try {
    return JSON.parse(text) as ParsedIntent;
  } catch {
    // Fallback if Haiku returns malformed JSON (rare but possible)
    throw new Error('Failed to parse agent intent. Please rephrase.');
  }
}
```

---

### 1.6 BullMQ scheduler

**Design decision — BullMQ over cron jobs, node-cron, Agenda:**
BullMQ is backed by Redis and is battle-tested at high scale.
It gives native cron-style repeatable jobs, retry with exponential
backoff, job history, dead letter queue, concurrency limits, and
a dashboard (Bull Board) for monitoring. Node-cron runs in-process
and dies with the process. Agenda uses MongoDB (extra dependency).
BullMQ with Redis is the clear best choice for a job queue that needs
to be reliable and observable.

```typescript
// src/queue/index.ts
import { Queue, Worker, QueueScheduler } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null // required by BullMQ
});

export const agentQueue = new Queue('agent-executor', { connection });

// Schedule jitter — prevents thundering herd at popular times
// e.g. 5,000 users with 7am agents firing simultaneously
function addJitter(cronExpr: string): number {
  // Returns delay in ms — up to 10 minutes random offset
  return Math.floor(Math.random() * 10 * 60 * 1000);
}

export async function scheduleAgent(agentId: string, cronExpr: string) {
  // Remove existing schedule if any (for updates)
  await agentQueue.removeRepeatable(agentId, { pattern: cronExpr });

  await agentQueue.add(
    agentId,
    { agentId },
    {
      repeat: { pattern: cronExpr },
      jobId: agentId, // idempotent — same agent = same job
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100, // keep last 100 completed jobs
      removeOnFail: 500,     // keep last 500 failed jobs for debugging
      delay: addJitter(cronExpr) // spread load
    }
  );
}

export async function removeAgentSchedule(agentId: string, cronExpr: string) {
  await agentQueue.removeRepeatable(agentId, { pattern: cronExpr });
}
```

---

### 1.7 Agent executor (worker)

This is the heart of what Sydney does. One agent job = one complete
cycle of: fetch data → summarize → store message → push notification.

```typescript
// src/workers/executor.ts
import { Job } from 'bullmq';
import { pool } from '../db';
import { vault } from '../vault';
import { createMCPClient } from '../mcp/client';
import { summarize } from '../llm/haiku';
import { sendPush } from '../notifications/fcm';
import { buildTemplatePayload } from './templates';

export async function executeAgent(job: Job<{ agentId: string }>) {
  const { agentId } = job.data;

  // 1. Fetch agent definition
  const { rows } = await pool.query(
    'SELECT * FROM agents WHERE id = $1 AND status = $2',
    [agentId, 'active']
  );
  if (!rows[0]) return; // agent paused or deleted

  const agent = rows[0];
  const runStart = Date.now();

  // 2. Record run start
  const { rows: runRows } = await pool.query(`
    INSERT INTO agent_runs (agent_id, status) VALUES ($1, 'running')
    RETURNING id
  `, [agentId]);
  const runId = runRows[0].id;

  try {
    // 3. Get valid tokens for all required connectors
    const tokens: Record<string, string> = {};
    for (const connectorId of agent.connector_ids) {
      tokens[connectorId] = await vault.getValidToken(agent.user_id, connectorId);
      // Token lives in memory only for duration of this job
      // Never logged, never persisted outside vault
    }

    // 4. Execute via MCP
    const rawData = await fetchDataViaMCP(agent, tokens);

    // 5. Summarize with Haiku
    const { summary, templateData } = await buildTemplatePayload(
      agent.parsed_intent,
      rawData
    );

    // 6. Store as message in agent thread
    const { rows: msgRows } = await pool.query(`
      INSERT INTO agent_messages
        (agent_id, user_id, role, content, source_refs)
      VALUES ($1, $2, 'agent', $3, $4)
      RETURNING id
    `, [
      agentId,
      agent.user_id,
      JSON.stringify(templateData),
      JSON.stringify(rawData.sourceRefs || [])
    ]);
    const messageId = msgRows[0].id;

    // 7. Update agent last_message_at (for inbox sort)
    await pool.query(
      'UPDATE agents SET last_message_at = NOW() WHERE id = $1',
      [agentId]
    );

    // 8. Send FCM push notification
    await sendPush(agent.user_id, {
      title: agent.name,
      body: summary.substring(0, 120), // first 120 chars as preview
      data: { agentId, messageId }
    });

    // 9. Complete run record
    const tokensUsed = templateData.tokens_used || 0;
    await pool.query(`
      UPDATE agent_runs SET
        completed_at = NOW(),
        status       = 'success',
        message_id   = $1,
        tokens_used  = $2
      WHERE id = $3
    `, [messageId, tokensUsed, runId]);

  } catch (err) {
    // Record failure
    await pool.query(`
      UPDATE agent_runs SET
        completed_at  = NOW(),
        status        = 'failed',
        error_message = $1
      WHERE id = $2
    `, [(err as Error).message, runId]);

    // Re-throw so BullMQ retry logic kicks in
    throw err;
  }
}

async function fetchDataViaMCP(
  agent: any,
  tokens: Record<string, string>
): Promise<any> {
  const intent = agent.parsed_intent;
  let client = null;

  try {
    if (intent.connector === 'web_search') {
      client = await createMCPClient('search', null);
      return await client.callTool('brave_search', {
        query: intent.search_query || 'tech news today',
        count: 10
      });
    }

    if (intent.connector === 'gmail') {
      client = await createMCPClient('gmail', tokens.gmail);
      return await client.callTool('gmail_search', {
        query: 'is:unread',
        maxResults: 50
      });
    }

    if (intent.connector === 'slack') {
      client = await createMCPClient('slack', tokens.slack);
      return await client.callTool('slack_get_messages', {
        channelId: intent.slack_channel || 'all',
        limit: 50
      });
    }

    return { raw: 'No data source configured', sourceRefs: [] };

  } finally {
    // Always close — token is released from memory
    await client?.close();
  }
}
```

---

### 1.8 API routes reference

All routes require the `requireAuth` middleware except `/auth/*`.

```
POST   /auth/sign-up                  → create account
POST   /auth/sign-in                  → returns JWT + refresh token
POST   /auth/refresh                  → exchange refresh for new JWT
POST   /auth/sign-out                 → invalidate session

GET    /agents                        → list user's agents (inbox data)
POST   /agents                        → create agent (parses intent first)
GET    /agents/:id                    → single agent detail
PATCH  /agents/:id                    → update agent (name, schedule, status)
DELETE /agents/:id                    → delete agent + cancel schedule

GET    /agents/:id/messages           → paginated message thread
POST   /agents/:id/messages           → user sends reply to agent
PATCH  /agents/:id/messages/:msgId    → mark message as read

POST   /chat                          → connected or general chat via Assistant

GET    /connectors                    → list connected connectors + status
GET    /connectors/:id/auth-url       → get OAuth URL for connector
POST   /connectors/:id/callback       → handle OAuth code exchange
DELETE /connectors/:id                → disconnect connector

GET    /users/me                      → current user profile
PATCH  /users/me                      → update profile

WS     /ws                            → real-time message delivery
```

---

### 1.9 Docker Compose (local dev)

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sydney_dev
      POSTGRES_USER: sydney
      POSTGRES_PASSWORD: sydney
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

  api:
    build: .
    command: npm run dev:api
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://sydney:sydney@postgres/sydney_dev
      REDIS_URL: redis://redis:6379
      BETTER_AUTH_SECRET: dev-secret-change-in-production-min-32-chars
      VAULT_ENCRYPTION_KEY: ${VAULT_ENCRYPTION_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-haiku-4-5-20251001}
      FIREBASE_SERVICE_ACCOUNT: ${FIREBASE_SERVICE_ACCOUNT}
    ports:
      - '3000:3000'
    volumes:
      - ./src:/app/src  # hot reload

  worker:
    build: .
    command: npm run dev:worker
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://sydney:sydney@postgres/sydney_dev
      REDIS_URL: redis://redis:6379
      VAULT_ENCRYPTION_KEY: ${VAULT_ENCRYPTION_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      ANTHROPIC_MODEL: ${ANTHROPIC_MODEL:-claude-haiku-4-5-20251001}
      FIREBASE_SERVICE_ACCOUNT: ${FIREBASE_SERVICE_ACCOUNT}
    volumes:
      - ./src:/app/src

volumes:
  postgres_data:
```

```json
// package.json scripts
{
  "scripts": {
    "dev:api":    "tsx watch src/index.ts",
    "dev:worker": "tsx watch worker.ts",
    "build":      "tsc",
    "start:api":  "node dist/index.js",
    "start:worker": "node dist/worker.js",
    "migrate":    "node-pg-migrate up",
    "migrate:create": "node-pg-migrate create"
  }
}
```

`docker-compose up` starts everything. API at localhost:3000. Hot reload
via `tsx watch`. One command, full environment, consistent across machines.

---

## Component 2 — Flutter App

### What it is
The Android (and later iOS) mobile app. The face of Sydney.
It is purely an interface — it displays data from the backend,
sends user actions to the backend, and receives push notifications.
It has no business logic. It does not touch tokens. It does not
run agents.

### Why Flutter
**Design decision — Flutter over React Native, native Android, PWA:**

React Native: JavaScript bridge to native components adds latency.
Animations that need to be butter-smooth (message bubbles, thread opens)
can stutter on React Native. Fixing performance issues requires dropping
into native code anyway, eliminating the cross-platform benefit.

Native Android (Kotlin): Maximum performance and control but requires
a separate iOS codebase later. Two codebases means twice the maintenance,
twice the bugs, twice the time.

PWA: Cannot access FCM properly on iOS. Cannot get the native feel of
a messaging app. Dismissed immediately.

Flutter: Dart compiles to native ARM code — no bridge, no JavaScript runtime.
Animations run at 60/120fps natively. Single codebase for Android, iOS,
and web. Material 3 design system built in. FCM supported natively.
Flutter is the only cross-platform option that delivers native-quality
performance for a messaging app.

### Why Android first
**Design decision:**
Google Play review is same-day. Apple App Store review takes 1–7 days
and can reject for minor issues, wasting days at a critical launch moment.
Apple Developer account costs $99/year. Android developer account costs
$25 one-time. Google OAuth verification is the same process regardless —
no advantage to iOS first. Build Android, validate product, add iOS on
the same Flutter codebase with one config change.

---

### 2.1 Project structure

```
sydney-flutter/
├── lib/
│   ├── main.dart                  → app entry point
│   ├── app.dart                   → MaterialApp, routing, theme
│   ├── config/
│   │   └── env.dart               → API base URL, env flags
│   ├── design/
│   │   ├── tokens.dart            → colors, typography, spacing, radius
│   │   └── animations.dart        → animation constants and curves
│   ├── models/
│   │   ├── agent.dart             → Agent data class
│   │   ├── message.dart           → AgentMessage data class
│   │   ├── connector.dart         → Connector data class
│   │   └── user.dart              → User data class
│   ├── services/
│   │   ├── api.dart               → Dio HTTP client, interceptors
│   │   ├── auth_service.dart      → sign-in, sign-up, token refresh
│   │   ├── agent_service.dart     → agent CRUD, intent submission
│   │   ├── message_service.dart   → thread fetch, reply send, mark read
│   │   ├── connector_service.dart → OAuth flow, connector status
│   │   ├── push_service.dart      → FCM setup, notification routing
│   │   └── websocket_service.dart → real-time message delivery
│   ├── providers/
│   │   ├── auth_provider.dart     → Riverpod: user session state
│   │   ├── agents_provider.dart   → Riverpod: agents list state
│   │   ├── messages_provider.dart → Riverpod: per-agent thread state
│   │   └── connectors_provider.dart → Riverpod: connector status
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── sign_in_screen.dart
│   │   │   └── sign_up_screen.dart
│   │   ├── inbox/
│   │   │   └── inbox_screen.dart  → main contact list
│   │   ├── thread/
│   │   │   └── thread_screen.dart → agent chat thread
│   │   ├── create/
│   │   │   ├── create_screen.dart → prompt bar + templates
│   │   │   └── confirm_screen.dart → confirmation card
│   │   ├── connectors/
│   │   │   └── connectors_screen.dart → manage connected services
│   │   └── settings/
│   │       └── settings_screen.dart
│   └── widgets/
│       ├── inbox/
│       │   ├── agent_tile.dart    → single row in inbox
│       │   └── unread_badge.dart
│       ├── thread/
│       │   ├── message_bubble.dart → routes to correct template widget
│       │   ├── reply_bar.dart      → text input at bottom of thread
│       │   └── typing_indicator.dart
│       └── templates/
│           ├── plain_text_template.dart
│           ├── progress_tracker_template.dart
│           ├── urgency_list_template.dart
│           ├── data_summary_template.dart
│           ├── checklist_template.dart
│           ├── streak_counter_template.dart
│           └── system_template.dart
├── android/
│   └── app/
│       └── google-services.json   → Firebase config (not in git)
├── pubspec.yaml
└── .env                           → API_BASE_URL (not in git)
```

---

### 2.2 Dependencies

```yaml
# pubspec.yaml dependencies
dependencies:
  flutter:
    sdk: flutter

  # HTTP client
  dio: ^5.4.0
  # Design decision: Dio over http package.
  # Dio has interceptors (for JWT auto-refresh), request cancellation,
  # FormData, and multipart support. The http package is too minimal.

  # State management
  flutter_riverpod: ^2.5.0
  riverpod_annotation: ^2.3.0
  # Design decision: Riverpod over Provider, Bloc, GetX.
  # Riverpod is compile-safe (no runtime provider not found errors),
  # testable without BuildContext, and the annotation package generates
  # boilerplate. Bloc is too verbose for a UI this straightforward.
  # GetX mixes state, routing, and DI in ways that become unmaintainable.

  # Secure storage (JWT only)
  flutter_secure_storage: ^9.0.0
  # Design decision: only the user's own JWT lives here.
  # Connector tokens (Gmail, Slack) never touch the device.
  # They live in the backend vault exclusively.

  # OAuth in-app browser
  flutter_web_auth_2: ^4.0.0
  # Design decision: flutter_web_auth_2 over url_launcher.
  # flutter_web_auth_2 opens a secure in-app browser (Chrome Custom Tab
  # on Android, SFSafariViewController on iOS), waits for the redirect
  # URI to be called, captures the auth code, and returns it to the app.
  # url_launcher just opens the browser — the app loses control of the flow.

  # Push notifications
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  # FCM is free, Flutter-native, and works on Android and iOS.
  # No alternative considered.

  # Navigation
  go_router: ^13.0.0
  # Design decision: go_router over Navigator 2.0 directly.
  # Declarative routing that handles deep links from push notifications.
  # When a notification arrives, tapping it deep links directly to
  # the correct agent thread. go_router makes this trivial.

  # WebSocket for real-time messages
  web_socket_channel: ^3.0.0
```

---

### 2.3 Auth flow

```dart
// lib/services/auth_service.dart
class AuthService {
  final Dio _dio;
  final FlutterSecureStorage _storage;

  Future<void> signIn(String email, String password) async {
    final res = await _dio.post('/auth/sign-in', data: {
      'email': email,
      'password': password
    });

    // Store JWT and refresh token securely on device
    await _storage.write(key: 'access_token', value: res.data['accessToken']);
    await _storage.write(key: 'refresh_token', value: res.data['refreshToken']);
  }

  Future<String?> getValidAccessToken() async {
    final token = await _storage.read(key: 'access_token');
    if (token == null) return null;

    // Check expiry (JWT payload is base64 encoded)
    final payload = _decodeJwtPayload(token);
    final expiry = DateTime.fromMillisecondsSinceEpoch(payload['exp'] * 1000);

    if (DateTime.now().isBefore(expiry.subtract(Duration(minutes: 2)))) {
      return token; // still valid
    }

    // Refresh
    return await _refresh();
  }

  Future<String?> _refresh() async {
    final refreshToken = await _storage.read(key: 'refresh_token');
    if (refreshToken == null) return null;

    try {
      final res = await _dio.post('/auth/refresh', data: {
        'refreshToken': refreshToken
      });
      final newToken = res.data['accessToken'] as String;
      await _storage.write(key: 'access_token', value: newToken);
      return newToken;
    } catch (_) {
      // Refresh failed — session expired, need to sign in again
      await signOut();
      return null;
    }
  }

  Future<void> signOut() async {
    await _storage.deleteAll();
    // Navigate to sign-in — handled by auth state notifier
  }
}
```

**Dio interceptor — auto-attach JWT to every request:**

```dart
// lib/services/api.dart
Dio createApiClient(AuthService auth) {
  final dio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl));

  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await auth.getValidAccessToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      handler.next(options);
    },
    onError: (error, handler) async {
      if (error.response?.statusCode == 401) {
        // Token genuinely invalid — sign out
        await auth.signOut();
      }
      handler.next(error);
    }
  ));

  return dio;
}
```

---

### 2.4 Connector OAuth flow

**Design decision — OAuth happens in-app, token exchange on backend:**
The Flutter app never sees the access token or refresh token.
It only sees the auth code (a short-lived one-time string).
The backend exchanges the code for tokens. This means if the app
is ever compromised, connector tokens are not exposed.

```dart
// lib/services/connector_service.dart
Future<void> connectGmail() async {
  // Step 1: Get OAuth URL from backend
  final res = await _api.get('/connectors/gmail/auth-url');
  final authUrl = res.data['url'] as String;

  // Step 2: Open in-app browser, wait for redirect
  // flutter_web_auth_2 opens Chrome Custom Tab on Android
  // Waits for sydney://oauth/callback?code=... redirect
  final result = await FlutterWebAuth2.authenticate(
    url: authUrl,
    callbackUrlScheme: 'sydney'
  );

  // Step 3: Extract code and send to backend
  // Backend exchanges code for tokens, stores encrypted in vault
  // App never touches the tokens
  final uri = Uri.parse(result);
  final code = uri.queryParameters['code']!;

  await _api.post('/connectors/gmail/callback', data: { 'code': code });

  // Done. Backend has the tokens. App just knows "gmail = connected"
}
```

---

### 2.5 Message template routing

Every message has a `template` field in its content JSON.
Flutter renders the right widget:

```dart
// lib/widgets/thread/message_bubble.dart
class MessageBubble extends StatelessWidget {
  final AgentMessage message;

  @override
  Widget build(BuildContext context) {
    if (message.role == 'user') {
      return UserBubble(content: message.textContent);
    }

    final content = message.parsedContent;

    return switch (content.template) {
      'plain_text'        => PlainTextTemplate(data: content.data),
      'progress_tracker'  => ProgressTrackerTemplate(data: content.data),
      'urgency_list'      => UrgencyListTemplate(data: content.data),
      'data_summary'      => DataSummaryTemplate(data: content.data),
      'checklist'         => ChecklistTemplate(data: content.data),
      'streak_counter'    => StreakCounterTemplate(data: content.data),
      'system'            => SystemTemplate(data: content.data),
      _                   => PlainTextTemplate(data: content.data),
    };
  }
}
```

---

### 2.6 Push notification routing

When a notification arrives, tapping it should open the correct
agent thread directly — not just the app home screen.

```dart
// lib/services/push_service.dart
Future<void> setupPushNotifications(GoRouter router) async {
  await FirebaseMessaging.instance.requestPermission();

  // App opened from terminated state via notification
  final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
  if (initialMessage != null) {
    _handleNotificationTap(initialMessage.data, router);
  }

  // App in background, notification tapped
  FirebaseMessaging.onMessageOpenedApp.listen((message) {
    _handleNotificationTap(message.data, router);
  });

  // App in foreground — show in-app banner instead of system notification
  FirebaseMessaging.onMessage.listen((message) {
    _showInAppBanner(message);
  });
}

void _handleNotificationTap(
  Map<String, dynamic> data,
  GoRouter router
) {
  final agentId = data['agentId'] as String?;
  final messageId = data['messageId'] as String?;

  if (agentId != null) {
    // Deep link directly to agent thread, scroll to messageId
    router.go('/thread/$agentId', extra: { 'scrollToMessage': messageId });
  }
}
```

---

### 2.7 Screen navigation

```dart
// lib/app.dart — go_router config
final router = GoRouter(
  initialLocation: '/inbox',
  redirect: (context, state) async {
    final isSignedIn = ref.read(authProvider).isSignedIn;
    final isAuthRoute = state.location.startsWith('/auth');

    if (!isSignedIn && !isAuthRoute) return '/auth/sign-in';
    if (isSignedIn && isAuthRoute)  return '/inbox';
    return null;
  },
  routes: [
    GoRoute(path: '/auth/sign-in',  builder: (c, s) => SignInScreen()),
    GoRoute(path: '/auth/sign-up',  builder: (c, s) => SignUpScreen()),
    GoRoute(path: '/inbox',         builder: (c, s) => InboxScreen()),
    GoRoute(
      path: '/thread/:agentId',
      builder: (c, s) => ThreadScreen(
        agentId: s.pathParameters['agentId']!,
        scrollToMessage: s.extra != null
          ? (s.extra as Map)['scrollToMessage'] as String?
          : null,
      )
    ),
    GoRoute(path: '/create',        builder: (c, s) => CreateScreen()),
    GoRoute(path: '/connectors',    builder: (c, s) => ConnectorsScreen()),
    GoRoute(path: '/settings',      builder: (c, s) => SettingsScreen()),
  ]
);
```

---

### 2.8 Design tokens in Dart

```dart
// lib/design/tokens.dart

class SydneyColors {
  static const background          = Color(0xFFFFFFFF);
  static const backgroundSecondary = Color(0xFFF7F7F7);
  static const agentBubble         = Color(0xFFF2F2F2);
  static const userBubble          = Color(0xFF007AFF);
  static const textPrimary         = Color(0xFF0D0D0D);
  static const textSecondary       = Color(0xFF6B6B6B);
  static const textTertiary        = Color(0xFFAAAAAA);
  static const textOnUser          = Color(0xFFFFFFFF);
  static const onTrack             = Color(0xFF1D9E75);
  static const behind              = Color(0xFFE24B4A);
  static const ahead               = Color(0xFF378ADD);
  static const warning             = Color(0xFFBA7517);
  static const unreadDot           = Color(0xFF007AFF);
  static const border              = Color(0xFFEAEAEA);
}

class SydneyTextStyles {
  static const agentName = TextStyle(
    fontSize: 15, fontWeight: FontWeight.w600, height: 1.2,
    color: SydneyColors.textPrimary
  );
  static const messagePreview = TextStyle(
    fontSize: 14, fontWeight: FontWeight.w400, height: 1.4,
    color: SydneyColors.textSecondary
  );
  static const timestamp = TextStyle(
    fontSize: 12, fontWeight: FontWeight.w400,
    color: SydneyColors.textTertiary
  );
  static const messageBody = TextStyle(
    fontSize: 15, fontWeight: FontWeight.w400, height: 1.6,
    color: SydneyColors.textPrimary
  );
  static const sectionLabel = TextStyle(
    fontSize: 12, fontWeight: FontWeight.w500,
    letterSpacing: 0.04, color: SydneyColors.textTertiary
  );
}

class SydneySpacing {
  static const xs  = 4.0;
  static const sm  = 8.0;
  static const md  = 12.0;
  static const lg  = 16.0;
  static const xl  = 24.0;
  static const xxl = 32.0;
}

class SydneyRadius {
  static const message    = Radius.circular(18);
  static const card       = Radius.circular(14);
  static const button     = Radius.circular(10);
  static const avatar     = Radius.circular(24);
  static const progressBar = Radius.circular(6);
}

class SydneyAnimations {
  static const threadOpen    = Duration(milliseconds: 280);
  static const messageArrive = Duration(milliseconds: 220);
  static const progressFill  = Duration(milliseconds: 800);
  static const cardAppear    = Duration(milliseconds: 240);

  static const threadOpenCurve    = Curves.easeOutCubic;
  static const messageArriveCurve = Curves.easeOutQuart;
  static const progressFillCurve  = Curves.easeOutCubic;
  static const cardAppearCurve    = Curves.easeOutBack;
}
```

---

## Component 3 — Website

### What it is
The public-facing website. Not the web app (that is Flutter Web, built
in Phase 2). The website is the landing page, waitlist, pricing page,
and blog. It is a marketing surface, not a product surface.

### Why it is built last
The backend must exist before the website can show real API status.
The Flutter app must exist before the website has something to link to.
The website has zero product functionality. It is pure marketing.
Build it last, ship it right before launch.

### Why Next.js

**Design decision — Next.js over Webflow, Framer, plain HTML:**

Webflow and Framer are excellent for designers building pages without
code. Sydney's website needs dynamic elements: a real waitlist form that
hits the backend API, an agent demo that fetches live data, a countdown
to launch. These require code. Webflow embeds are messy. Framer has
limited API integration.

Next.js with the App Router gives static generation for fast page loads,
server-side API route for the waitlist form, easy deployment to Vercel
(free tier covers the website), and the ability to embed real interactive
demos later. TypeScript throughout matches the backend. One language
for the whole team.

---

### 3.1 Project structure

```
sydney-website/
├── app/
│   ├── layout.tsx              → root layout, fonts, metadata
│   ├── page.tsx                → landing page (/)
│   ├── pricing/
│   │   └── page.tsx            → pricing page (/pricing)
│   ├── blog/
│   │   ├── page.tsx            → blog index (/blog)
│   │   └── [slug]/
│   │       └── page.tsx        → individual post (/blog/slug)
│   ├── waitlist/
│   │   └── page.tsx            → waitlist confirmation (/waitlist)
│   └── api/
│       └── waitlist/
│           └── route.ts        → POST /api/waitlist (server action)
├── components/
│   ├── Hero.tsx                → main headline + CTA
│   ├── DemoPreview.tsx         → animated inbox mockup
│   ├── AgentExamples.tsx       → example agents grid
│   ├── PricingCards.tsx        → free vs pro comparison
│   ├── WaitlistForm.tsx        → email capture
│   ├── ComparisonTable.tsx     → Sydney vs Spark vs ChatGPT
│   └── Footer.tsx
├── public/
│   ├── og-image.png            → social share image
│   └── icon.svg                → Sydney icon
├── styles/
│   └── globals.css
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

### 3.2 Landing page structure

The landing page has one job: convert visitors into waitlist signups
or app downloads. Every section earns its place or gets cut.

```
Section 1 — Hero
  Headline: "AI agents that message you."
  Subline: "Create agents in one sentence. They work while you sleep.
            You just receive."
  CTA: [Download for Android] [Join waitlist]
  Visual: animated phone showing inbox with agents messaging

Section 2 — The feeling
  "Like your morning newspaper. But it knows you."
  Three columns:
  → Morning: Tech News agent message arrives at 7am
  → Evening: Email Digest agent message arrives at 6pm
  → Always: Slack Watcher alerts you instantly

Section 3 — How it works
  Three steps, minimal:
  1. Tell Sydney what you want (one sentence)
  2. Sydney creates an agent and connects your apps
  3. Agent messages you when it has something for you

Section 4 — Agent examples
  Grid of 6 agent cards:
  📰 Tech News Brief
  📧 Email Digest
  📚 Study Plan Agent
  💬 Slack Watcher
  📈 Portfolio Tracker
  🌍 Competitor Watch

Section 5 — vs Gemini Spark
  Clean comparison table
  Price: $9.99 vs $100
  Global: ✓ vs US only
  Custom agents: ✓ vs roadmap
  Messaging UI: ✓ vs task dashboard

Section 6 — Pricing
  Two cards, minimal
  Free: 3 agents, daily schedule
  Pro: $9.99, unlimited agents, hourly schedule

Section 7 — Waitlist CTA
  Large text: "The app is coming."
  Email input
  "Be first to know when Sydney launches."
```

---

### 3.3 Waitlist API route

```typescript
// app/api/waitlist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db'; // shared Postgres connection

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { error: 'Valid email required' },
      { status: 400 }
    );
  }

  try {
    await pool.query(`
      INSERT INTO waitlist (email, created_at)
      VALUES ($1, NOW())
      ON CONFLICT (email) DO NOTHING
    `, [email]);

    // Optional: send welcome email via Resend or similar
    // await sendWelcomeEmail(email);

    return NextResponse.json({ success: true });

  } catch (err) {
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

**Design decision — waitlist hits Sydney's own backend Postgres:**
No third-party mailing list service (Mailchimp, Beehiiv) at launch.
Emails go directly into a `waitlist` table in the same Postgres database.
Export to CSV when needed. No vendor cost, no setup, no API keys.
Add a proper email service later when there are enough subscribers
to justify it.

---

### 3.4 Deployment

```
Website → Vercel (free tier)
          connected to GitHub
          auto-deploys on push to main
          custom domain: getsydney.app (or whatever name chosen)

Backend → Railway
          two services: api-server, worker
          auto-deploys from same GitHub repo
          custom domain: api.getsydney.app

Flutter → Google Play Store
          internal testing track first
          production track at launch
```

**Design decision — separate domains for website and API:**
`getsydney.app` serves the Next.js website.
`api.getsydney.app` serves the Node.js backend.
The Flutter app points to `api.getsydney.app`.
The website's waitlist form hits `api.getsydney.app/waitlist`.
Clean separation. The website can go down without affecting the app.
The API can be updated without redeploying the website.

---

## Build Order Summary

```
Week 1 — Backend foundation
  □ docker-compose up (Postgres + Redis + Node.js)
  □ Run migrations (all tables created)
  □ Better Auth working (sign-up, sign-in, JWT)
  □ /auth/* routes tested with curl
  □ Protected route middleware working

Week 2 — Flutter scaffold + UI
  □ Flutter project created, pubspec.yaml dependencies installed
  □ Design tokens defined (tokens.dart)
  □ Inbox screen (static, hardcoded data)
  □ Thread screen (static, hardcoded messages)
  □ Create screen (prompt bar + template tiles)
  □ Auth screens (sign-in, sign-up)
  □ Dio client connected to backend, auth working end to end

Week 3 — First agent end to end
  □ BullMQ + Redis queue setup
  □ Anthropic web search enabled in Claude Console
  □ Intent parser (Haiku) working for news intent
  □ Tech News agent: schedule → BullMQ → search → Haiku → message
  □ FCM push notification setup (firebase, google-services.json)
  □ Flutter receives push, opens thread, renders plain_text template
  □ First real agent message in inbox ← milestone

  Note: Firebase/FCM push is postponed until the Android application ID,
  Firebase project, backend domains, and environment split are stable. Week 3
  realtime is being closed with an authenticated backend event stream first.

Week 4 — Gmail connector
  □ Google Cloud Console: OAuth app created
  □ Gmail OAuth flow end to end (auth URL → browser → callback)
  □ Token vault: encrypt/decrypt/refresh working
  □ Gmail MCP server running locally
  □ Email Digest agent end to end
  □ SUBMIT GOOGLE OAUTH VERIFICATION ← do not skip

Week 5+ — More connectors + polish
  □ Slack connector
  □ Drive connector
  □ progress_tracker template (study agent)
  □ data_summary template (email digest)
  □ urgency_list template (Slack watcher)
  □ Agent reply handling (user reply → agent context update)
  □ Pause / resume / delete agent
  □ Free tier enforcement (3 agents, daily minimum)
  □ Unsupported connector graceful response

Pre-launch
  □ Google OAuth verification approved
  □ PgBouncer connection pooler
  □ Schedule jitter implemented
  □ Haiku spend alert configured
  □ Queue depth monitoring
  □ Uptime monitoring
  □ Privacy policy + terms of service (required for Play Store)
  □ Play Store listing: screenshots, description, icon
  □ Play Store internal testing track live
  □ Website deployed to Vercel
  □ Waitlist form working
  □ Launch
```

---

## Environment Variables Reference

```bash
# Backend (.env)
DATABASE_URL=postgresql://user:pass@host/sydney
REDIS_URL=redis://host:6379
BETTER_AUTH_SECRET=<random 32+ char string>
VAULT_ENCRYPTION_KEY=<64 hex chars, 32 bytes>

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-haiku-4-5-20251001

GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=https://api.getsydney.app/connectors/google/callback

SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_REDIRECT_URI=https://api.getsydney.app/connectors/slack/callback

FIREBASE_SERVICE_ACCOUNT=<JSON string of service account key>

# Flutter (.env or dart-define)
API_BASE_URL=https://api.getsydney.app

# Website (.env.local)
DATABASE_URL=postgresql://user:pass@host/sydney  # for waitlist
NEXT_PUBLIC_API_URL=https://api.getsydney.app
```

**Never commit any .env file to git.**
Add all of them to .gitignore before the first commit.
Generate VAULT_ENCRYPTION_KEY once and back it up.
If it is lost, all stored connector tokens are unrecoverable.

```bash
# Generate VAULT_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate BETTER_AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

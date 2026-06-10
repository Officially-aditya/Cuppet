# Sydney — Technical Document
### Internal alias: Sydney | Version 1.0
### Reference this when building. Contains full stack, architecture, auth, database, queue, MCP, and build order.

---

## 6. Technology Stack

### 6.0 Stack overview

Entirely owned, self-hosted, and open source where possible. No managed abstraction layers. Every component is replaceable and cheap to run at early scale.

```
┌─────────────────────────────────────────┐
│      Flutter App (Android-first)        │
│  Messaging UI · agent creation ·        │
│  push notifications · chat threads      │
└──────────────────┬──────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼──────────────────────┐
│        Node.js Backend (Fastify)        │
│  API · Better Auth · orchestration      │
│  message storage · chat routing         │
└──────┬───────────────┬───────────────────┘
       │               │
┌──────▼──────┐  ┌─────▼──────────────────┐
│  PostgreSQL │  │   Redis + BullMQ       │
│  (primary   │  │   (job queue +         │
│   database) │  │    scheduler)          │
└─────────────┘  └────────────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │    Agent Runtime (Node.js)     │
        │  MCP SDK · token vault ·       │
        │  Claude Haiku · summarization  │
        └───────────────┬────────────────┘
                        │ MCP protocol
        ┌───────────────▼────────────────┐
        │   Self-hosted MCP Servers      │
        │  Gmail · Drive · Slack ·       │
        │  Docs · Web search             │
        └────────────────────────────────┘
```

### 6.1 Mobile app — Flutter

**Why Flutter:** Single codebase for Android and iOS. Android-first at launch. iOS added later with minimal additional work — same codebase, one config change.

**Key packages:**
- `flutter_web_auth_2` — OAuth in-app browser flow. Opens secure browser, captures redirect, passes auth code to backend. App never touches connector tokens.
- `firebase_messaging` — receives push notifications from FCM when an agent sends a new message.
- `flutter_secure_storage` — stores the user's Better Auth JWT in device keychain only. Nothing else on-device.
- `dio` — HTTP client for all backend API calls.
- `riverpod` — state management.

**What Flutter does NOT do:**
- store connector tokens (Gmail, Slack, Drive),
- run agents or call MCP servers,
- execute background jobs,
- anything except UI, notifications, and API calls.

### 6.2 Backend — Node.js + Fastify

**Why Node.js:** Official MCP TypeScript SDK is Anthropic-maintained. Same language across backend, MCP client, and agent runtime — no serialisation boundary.

**Why Fastify:** Better performance than Express, native TypeScript, built-in JSON schema validation.

**Core responsibilities:**
- REST API for Flutter app,
- Better Auth for user auth and agent auth,
- OAuth callback handling for connector linking,
- message storage and chat thread retrieval,
- user reply routing to agent context,
- BullMQ job enqueueing,
- WebSocket for real-time message delivery.

**Project structure:**
```
/src
  /auth          → Better Auth config and routes
  /agents        → agent CRUD, intent parsing, scheduling
  /messages      → message storage, thread retrieval, reply handling
  /chat          → connected chat and general chat routing
  /connectors    → per-connector OAuth flows
  /vault         → encrypted token read/write
  /mcp           → MCP client initialisation per connector
  /queue         → BullMQ job producer
  /workers       → BullMQ job consumers (agent execution)
  /notifications → FCM push delivery
  /api           → Fastify route definitions
```

### 6.3 Authentication — Better Auth (self-hosted)

Open source, TypeScript-native, zero per-user cost. Runs as a library inside the Node.js backend.

**What Better Auth handles:**
1. **User auth** — email/password sign-up and sign-in, JWT issuance.
2. **Session management** — 15-minute access tokens, 30-day refresh tokens. Flutter refreshes silently.
3. **OAuth 2.1 provider** — backend acts as a proper OAuth authorization server for MCP clients. Handles PKCE, dynamic client registration, consent, token issuance.
4. **Agent Auth plugin** — exposes agent capabilities for discovery with scoped permissions.
5. **Connector OAuth initiation** — initiates Google/Slack/Figma OAuth flows via `genericOAuth` plugin. Callback hands tokens to the vault, not Better Auth's session store.

**What Better Auth does NOT handle:**
- connector token storage or refresh (token vault),
- agent execution or scheduling,
- MCP server connections,
- message storage or chat thread logic.

### 6.4 Database — PostgreSQL (direct)

No Supabase, no Prisma. Direct connection via `pg` npm package. Managed Postgres on Railway (~$5/month at MVP). Migrations via `node-pg-migrate`.

**Core schema:**

```sql
-- users and sessions
users (id, email, name, created_at)
sessions (id, user_id, token_hash, expires_at)

-- connector credentials
connector_tokens (
  id,
  user_id,
  connector_id,       -- 'gmail' | 'slack' | 'drive' | 'figma'
  access_token_enc,   -- AES-256-GCM encrypted
  refresh_token_enc,  -- AES-256-GCM encrypted
  token_expires_at,
  scopes,
  status,             -- 'connected' | 'disconnected'
  created_at,
  updated_at
)

-- agent definitions (each is a contact in the inbox)
agents (
  id,
  user_id,
  name,               -- e.g. "Tech News", "Email Digest"
  avatar,             -- emoji or generated icon
  prompt,             -- original user prompt
  parsed_intent,      -- JSON: tool, action, schedule, format
  connector_ids,      -- array of required connectors
  schedule_cron,      -- e.g. '0 7 * * *' for 7am daily
  is_assistant,       -- true for the pre-installed Assistant contact
  status,             -- 'active' | 'paused' | 'error'
  safety_level,       -- 'read' | 'suggest' | 'act'
  last_message_at,    -- for sorting contact list
  created_at,
  updated_at
)

-- all messages across all agent threads
-- single table powers the entire messaging UI
agent_messages (
  id,
  agent_id,
  user_id,
  role,               -- 'agent' | 'user' | 'system'
  content,            -- message text or structured output
  source_refs,        -- JSON: source links or identifiers
  read_at,
  created_at
)

-- execution history (internal, not shown in UI directly)
agent_runs (
  id,
  agent_id,
  started_at,
  completed_at,
  status,             -- 'success' | 'failed' | 'partial' | 'expired'
  message_id,         -- FK to agent_messages
  error_message,
  tokens_used
)
```

**Key design decision:** Every agent output — scheduled reports, connected chat responses, general chat responses, system notifications — is stored as a row in `agent_messages`. Role distinguishes who sent it. This single table powers the entire messaging UI across all agent types including the Assistant contact.

### 6.5 Token vault — custom, built in-house

Per-user, per-connector OAuth token storage with background refresh. No third-party solution. One-time build, zero ongoing cost.

**Encryption:** AES-256-GCM. Tokens encrypted before write, decrypted in memory only at moment of use. Encryption key loaded from environment variable, never stored in database.

**Token refresh flow:**
```
getValidToken(userId, connectorId)
  → fetch from connector_tokens
  → if expires_at > now + 5min → decrypt, return access_token
  → else → call provider refresh endpoint with refresh_token
         → success → encrypt and store new tokens → return access_token
         → failure → mark status = 'disconnected'
                   → write system message to agent thread:
                     "I lost access to your Gmail.
                      Tap here to reconnect."
                   → throw error
```

**Security rules:**
- tokens decrypted in memory only, never logged,
- never passed to Claude Haiku or stored in BullMQ payloads,
- each connector isolated per row — revoking one doesn't affect others,
- failures always surface as messages in the agent thread, never silent.

**Vault encryption key generation:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Store as VAULT_ENCRYPTION_KEY in environment
# Back this up — losing it makes all stored tokens unrecoverable
```

### 6.6 Job queue and scheduler — BullMQ + Redis

**Two queues:**

1. `agent-scheduler` — cron-triggered repeatable jobs. Registered when an agent is created or updated.
2. `agent-executor` — actual work queue. Workers pick up jobs, execute, write output as agent message.

**Worker flow:**
```
Receive { agentId }
  → fetch agent from Postgres
  → getValidToken() for each required connector
  → create MCP client with token injected
  → call MCP tools (e.g. gmail_search, brave_search)
  → pass raw results to Claude Haiku for summarization
  → write output to agent_messages (role: 'agent')
  → update agents.last_message_at
  → send FCM push notification
  → update agent_runs with status and token usage
  → close MCP client
```

**Tier enforcement:**
```typescript
// free tier checks at agent creation
if (!isPaidUser && cronIntervalHours(cronExpr) < 24) {
  throw new Error('Daily minimum interval on free plan');
}
if (!isPaidUser && activeAgentCount >= 3) {
  throw new Error('3 agent maximum on free plan');
}
```

Note: The pre-installed Assistant contact does not count toward the 3-agent free tier limit. It is always available regardless of plan.

**Reliability:**
- max 3 retries with exponential backoff,
- job TTL: if a job hasn't started within 30 minutes of its scheduled time, mark as expired rather than delivering a stale report hours late,
- final failure writes an error message to the agent thread so the user is always informed.

**Schedule jitter (important for scale):**
```typescript
// prevent thundering herd at popular times like 7am or 6pm
const jitterMs = Math.floor(Math.random() * 10 * 60 * 1000); // up to 10min
const actualFireTime = scheduledTime + jitterMs;
```

### 6.7 MCP layer — TypeScript SDK + self-hosted servers

**SDK:** `@modelcontextprotocol/sdk` official Anthropic TypeScript SDK (post-SEP-2207 for background token refresh support).

**MVP connector set:**

| Connector | MCP Server | OAuth Scopes | Notes |
|---|---|---|---|
| Gmail | `@modelcontextprotocol/server-gmail` | `gmail.readonly` | Requires Google OAuth verification |
| Google Drive | `@modelcontextprotocol/server-gdrive` | `drive.readonly` | |
| Google Docs | via Drive server | `drive.readonly` | |
| Slack | `@modelcontextprotocol/server-slack` | `channels:history`, `im:history` | |
| Web search | Anthropic server-side web search | Anthropic API key | No OAuth needed |

**Stateless connections:** MCP clients are not persistent. Each agent execution creates a fresh client, injects the user's decrypted access token, calls tools, then closes. Nothing persists between runs. No token lingers in memory after execution.

**Unsupported connector response:** If intent parsing detects a required connector that doesn't exist yet, the agent creation flow responds with a graceful fallback suggestion rather than creating a broken agent.

### 6.8 LLM — Claude Haiku

**Model:** `claude-haiku-4-5` for all agent execution, chat, and intent parsing. Fast, cheap (~25× cheaper than Sonnet), fully sufficient for all MVP tasks.

**Used for:**
- parsing user prompts into structured agent definitions,
- summarizing raw MCP tool output into readable messages,
- connected chat: answering questions with live MCP context,
- general chat: plain conversation,
- understanding user replies and updating agent behaviour,
- classifying urgency and relevance.

**Connected chat routing:**
```typescript
const intent = await detectIntent(userMessage);
// returns { needsConnectors: ['gmail'], needsWebSearch: false }

if (intent.needsConnectors.length > 0) {
  const context = await fetchMCPContext(intent.needsConnectors, userId);
  return await chat(userMessage, context); // answers with real user data
} else if (intent.needsWebSearch) {
  const results = await webSearch(userMessage);
  return await chat(userMessage, results);
} else {
  return await chat(userMessage); // plain Haiku response
}
```

**Hard rules:**
- LLM never receives raw tokens or credentials,
- LLM never calls tools autonomously — always called with pre-fetched data,
- all structured output validated against schemas before being stored or acted on,
- Haiku API spend monitored with hard alerts to prevent unexpected bills.

### 6.9 Push notifications — Firebase Cloud Messaging

Free at any scale. First-class Flutter SDK. Works for Android and iOS.

**Notification model — identical to WhatsApp:**
```
title: "Tech News"                        ← agent name
body:  "Your 7am brief: 8 stories today" ← first line of output
```

Tapping opens the agent's chat thread with the new message scrolled into view.

**Notification types:**
- agent completed → delivers message preview,
- connector token expired → system message + push to reconnect,
- agent paused due to failures → push with explanation,
- partial run (some data missing) → flagged inline in the message.

### 6.10 Hosting — Railway (MVP) → AWS EC2 (Phase 3+)

**MVP hosting — Railway:**
```
railway project
├── api-server    (Node.js + Fastify + Better Auth)
├── worker        (BullMQ workers, same codebase different entry)
├── postgres      (~$5/mo)
└── redis         (~$5/mo)
```

Same Docker containers, same codebase. Migration to AWS is a config change, not a rewrite.

**Phase 3+ hosting — AWS EC2 + OpenShell:**

When assisted actions and coding agents are introduced, Railway's shared container model is insufficient for per-user security isolation. At that point:

- migrate to AWS EC2 with NVIDIA GPU instances,
- introduce NVIDIA OpenShell as the agent execution runtime,
- each agent run executes in an isolated OpenShell sandbox,
- kernel-level isolation via Landlock LSM and Seccomp BPF,
- credentials injected by OpenShell at runtime, never exposed to the agent,
- privacy router intercepts LLM calls, strips credentials, injects backend credentials,
- coding agents (Claude Code, Codex) run unmodified inside OpenShell sandboxes,
- GPU passthrough via `openshell sandbox create --gpu` for compute-intensive tasks.

**Why OpenShell matters for Sydney:**
- token vault becomes partially redundant — OpenShell injects credentials at the runtime level,
- user A's agent execution is kernel-isolated from user B's — not just application-layer promises,
- coding agents can install packages, run tests, execute code safely per user,
- audit logs of every tool call and file access are cryptographically signed,
- the privacy router ensures user data never reaches unauthorized model providers.

**OpenShell is currently alpha (single-player mode).** It is not suitable for MVP multi-tenant deployment. Adopt at Phase 3 when sandboxed action-taking becomes necessary.

### 6.11 Web version

Sydney's web version is a natural extension of the same backend and agent runtime. The Flutter app compiles to web for the messaging interface. For the coding agent specifically, a Monaco Editor panel is embedded alongside the chat thread for a full IDE-like experience.

**What the web version adds over mobile:**

- **Split-pane inbox** — agent contact list on the left, chat thread on the right, full message history visible simultaneously,
- **Multi-agent overview** — dashboard showing all agents' last outputs at a glance,
- **Coding agent IDE panel** — code editor + terminal output + agent chat in one interface, backed by OpenShell on EC2,
- **Research agent deep dives** — full document-style output with sources sidebar, inline follow-up questions,
- **Cross-surface continuity** — same inbox, same agents, same history. Read a notification on mobile, open the full report on web.

**Surface rollout order:** Android → Web → iOS

### 6.12 Pricing

| Feature | Free | Pro ($9.99/month) |
|---|---|---|
| Assistant contact | ✓ always included | ✓ always included |
| Custom agents | 3 | Unlimited |
| Minimum schedule interval | Daily | Hourly |
| Connected chat | ✓ | ✓ |
| General chat | ✓ | ✓ |
| Connectors | All available | All available |
| Message history | 30 days | Unlimited |
| Web access | ✓ | ✓ |

**Notes:**
- The Assistant contact does not count toward the 3-agent free tier limit.
- Free tier is generous enough to deliver real daily value and build the habit.
- The ceiling (3 agents, daily minimum) is hit naturally by users who rely on the product enough to pay.
- At $9.99/month, Sydney sits below Claude Pro and ChatGPT Plus (~$20) and does something neither can: it works while the user is away and messages them unprompted.

### 6.13 Cost estimates

**Pre-launch / development:** ~$0/month (Railway free tier + minimal Haiku testing)

**Launch day (0 users):** ~$25/month (Railway paid + Postgres + Redis)

| Scale | Infra | Haiku API | Total |
|---|---|---|---|
| Launch | $20 | $5 | ~$25/mo |
| 100 active users | $25 | $8 | ~$33/mo |
| 1,000 active users | $35 | $15 | ~$50/mo |
| 5,000 active users | $80 | $60 | ~$140/mo |

No per-user fees. No third-party auth or connector gateway costs. Unit economics stay healthy well into tens of thousands of users.

**Initial launch costs (one-time):**
- Google Play Developer account: $25
- First month Railway: $20
- Claude Haiku during build/testing: ~$5
- **Total: ~$50**

Apple Developer account ($99/year) deferred until iOS launch.

### 6.14 Scale preparedness

Before any distribution push, the following must be in place:

**Google:**
- Submit Google OAuth verification the day Gmail connector works locally — review takes 2–6 weeks and blocks growth beyond 100 users,
- Request Gmail API quota increase at the same time,
- Have a waitlist ready for overflow during verification.

**Infrastructure:**
- PgBouncer connection pooler configured (prevents Postgres connection exhaustion),
- BullMQ workers stateless and horizontally scalable from day one,
- Schedule jitter implemented (prevents thundering herd at 7am/6pm),
- Job TTL and expiry handling (stale reports never delivered hours late),
- FCM batch send API (up to 500 notifications per HTTP call),
- API server and worker on separate Railway services.

**Rate limits:**
- Apply for Anthropic higher rate limit tier before any public launch,
- Exponential backoff + retry on 429 errors in workers,
- Haiku API spend alert configured (hard limit to prevent surprise bills).

**Monitoring:**
- Queue depth alerting,
- Worker error rate alerting,
- Uptime monitoring on API server,
- Every agent run logged with status and token usage.

**Note on virality:** Infrastructure failures during a viral moment (servers down, slow delivery) are survivable and often endearing if handled openly. Product failures during a viral moment (wrong outputs, broken trust) are not. Prioritise output quality and failure transparency over perfect infrastructure.

### 6.15 Tech stack summary

| Layer | Technology | Reason |
|---|---|---|
| Mobile | Flutter (Android-first) | Single codebase, native performance |
| Web | Flutter Web + Monaco Editor | Same codebase, coding agent IDE |
| Backend API | Node.js + Fastify | MCP SDK compatibility, performance |
| Auth | Better Auth (self-hosted) | Open source, MCP-ready, zero cost |
| Database | PostgreSQL (direct) | Messages, agents, tokens, runs |
| Job queue | BullMQ + Redis | Cron scheduling, retries, concurrency |
| Token vault | Custom AES-256-GCM in Postgres | Full ownership, zero third-party cost |
| MCP client | `@modelcontextprotocol/sdk` | Official SDK, post-SEP-2207 |
| MCP servers | Self-hosted open-source | Gmail, Drive, Slack, web search |
| LLM | Claude Haiku API | Intent parsing, summarization, chat |
| Agent sandbox | NVIDIA OpenShell (Phase 3+) | Kernel-level isolation, coding agents |
| Push | Firebase Cloud Messaging | Free, Flutter-native |
| Hosting (MVP) | Railway | Simple, cheap, fast iteration |
| Hosting (Phase 3+) | AWS EC2 + NVIDIA GPUs | OpenShell, coding agents, scale |

## 8. Build Order

### Week 1 — Foundation
- Docker Compose local environment (Postgres + Redis + Node.js in one command),
- Postgres schema (all tables from section 6.4),
- Better Auth setup (email/password, JWT, sessions),
- Fastify API skeleton with auth middleware,
- Flutter project scaffold, secure storage, dio HTTP client.

### Week 2 — UI and API contract
- Flutter messaging inbox (contact list, chat thread, creation prompt),
- API routes that match UI needs (agents CRUD, messages, auth),
- Pre-installed Assistant contact seeded at sign-up,
- Mock data in Flutter to validate UI before backend is fully connected.

### Week 3 — First agent end to end
- BullMQ + Redis job queue setup,
- Anthropic server-side web search enabled (no OAuth needed),
- Tech News Agent: schedule → BullMQ fires → web search → Haiku summarizes → message written → FCM push,
- Flutter receives push, opens thread, shows message,
- First real agent message in the inbox.

Implementation note: Week 3 realtime delivery is being completed with an authenticated backend event stream first. Firebase/FCM push is postponed until the Android application ID, Firebase project, backend domains, and dev/staging/prod environment split are stable. This avoids locking test push configuration to temporary app identity.

### Week 4 — Gmail connector
- Google Cloud Console OAuth app setup,
- Gmail OAuth flow (auth URL → in-app browser → callback → token vault),
- Token vault (AES-256-GCM encrypt/decrypt + refresh logic),
- Gmail MCP server running locally,
- Email Digest Agent end to end,
- **Submit Google OAuth verification this week — not at launch.**

### Week 5+ — More agents and polish
- Slack connector + Slack Digest Agent,
- Drive connector + PDF Summary Agent,
- Agent reply handling (user replies fed back to agent context),
- Unsupported connector graceful fallback,
- Templates on creation screen,
- Free tier enforcement (3 agents, daily minimum interval),
- Pause/resume/delete agent.

### Pre-launch
- Google OAuth verification approved,
- Haiku spend alerts configured,
- Queue depth monitoring live,
- Waitlist ready for overflow,
- Play Store internal testing track live,
- Privacy policy and terms of service published.

---

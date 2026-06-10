# Sydney — Design Doc
### Internal alias: Sydney | Version 5

---

## 1. Product Idea

### Working concept
A mobile-first app that lets anyone create persistent AI agents by describing what they want in plain language — one sentence, no setup, no technical knowledge required.

The interface model is a **messaging platform**, not a dashboard. Every agent is a contact. Every agent output is a message. The app feels like WhatsApp — except instead of friends sending you messages, your agents are sending you reports, summaries, alerts, and digests. You reply to refine them, just like replying to a contact.

The core promise:
**"Your agents message you. You just read."**

The product is not an automation builder. It is not a chat interface. It is a **delegation layer** — a set of always-on contacts that work for you and report back.

### What the user says
- "Deliver me tech news every morning at 7am."
- "Check my email every day and give me a report at 6pm."
- "Summarize the PDFs in my Drive every Friday."
- "Watch Slack for urgent messages and alert me."
- "Give me an end-of-day report of what I did today."

### What the app does
Sydney translates a plain-language prompt into a persistent agent by identifying:
- the user intent,
- the tool or data source required,
- the action to perform,
- the schedule or trigger,
- the delivery format,
- and any required permissions.

It then creates a new agent contact in the inbox that:
- connects to user-approved services via MCP,
- executes on a schedule or event trigger,
- gathers, summarizes, or analyzes data,
- sends the result as a message in its chat thread,
- delivers a push notification like a new WhatsApp message,
- learns from user replies to improve over time.

### Product layers
Three layers of capability, all inside the same messaging interface:

**Layer 1 — Custom agents (core product)**
User describes what they want in one sentence. Sydney creates a dedicated agent contact that runs on a schedule and messages results. Every user's agent list is unique to them. This is the primary product.

**Layer 2 — Connected chat (via Assistant contact)**
The pre-installed Assistant contact answers on-demand questions using live data from connected services. "What emails did I miss today?" pulls from Gmail via MCP and answers in real time. Like Perplexity but for the user's own data.

**Layer 3 — General chat (via Assistant contact)**
The same Assistant contact handles plain AI conversation — drafting, thinking, answering questions — powered by Claude Haiku. No recurring schedule, just chat.

All three layers live in the same inbox. All feel like conversations with contacts.

### Product category
Sydney sits between messaging platforms, personal AI assistants, recurring reporting tools, and consumer automation — but belongs to none of them. It is a new category: a **personal delegation layer** delivered as a messaging app.

It is not a power-user workflow app.
It is not a developer tool.
It is not another AI chat interface.

---

## 2. Product Principles

1. **Agents message you. You don't query them.**
   The default mode is push, not pull. Agents reach out. Users receive. This is the fundamental inversion from every other AI product.

2. **Every agent is a contact.**
   The mental model is a contact list, not a dashboard. Each agent has a name, a purpose, and a full chat history. Creating an agent is like adding a new contact that starts working immediately.

3. **Custom agents are the product. Templates are shortcuts.**
   The primary creation flow is always: user types what they want in plain language → agent is created. Templates pre-fill the prompt bar for users who don't know where to start. Both paths produce identical custom agents.

4. **The Assistant contact is always there.**
   A pre-installed Assistant contact is present from the moment the user signs up. It handles general chat, connected chat, and onboarding. The inbox is never empty.

5. **Hide all infrastructure.**
   Users never see MCP, APIs, workflows, triggers, connectors, or any technical concept. They see contacts, messages, and permissions.

6. **Speak in outcomes, not tools.**
   The UI centers on tasks: "daily brief," "weekly report," "watch and alert," "summarize," "remind."

7. **Default to read-first behavior.**
   Start with summaries, monitoring, and reporting before allowing autonomous actions.

8. **Make permissions explicit.**
   The user always knows what an agent can access and what it can do.

9. **Every agent should feel trustworthy.**
   A user should always understand what happened, why, and when. Failures surface as messages, never as silent errors.

10. **One-line creation.**
    The strongest experience is when a user creates a useful agent with one sentence.

---

## 3. Target Users

### Primary users
Non-technical consumers who want recurring digital help:
- busy professionals,
- founders,
- students,
- creators,
- managers,
- freelancers,
- anyone overwhelmed by inboxes, files, tasks, and updates.

### User mindset
These users do not want automation. They want relief.

They are not asking "how do I build a workflow?" They are asking "can something just handle this for me?"

The messaging interface serves this perfectly. The user does not manage a system. They receive messages from contacts that are handling things for them.

### Early adopters
People with:
- high email volume,
- active Slack or messaging workspaces,
- recurring reporting needs,
- frequent document review tasks,
- repetitive information monitoring,
- exam preparation or daily learning goals — students are a high-value early adopter segment with strong word-of-mouth in peer groups.

---

## 4. Core Use Cases

### Custom agents (user-defined, unlimited combinations)
Users create agents by describing what they want. Any combination of connector + schedule + output is a valid agent. Examples:

- "deliver me tech news at 7am daily"
- "summarize my emails every evening at 6pm"
- "alert me when someone mentions my name in Slack"
- "summarize any PDF I share with you"
- "give me a weekly Drive folder change report every Friday"
- "remind me to follow up with leads every Monday morning"
- "give me a coding tip every morning"
- "summarize my calendar for the week every Sunday night"
- "create a study plan for my JEE exam on November 15th — Physics, Chemistry, Maths"
- "send me a Spanish word every morning and track my streak"
- "watch my competitors and tell me what they shipped every week"
- "audit my subscriptions every month and flag ones I haven't used"
- "give me a fitness check every morning based on my sleep and steps"
- "send me a job market update every Monday for senior product roles in Bangalore"

No two users' agent lists will look the same. That personalisation is core to the value.

### Unsupported connector handling
If a user requests a connector Sydney doesn't support yet, the intent parser responds gracefully:

```
User: "monitor my Instagram DMs"

Sydney: I can't access Instagram yet.
        I can monitor your Gmail or Slack instead —
        want me to set one of those up?
```

### Information digest
- daily email summary,
- tech news brief,
- Slack digest,
- project status report,
- meeting recap,
- folder change summary.

### Monitoring
- watch Gmail for important messages,
- monitor Slack for flagged keywords,
- track Drive documents for changes,
- alert on deadlines or missed follow-ups.

### Summarization
- PDFs, docs, threads, meeting notes, message history.

### Reporting
- end-of-day task report,
- weekly progress summary,
- project health report,
- "what changed since yesterday."

### Reminder and follow-up
- recurring reminders,
- follow-up nudges,
- calendar-based prompts,
- context-aware alerts.

### Connected chat (Assistant contact)
- "what important emails did I miss today?"
- "summarize what happened in Slack this week"
- "what files changed in my Drive folder?"
- real-time answers using live MCP-fetched user data.

### General chat (Assistant contact)
- ask anything,
- draft content,
- think through problems,
- plain AI conversation powered by Claude Haiku.

### Light action taking (Phase 3+)
- drafting responses,
- creating docs,
- scheduling calendar events,
- filing or organizing content,
- sending approved messages.

### Study and learning agents
A dedicated category worth calling out — no connector required, pure scheduled intelligence, extremely high daily engagement.

**Study plan agent:**
User says "create a study plan for JEE on November 15th — Physics, Chemistry, Maths." Sydney generates a day-by-day plan, messages the user every morning with today's topic, tracks completion via replies, implements spaced repetition automatically, and shifts to full revision mode in the final 2 weeks.

Agent lifecycle:
- Day 1: full plan generated, messaged to user
- Daily 8am: today's topic, estimated time, progress update
- Weekly: plan adjustment if user is behind or ahead
- Spaced repetition: topics revisited at day 7, day 25, day 55 automatically
- Critical period (14 days before exam): switches to revision-only mode
- Exam eve: sends checklist, encouragement, no new content

This agent requires zero connectors, works from day one, creates daily habit, and serves India's 2.5M+ JEE aspirants, 2M+ NEET aspirants, plus global exam markets. Strong word-of-mouth vector — students share tools with classmates.

**Learning streak agent:**
Daily word, concept, or skill delivery with streak tracking. User says "teach me one Spanish word every morning." Agent delivers word, example sentence, pronunciation note, and streak counter. User replies "got it" or "need review" — agent adjusts difficulty over time.

**Habit anchor agent:**
"Remind me to meditate every morning and track my streak." Agent messages daily, tracks consistency via replies, sends milestone messages at day 7, day 21, day 66 (habit formation research milestones), and adjusts encouragement tone based on streak health.

---

## 5. Product Scope

### What the product does well
- presents agents as contacts in a messaging interface,
- creates custom agents from plain language in one step,
- pre-installs an Assistant contact so the inbox is never empty,
- connects to user accounts with simple permissioning,
- runs recurring or event-driven jobs reliably,
- delivers outputs as messages with push notifications,
- supports replies that refine agent behaviour,
- manages multiple agents in one inbox,
- makes pausing, editing, and deleting easy,
- shows full message history per agent.

### What the product does not do first
- open-ended autonomous web browsing,
- multi-step action chains with high risk,
- complex visual flow builders,
- enterprise admin dashboards,
- developer-centric config or JSON editing,
- any action that writes or modifies user data (Phase 3+).

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

---

## 7. UI and Design

### 7.1 Design direction
Sydney should feel like a messaging app, not a productivity tool.

Reference: WhatsApp, iMessage, Telegram — calm, fast, familiar, trustworthy.
Not: Notion, Linear, Zapier, or any dashboard-first product.

The user manages contacts, not automations.

### 7.2 Visual language
- clean white or near-white surfaces,
- rounded message bubbles,
- contact avatar per agent (emoji or generated icon),
- large readable typography,
- unread indicators like a messaging app,
- minimal chrome, maximum content,
- restrained color palette — color used only for status signals.

### 7.3 Primary screens

#### Inbox (home screen)
Agent contact list sorted by most recent message. The Assistant contact is always at the top or pinned.

```
┌─────────────────────────────────────────┐
│  Sydney                       + New     │
├─────────────────────────────────────────┤
│ 🤖  Assistant                     now   │
│     Hey! I'm Sydney. Ask me anything…  │
├─────────────────────────────────────────┤
│ 📧  Email Digest                  6:00pm│
│     47 emails today, 6 need att…   ●●  │
├─────────────────────────────────────────┤
│ 📰  Tech News                     7:02am│
│     Morning brief: 8 stories today…    │
├─────────────────────────────────────────┤
│ 💬  Slack Watcher                 2:31pm│
│     Urgent: 2 messages flagged…    ●   │
├─────────────────────────────────────────┤
│ 📄  Drive Summary                 Friday│
│     3 files changed this week…         │
└─────────────────────────────────────────┘
```

#### Assistant contact (pre-installed, always present)
The Assistant contact is pre-installed at sign-up. It sends a welcome message immediately:

```
🤖 Assistant                         just now

Hey! I'm Sydney.

I can chat with you like Claude or
ChatGPT — just ask me anything.

But the real magic is agents. Try:

  "deliver me tech news at 7am daily"

and I'll create an agent that messages
you every morning. ✨

What would you like to do?
```

The Assistant handles:
- general chat (plain AI conversation),
- connected chat (live data from connected services),
- onboarding guidance for new users,
- answering questions about Sydney's capabilities.

When services are connected, the Assistant becomes dramatically more powerful:
```
User:       what important emails did I miss today?
Assistant:  [fetches Gmail via MCP]
            You missed 6 important emails:
            → Alice re: Q3 budget (2hrs ago)
            → Stripe invoice ready
            → Team standup notes from Bob
            → 3 others flagged as important
```

#### Agent chat thread
Tapping any agent opens its chat thread. Agent messages on the left, user replies on the right. Full history of everything the agent has sent and the user has replied.

```
┌─────────────────────────────────────────┐
│ ←  📧 Email Digest           Active  ⋮  │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────────────────────────┐   │
│  │ Here's your email digest for    │   │
│  │ Tuesday 13 May.                 │   │
│  │                                 │   │
│  │ 47 emails · 6 need attention    │   │
│  │                                 │   │
│  │ → Alice: Q3 budget review       │   │
│  │ → Team standup notes            │   │
│  │ → Stripe invoice #4521          │   │
│  │   ...and 3 more                 │   │
│  └──────────────────────────────────┘   │
│  6:00 PM                                │
│                                         │
│            Filter out newsletters  ───► │
│                                 6:03PM  │
│  ┌──────────────────────────────────┐   │
│  │ Got it. Excluding newsletters   │   │
│  │ from tomorrow's digest onwards. │   │
│  └──────────────────────────────────┘   │
│  6:03 PM                                │
│                                         │
├─────────────────────────────────────────┤
│  Reply to Email Digest…        [Send]   │
└─────────────────────────────────────────┘
```

#### Agent creation flow
Tapping "+ New" opens a prompt bar. User types what they want. Sydney parses intent and shows a lightweight confirmation card. Templates pre-fill the prompt bar — same flow from there.

```
┌─────────────────────────────────────────┐
│  What should your agent do?             │
│                                         │
│  "deliver tech news at 7am daily"  ✍️  │
│                                         │
│  ── or start from a template ──         │
│                                         │
│  📧 Daily Email Brief                   │
│  📰 Tech News Brief                     │
│  💬 Slack Digest                        │
│  📄 PDF Summarizer                      │
│  📋 EOD Task Report                     │
│  🗓️  Weekly Review                      │
└─────────────────────────────────────────┘
```

After typing or selecting a template, confirmation card:

```
┌─────────────────────────────────────────┐
│  📰 Tech News                           │
│                                         │
│  Runs:    Daily at 7:00 AM             │
│  Does:    Searches and summarizes       │
│           tech news                     │
│  Needs:   Web search (no login needed) │
│  Sends:   Message to your inbox        │
│                                         │
│  [Cancel]              [Create Agent]   │
└─────────────────────────────────────────┘
```

Agent appears in inbox immediately. First message arrives at next scheduled time.

### 7.4 Web version UI

Split-pane layout identical to desktop messaging apps:

```
┌──────────────────┬──────────────────────────────────────────┐
│  Sydney   + New  │  📧 Email Digest                    ⚙️   │
├──────────────────┤                                          │
│ 🤖 Assistant     │  ┌──────────────────────────────────┐    │
│ Ask me anything  │  │ Tuesday 13 May — 6pm Report     │    │
│                  │  │ 47 emails · 6 need attention    │    │
│ 📧 Email Digest  │  │ → Alice: Q3 budget review       │    │
│ 47 emails · 6pm  │  │ → Team standup notes            │    │
│                  │  └──────────────────────────────────┘    │
│ 📰 Tech News     │                                          │
│ 8 stories · 7am  │  ┌──────────────────────────────────┐    │
│                  │  │ Monday 12 May — 6pm Report      │    │
│ 💬 Slack         │  │ 31 emails · newsletters filtered │    │
│ 2 urgent · now   │  └──────────────────────────────────┘    │
│                  │                                          │
│ 🖥️ Coding Agent  │  Reply to Email Digest…      [Send]      │
│ PR ready · 3pm   │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

Coding agent opens an IDE panel instead of a chat thread:

```
┌──────────────────┬──────────────┬──────────────────────────┐
│  Agent Inbox     │  Code Editor │  🖥️ Coding Agent          │
│                  │              │                           │
│  ...             │  # agent.py  │  I've written the script  │
│                  │  import ...  │  and run the tests.       │
│                  │              │  All 12 passing.          │
│                  │  def main(): │                           │
│                  │    ...       │  Want me to refactor the  │
│                  │              │  error handling?          │
│                  ├──────────────┤                           │
│                  │  Terminal    │  [Yes, refactor] [No]     │
│                  │  > pytest    │                           │
│                  │  12 passed   │                           │
└──────────────────┴──────────────┴──────────────────────────┘
```

### 7.5 Interaction model

The core loop:
```
Agent runs → writes message → push notification →
user taps → opens thread → reads message →
optionally replies → agent learns → next run is better
```

Identical to receiving and replying to a WhatsApp message. The familiarity is the product.

**User replies do real things:**
- "only flag emails from my team" → agent updates filter for next run,
- "make this shorter" → agent adjusts output length,
- "run this at 8am instead" → agent reschedules,
- "what was in yesterday's report?" → agent retrieves from its own history.

---

## 7.6 Design system — tokens and constants

Every UI element in Sydney uses a shared design token system. Define once, inherit everywhere. New templates, new screens, new components all pull from the same source of truth.

### Typography
```dart
// lib/design/tokens.dart
class SydneyTypography {
  static const agentName    = TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.2);
  static const messagePreview = TextStyle(fontSize: 14, fontWeight: FontWeight.w400, height: 1.4, color: SydneyColors.textSecondary);
  static const timestamp    = TextStyle(fontSize: 12, fontWeight: FontWeight.w400, color: SydneyColors.textTertiary);
  static const messageBody  = TextStyle(fontSize: 15, fontWeight: FontWeight.w400, height: 1.6);
  static const sectionLabel = TextStyle(fontSize: 12, fontWeight: FontWeight.w500, letterSpacing: 0.04, color: SydneyColors.textTertiary);
  static const buttonLabel  = TextStyle(fontSize: 14, fontWeight: FontWeight.w500);
}
```

### Color palette
```dart
class SydneyColors {
  // backgrounds
  static const background       = Color(0xFFFFFFFF);
  static const backgroundSecondary = Color(0xFFF7F7F7);
  static const agentBubble      = Color(0xFFF2F2F2);
  static const userBubble       = Color(0xFF007AFF);

  // text
  static const textPrimary      = Color(0xFF0D0D0D);
  static const textSecondary    = Color(0xFF6B6B6B);
  static const textTertiary     = Color(0xFFAAAAAA);
  static const textOnUser       = Color(0xFFFFFFFF);

  // status
  static const onTrack          = Color(0xFF1D9E75);  // green
  static const behind           = Color(0xFFE24B4A);  // red
  static const ahead            = Color(0xFF378ADD);  // blue
  static const warning          = Color(0xFFBA7517);  // amber

  // unread indicator
  static const unreadDot        = Color(0xFF007AFF);

  // borders
  static const border           = Color(0xFFEAEAEA);
  static const borderStrong     = Color(0xFFD0D0D0);
}
```

### Spacing and shape
```dart
class SydneySpacing {
  static const xs  = 4.0;
  static const sm  = 8.0;
  static const md  = 12.0;
  static const lg  = 16.0;
  static const xl  = 24.0;
  static const xxl = 32.0;
}

class SydneyRadius {
  static const message    = 18.0;  // message bubbles
  static const card       = 14.0;  // agent cards
  static const button     = 10.0;  // action buttons
  static const avatar     = 24.0;  // agent avatar circles
  static const progressBar = 6.0;  // progress bars
}
```

### Animation constants
```dart
class SydneyAnimations {
  // thread open — slide up + fade
  static const threadOpen = Duration(milliseconds: 280);
  static const threadOpenCurve = Curves.easeOutCubic;

  // new message arrival — fade + slide from bottom
  static const messageArrive = Duration(milliseconds: 220);
  static const messageArriveCurve = Curves.easeOutQuart;

  // agent typing indicator — pulse
  static const typingPulse = Duration(milliseconds: 600);

  // progress bar fill — animated on first render
  static const progressFill = Duration(milliseconds: 800);
  static const progressFillCurve = Curves.easeOutCubic;

  // confirmation card appear — scale + fade
  static const cardAppear = Duration(milliseconds: 240);
  static const cardAppearCurve = Curves.easeOutBack;
}
```

### The 10-second rule
Every new screen is evaluated against one question before shipping:

> Does a non-technical person understand what to do within 10 seconds, without reading any instructions?

If the answer is no, the screen is redesigned. Not simplified — redesigned. Every screen has one primary action. Every screen has one clear hierarchy. No competing calls to action anywhere.

---

## 7.7 Output template system

This is one of Sydney's core differentiators. Every agent message is rendered using a purpose-built template widget — not a generic text blob. The LLM returns structured JSON. Flutter renders the right widget automatically.

### How it works end to end

**Step 1 — Intent parser assigns a template**

When an agent is created, the intent parser returns a template type alongside the agent definition:

```typescript
// intent parsing response
{
  "intent": "study_plan",
  "connector": null,
  "schedule": "0 8 * * *",
  "output_template": "progress_tracker",
  "template_config": {
    "has_progress_bars": true,
    "has_countdown": true,
    "has_streak": true,
    "has_action_buttons": true,
    "has_checklist": false
  }
}
```

**Step 2 — Agent runtime returns structured JSON**

Every agent execution returns a typed JSON payload, not raw text:

```typescript
// stored in agent_messages.content as JSON string
{
  "template": "progress_tracker",
  "version": "1.0",
  "data": { ... template-specific data ... }
}
```

**Step 3 — Flutter renders the right widget**

```dart
// lib/widgets/agent_message_widget.dart
class AgentMessageWidget extends StatelessWidget {
  final AgentMessage message;

  @override
  Widget build(BuildContext context) {
    final content = jsonDecode(message.content);

    switch (content['template']) {
      case 'progress_tracker':
        return ProgressTrackerTemplate(data: content['data']);
      case 'plain_text':
        return PlainTextTemplate(data: content['data']);
      case 'urgency_list':
        return UrgencyListTemplate(data: content['data']);
      case 'data_summary':
        return DataSummaryTemplate(data: content['data']);
      case 'checklist':
        return ChecklistTemplate(data: content['data']);
      case 'streak_counter':
        return StreakCounterTemplate(data: content['data']);
      case 'comparison':
        return ComparisonTemplate(data: content['data']);
      case 'timeline':
        return TimelineTemplate(data: content['data']);
      case 'system':
        return SystemMessageTemplate(data: content['data']);
      default:
        return PlainTextTemplate(data: content['data']);
    }
  }
}
```

**Step 4 — Interactive elements send replies**

Action buttons inside templates are tappable. Tapping sends a structured reply back to the agent:

```dart
// inside any template widget
ActionButton(
  label: 'Done for today',
  onTap: () => context.read<AgentCubit>().sendReply(
    agentId: message.agentId,
    action: 'mark_done',
    payload: { 'date': DateTime.now().toIso8601String() }
  )
)
```

The backend receives the reply, updates agent state, adjusts next run accordingly. No separate settings screen needed — the message IS the interface.

---

### Template 1 — plain_text

**Used for:** tech news agent, general summaries, assistant chat responses, any agent without structured data.

**JSON payload:**
```json
{
  "template": "plain_text",
  "data": {
    "headline": "Your morning tech brief",
    "body": "8 stories worth reading today...",
    "items": [
      { "title": "OpenAI launches GPT-5", "summary": "...", "source": "TechCrunch", "url": "..." },
      { "title": "Apple acquires startup", "summary": "...", "source": "Bloomberg", "url": "..." }
    ],
    "footer": "Delivered every day at 7am"
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ Your morning tech brief              │
│                                      │
│ 1. OpenAI launches GPT-5            │
│    One line summary here.            │
│    TechCrunch ↗                      │
│                                      │
│ 2. Apple acquires startup            │
│    One line summary here.            │
│    Bloomberg ↗                       │
│                                      │
│ + 6 more stories                     │
└──────────────────────────────────────┘
```

**Build order:** Week 3 (first template, built with tech news agent)

---

### Template 2 — progress_tracker

**Used for:** study plan agent, fitness agent, habit agent, project milestone agent, any agent tracking progress toward a goal over time.

**JSON payload:**
```json
{
  "template": "progress_tracker",
  "data": {
    "day_current": 67,
    "day_total": 183,
    "countdown_label": "116 days to JEE",
    "today": {
      "subject": "Physics",
      "topic": "Newton's Laws of Motion",
      "estimated_minutes": 45,
      "context": "Builds on yesterday's Kinematics session"
    },
    "progress_bars": [
      { "label": "Physics",   "percent": 80, "status": "on_track" },
      { "label": "Chemistry", "percent": 50, "status": "on_track" },
      { "label": "Maths",     "percent": 30, "status": "behind"   }
    ],
    "overall": { "percent": 58, "status": "on_track" },
    "streak": 12,
    "message": "You're on track. Keep going.",
    "actions": [
      { "id": "done",      "label": "Done for today", "style": "primary" },
      { "id": "more_time", "label": "Need more time", "style": "secondary" },
      { "id": "skip",      "label": "Skip",            "style": "ghost" }
    ]
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ Day 67 of 183           116 days 🎯  │
├──────────────────────────────────────┤
│ Today — Physics                      │
│ Newton's Laws of Motion              │
│ ~45 min · builds on Kinematics       │
├──────────────────────────────────────┤
│ Physics    ████████░░  80%  ✓        │
│ Chemistry  █████░░░░░  50%  ✓        │
│ Maths      ███░░░░░░░  30%  ↓        │
├──────────────────────────────────────┤
│ Overall    ██████░░░░  58% on track  │
│ 🔥 12 day streak                     │
├──────────────────────────────────────┤
│ [Done for today] [Need more time]    │
│              [Skip]                  │
└──────────────────────────────────────┘
```

**Adaptive behaviour:**
- User taps "Need more time" → agent adds 1 extra day to this topic
- User taps "Skip" 3 days in a row → agent sends concern message and asks to adjust plan
- User taps "Done" consistently for 7 days → agent sends encouragement + notes streak
- Progress bar for "Maths" at 30% with exam in 116 days → agent flags as behind, suggests extra sessions

**Build order:** V1.1 (after launch)

---

### Template 3 — urgency_list

**Used for:** Slack watcher, Gmail monitor, keyword alert agent, any agent that surfaces time-sensitive items requiring attention.

**JSON payload:**
```json
{
  "template": "urgency_list",
  "data": {
    "headline": "2 urgent messages flagged",
    "source": "Slack · #product channel",
    "timestamp": "2:31 PM",
    "items": [
      {
        "level": "urgent",
        "from": "Rahul",
        "preview": "The API is returning 500 errors on prod",
        "time": "2:28 PM",
        "channel": "#engineering"
      },
      {
        "level": "mention",
        "from": "Priya",
        "preview": "Hey can you review the PR when you get a chance?",
        "time": "1:15 PM",
        "channel": "#design"
      }
    ],
    "skipped": 47,
    "skipped_label": "47 other messages not flagged"
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ ⚡ 2 urgent · Slack · 2:31 PM        │
├──────────────────────────────────────┤
│ 🔴 Rahul · #engineering · 2:28 PM   │
│ "The API is returning 500 errors     │
│  on prod"                            │
├──────────────────────────────────────┤
│ 🔵 Priya mentioned you · 1:15 PM    │
│ "Can you review the PR when you      │
│  get a chance?"                      │
├──────────────────────────────────────┤
│ 47 other messages · not flagged      │
└──────────────────────────────────────┘
```

**Build order:** V1.2

---

### Template 4 — data_summary

**Used for:** email digest, portfolio agent, subscription auditor, analytics agent, any agent that summarizes quantitative or categorical data.

**JSON payload:**
```json
{
  "template": "data_summary",
  "data": {
    "headline": "Your email digest · Tuesday 13 May",
    "stats": [
      { "label": "Received",  "value": "47", "sublabel": "emails today" },
      { "label": "Important", "value": "6",  "sublabel": "need attention" },
      { "label": "Filtered",  "value": "23", "sublabel": "newsletters removed" }
    ],
    "items": [
      { "priority": "high",   "from": "Alice",   "subject": "Q3 budget review", "time": "3:12 PM" },
      { "priority": "high",   "from": "Stripe",  "subject": "Invoice #4521 ready", "time": "1:05 PM" },
      { "priority": "medium", "from": "Bob",     "subject": "Standup notes attached", "time": "10:30 AM" }
    ],
    "more_count": 3,
    "footer": "Newsletters filtered · tap to adjust"
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ Email digest · Tuesday 13 May        │
├──────────────────────────────────────┤
│  47          6          23           │
│  received    important  filtered     │
├──────────────────────────────────────┤
│ 🔴 Alice · Q3 budget review          │
│ 🔴 Stripe · Invoice #4521 ready      │
│ 🟡 Bob · Standup notes attached      │
│ + 3 more important                   │
├──────────────────────────────────────┤
│ Newsletters filtered · adjust ↗      │
└──────────────────────────────────────┘
```

**Build order:** V1.1 (with Gmail connector)

---

### Template 5 — checklist

**Used for:** travel agent, pre-exam checklist, weekly review agent, any agent that delivers actionable items the user should complete.

**JSON payload:**
```json
{
  "template": "checklist",
  "data": {
    "headline": "JEE exam eve checklist",
    "subtitle": "Tomorrow is the big day.",
    "message": "Don't study tonight. Your brain is ready.",
    "items": [
      { "id": "1", "label": "Admit card printed",   "checked": false },
      { "id": "2", "label": "Pencils and pens ready", "checked": false },
      { "id": "3", "label": "Alarm set for 6am",    "checked": false },
      { "id": "4", "label": "Dinner eaten",          "checked": false },
      { "id": "5", "label": "Phone charging",        "checked": false }
    ],
    "footer": "You started this 183 days ago. You've got this. 🎯"
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ JEE exam eve checklist               │
│ Don't study tonight. Brain is ready. │
├──────────────────────────────────────┤
│ ☐  Admit card printed                │
│ ☐  Pencils and pens ready            │
│ ☐  Alarm set for 6am                 │
│ ☐  Dinner eaten                      │
│ ☐  Phone charging                    │
├──────────────────────────────────────┤
│ You started 183 days ago. 🎯         │
└──────────────────────────────────────┘
```

Checklist items are tappable — checking one sends a reply to the agent which stores completion state.

**Build order:** V1.3

---

### Template 6 — streak_counter

**Used for:** habit agent, learning agent, fitness agent, any agent built around daily consistency and streaks.

**JSON payload:**
```json
{
  "template": "streak_counter",
  "data": {
    "headline": "Daily Spanish word",
    "word": "Madrugada",
    "definition": "The hours between midnight and dawn",
    "example": "Me desperté en la madrugada.",
    "translation": "I woke up in the early hours.",
    "streak": 14,
    "streak_message": "14-day streak intact. The habit is forming.",
    "milestone_next": 21,
    "milestone_label": "21 days = automatic habit",
    "actions": [
      { "id": "learned", "label": "Got it ✓", "style": "primary" },
      { "id": "review",  "label": "Need review", "style": "secondary" }
    ]
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ Daily Spanish · Day 14               │
├──────────────────────────────────────┤
│ Madrugada                            │
│ The hours between midnight and dawn  │
│                                      │
│ "Me desperté en la madrugada."       │
│ I woke up in the early hours.        │
├──────────────────────────────────────┤
│ 🔥 14-day streak · 7 days to habit   │
│ ░░░░░░░░░░░░░░█████████████████░░░░  │
│              14 of 21                │
├──────────────────────────────────────┤
│ [Got it ✓]        [Need review]      │
└──────────────────────────────────────┘
```

**Build order:** V1.3

---

### Template 7 — comparison

**Used for:** competitor watcher, market research agent, portfolio comparison agent, any agent that surfaces side-by-side data over time.

**JSON payload:**
```json
{
  "template": "comparison",
  "data": {
    "headline": "Competitor weekly watch",
    "period": "Week of May 12",
    "rows": [
      {
        "label": "Notion",
        "changes": ["Launched AI meeting recorder", "3 blog posts"],
        "sentiment": "active"
      },
      {
        "label": "Linear",
        "changes": ["Shipped new roadmap view"],
        "sentiment": "neutral"
      }
    ],
    "insight": "Notion moving into async meeting space. Worth watching.",
    "trending_narrative": "Both competitors emphasizing async work this week."
  }
}
```

**Build order:** V1.4

---

### Template 8 — system

**Used for:** error messages, token reconnection prompts, agent paused notifications, onboarding messages. Not agent output — internal Sydney communication.

```json
{
  "template": "system",
  "data": {
    "type": "connector_disconnected",
    "icon": "⚠️",
    "message": "I lost access to your Gmail.",
    "detail": "Your token may have expired or been revoked.",
    "action": { "label": "Reconnect Gmail", "type": "reconnect", "connector": "gmail" }
  }
}
```

**Renders as:**
```
┌──────────────────────────────────────┐
│ ⚠️  Lost access to Gmail             │
│ Your token may have expired.         │
│                                      │
│ [Reconnect Gmail]                    │
└──────────────────────────────────────┘
```

System messages use a subtly different visual style — slightly muted background, no agent avatar — so the user immediately knows this is from Sydney itself, not from agent output.

**Build order:** Week 3 (needed from day one for error handling)

---

### Template rollout plan

```
Week 3 (MVP launch)
  plain_text      → tech news, general summaries
  system          → errors, reconnect prompts

V1.1 (post-launch, ~2 weeks after)
  data_summary    → email digest, portfolio
  progress_tracker → study agent

V1.2
  urgency_list    → Slack watcher, Gmail monitor

V1.3
  checklist       → travel, pre-exam
  streak_counter  → habit, learning agents

V1.4
  comparison      → competitor watch, market agents
  timeline        → project agents, roadmap agents
```

### Adding new templates — developer guide

Adding a new template requires changes in exactly three places:

**1. Backend — add to intent parser prompt**
```typescript
// src/agents/intent-parser.ts
// Add new template to the allowed output_template values
// and describe when to use it in the system prompt
```

**2. Backend — add agent runtime output schema**
```typescript
// src/agents/templates/{template_name}.schema.ts
// Define the JSON schema for the template's data payload
// Haiku is prompted to return this exact structure
```

**3. Flutter — add widget**
```dart
// lib/widgets/templates/{template_name}_template.dart
// Implement the StatelessWidget that renders the template
// Must use only SydneyColors, SydneyTypography, SydneySpacing tokens
// Must handle null/missing data gracefully
// Must be testable with mock data
```

That's it. No other files change. The routing in `AgentMessageWidget` uses a switch on the template string — new case added, done.

---

## 7.8 UI quality standard

Sydney's UI is held to the standard of the apps users compare it to unconsciously — WhatsApp, ChatGPT, Claude, Gmail. These apps were designed by world-class teams over years. Sydney must match their *feel*, not their feature set.

### The non-negotiables before any public release

**Typography is handled with care.**
Every font size, weight, and line height is intentional. No default Flutter text styles anywhere in the app. Everything uses `SydneyTypography` tokens.

**Whitespace is generous.**
The inbox breathes. Message bubbles have comfortable padding. Nothing feels cramped. When in doubt, add more space.

**Loading states are designed.**
No raw CircularProgressIndicator anywhere visible to users. Every loading state has a designed skeleton or animation that communicates "working" not "broken."

**Empty states are warm.**
The inbox with no agents shows the Assistant contact and a warm invitation, not a blank screen. Every empty state has a purpose.

**Errors are human.**
No technical error messages exposed to users. "Something went wrong" is never acceptable. Every error is specific, honest, and tells the user what to do next.

**Animations are purposeful.**
Every transition has an animation. Every animation uses the tokens in `SydneyAnimations`. No jarring cuts between screens. No unnecessary animations that slow the user down.

**The first 10 seconds test.**
Every new screen is shown to a non-technical person. If they don't immediately understand what to do, the screen is redesigned before it ships.

---

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

## 9. MVP Plan

### 9.1 Best MVP wedge
Read-first recurring agents — agents that message the user on a schedule with useful summaries. Zero risk of unwanted actions.

Starting agents:
- Tech News Brief (web search, no OAuth — build first),
- Daily Email Digest (Gmail OAuth — validates full auth stack),
- Slack Digest,
- PDF Summarizer,
- EOD Task Report.

### 9.2 MVP features
- email/password sign-in via Better Auth,
- pre-installed Assistant contact (general + connected chat),
- prompt-first custom agent creation with confirmation card,
- template shortcuts on creation screen,
- messaging inbox (contact list + chat threads),
- scheduled agent execution via BullMQ,
- push notifications (FCM, WhatsApp-style),
- user replies fed back to agent context,
- pause / resume / delete agent,
- free tier enforcement (3 agents, daily minimum, Assistant excluded),
- graceful unsupported connector response.

### 9.3 First connectors
- Web search (Anthropic server-side web search, no OAuth — day one),
- Gmail,
- Google Drive,
- Slack.

### 9.4 MVP success metrics
- Agent created in under 60 seconds,
- Agent sends useful first message on day one,
- User opens app the next day from a notification (day-2 retention),
- User replies to an agent within the first week.

Day-2 retention driven by push notifications is the single most important early signal.

---

## 10. Roadmap

### Phase 1 — Read-only agents (MVP)
Agents message you with summaries, digests, reports. You reply to refine them. No actions taken on your behalf. Assistant contact for general and connected chat.

### Phase 2 — Web version
Full web app with split-pane inbox, multi-agent overview, and connected chat. Same backend, same agents, same history across mobile and web.

### Phase 3 — Assisted actions + OpenShell + EC2
Agents suggest actions in messages. User taps to approve. Migrate to EC2 + OpenShell for kernel-level sandboxing. Introduce coding agent with IDE panel on web.

### Phase 4 — Light autonomous actions
Agents take low-risk actions within pre-approved boundaries: filing, tagging, scheduling, marking tasks complete. OpenShell enforces safety at runtime level.

### Phase 5 — Multi-agent orchestration
Agents trigger other agents. Slack watcher tells email agent to include a thread summary. Agents share context and collaborate. Agent marketplace — users publish and install community agents.

### iOS
After web version is stable. Same Flutter codebase, one config change.

---

## 11. Key Risks

### 1. Trust collapse
If an agent misses an important email or sends a bad summary twice, the user stops trusting it and stops opening notifications. Output quality is the product. Failure transparency is mandatory.

### 2. Notification fatigue
If agents message too frequently or with low-value content, users mute notifications and the core loop breaks. Every message must earn its place.

### 3. Google OAuth verification delay
Google caps unverified apps at 100 users for Gmail/Drive scopes. Verification takes 2–6 weeks. Submitting late blocks growth at the worst possible time. Submit the week Gmail works locally.

### 4. Haiku rate limits at scale
5,000 users with 7am news agents fire simultaneously without jitter. Apply for higher Anthropic rate limits before launch. Implement jitter and 429 retry logic from day one.

### 5. Token vault reliability
Silent refresh failures cause agents to stop messaging without explanation. Every failure must surface as a message in the agent thread immediately.

### 6. Overreach
Too many connectors or agent types at launch creates confusion. Launch with 4 connectors maximum. Expand based on user requests.

### 7. Generic positioning
Described as "another AI assistant," Sydney is ignored. "Agents that message you" must be the consistent frame everywhere — App Store description, first tweet, onboarding message, press coverage.

### 8. Platform risk (OpenShell alpha)
OpenShell is alpha software in single-player mode. Not suitable for multi-tenant Phase 1 deployment. Adopt only at Phase 3 when sandboxed actions are introduced.

---

## 12. Positioning

### Core positioning
**AI agents that message you.**

Not a chatbot you open. Not a dashboard you manage. Contacts that work for you and report back — like getting a WhatsApp message, except it's your email digest, news brief, or Slack summary.

### Competitive differentiation

| | Sydney | Claude / ChatGPT | Perplexity | Zapier / n8n |
|---|---|---|---|---|
| Works while you're away | ✓ | ✗ | ✗ | ✓ |
| Consumer mobile app | ✓ | ✓ | ✗ | ✗ |
| Messaging interface | ✓ | ✗ | ✗ | ✗ |
| Knows your real data | ✓ | ✗ | ✗ | ✓ |
| No-code creation | ✓ | N/A | N/A | ✗ |
| Scheduled agents | ✓ | ✗ | ✗ | ✓ |

### Pricing anchor
$9.99/month sits between:
- Claude Pro / ChatGPT Plus (~$20) — AI you have to ask,
- Perplexity Pro (~$20) — search you have to initiate.

Half the price. Does something neither can: works while you're away and messages you unprompted.

### Good messaging
- "AI agents that message you."
- "Your daily briefings, summaries, and alerts — delivered like messages."
- "Tell it what you want. It handles the rest."

### Avoid
- "MCP-powered agent builder" — too technical,
- "workflow automation platform" — wrong audience,
- "developer agent framework" — wrong audience,
- "AI assistant" — too generic, indistinguishable.

---

## 13. Final Product Thesis

Sydney inverts the relationship between users and AI.

Every other AI product asks the user to show up and ask. Sydney has the AI show up and tell.

From pull to push. From tool to contact. From dashboard to inbox. From "I need to remember to check this" to "it already messaged me."

That inversion is what makes Sydney a new consumer software category rather than another feature on an existing product. It is not an AI wrapper. The AI is one component of a platform that includes a custom agent runtime, a per-user token vault solving a genuinely unsolved mobile OAuth problem, MCP as the connector ecosystem, OpenShell as the safety layer, and a messaging interface that makes all of it feel like talking to a contact.

The moat compounds over time:
- **Month 1–3:** First-mover on Android consumer agent messaging — no competitor has this UI,
- **Month 3–6:** Agent memory and personalisation — each user's agents learn their preferences, that context doesn't transfer to competitors,
- **Month 6–12:** MCP ecosystem compounds — every new MCP server published becomes a potential Sydney connector for free,
- **Year 2+:** Agent marketplace — community-published agents, network effects, platform lock-in.

The winning formula:
- **custom agents in one sentence**,
- **agents as contacts, outputs as messages**,
- **notifications as the retention loop**,
- **replies as the refinement mechanism**,
- **Assistant contact always present**,
- **zero visible infrastructure**,
- **trust built through transparency**.

If executed well, Sydney becomes the messaging app where your contacts work for you.
EOF

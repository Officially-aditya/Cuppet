# Cuppet

Mobile-first AI delegation app. Create persistent AI agents with one plain-language sentence - they run on schedules, use your connected accounts, and message you like WhatsApp contacts.

> **Your agents message you. You just read.**

## What it does

Cuppet is a **messaging interface for AI agents**, not a dashboard or chatbot:

| Layer | Experience |
| --- | --- |
| **Custom agents** | “Tech news every morning at 7am” → a contact that runs on cron and messages results |
| **Connected chat** | Pre-installed **Assistant** answers using live Gmail / Drive / Calendar / GitHub data |
| **General chat** | Same Assistant for normal AI conversation |

Connectors are **read-first**. OAuth tokens stay in a backend vault - the Flutter app never stores them.

### Example prompts

- “Deliver me tech news every morning at 7am”
- “Summarize my emails every evening at 6pm”
- “Give me a weekly Drive folder change report every Friday”
- “Create a study plan for my JEE exam on November 15th”

## Architecture

```
┌─────────────────────────────────────┐
│  Flutter app (frontend/)            │
│  Inbox · threads · create · OAuth UI│
└─────────────────┬───────────────────┘
                  │ REST + JWT
┌─────────────────▼───────────────────┐
│  Fastify API (sydney-backend/)      │
│  Auth · agents · messages · vault   │
└──────┬──────────────┬───────────────┘
       │              │
  PostgreSQL     Redis + BullMQ
                      │
              Agent worker
              (fetch → summarize → message → FCM push)
```

| Piece | Tech |
| --- | --- |
| Mobile app | Flutter (Android-first), Riverpod, Dio, Firebase Messaging |
| API | Node.js 22, Fastify, Better Auth |
| Jobs | BullMQ on Redis (scheduled + manual agent runs) |
| Data | PostgreSQL (`pg`, node-pg-migrate) |
| LLMs | Gemini + Anthropic (e.g. tech news web search) |
| Connectors | Google Workspace (Gmail, Drive, Calendar), GitHub |

## Repository layout

```
.
├── frontend/              Flutter client
├── sydney-backend/        API + worker
├── package.json           Root scripts (build, migrate, start)
├── start.sh               Starts the API (migrate + serve)
├── worker.sh              Starts the agent worker
└── docs (product/design)  sydney_*.md, design docs
```

## Prerequisites

- **Node.js** ≥ 22
- **Flutter** (stable SDK)
- **PostgreSQL** 16 and **Redis** 7  
  Or Docker (recommended for backend)

## Quick start - backend

### With Docker

```bash
cd sydney-backend
cp .env.example .env   # fill secrets (see README in sydney-backend/)
docker compose up --build
```

This starts Postgres, Redis, migrations, API on `http://localhost:3000`, and the agent worker.

### Without Docker

```bash
# Postgres + Redis running locally, then:
cd sydney-backend
cp .env.example .env
npm install
npm run migrate
npm run dev:api      # terminal 1
npm run dev:worker   # terminal 2 (if worker not embedded in API)
```

Useful root scripts from the repo root:

```bash
npm run build         # install + compile backend
npm run migrate       # run DB migrations
npm run start:api     # migrate + start API
npm run start:worker  # start dedicated worker process
```

API health: `GET http://localhost:3000/health`

More detail: [sydney-backend/README.md](./sydney-backend/README.md)

## Quick start - frontend

```bash
cd frontend
flutter pub get
```

**Mock mode** (no backend):

```bash
flutter run --dart-define=SYDNEY_USE_MOCKS=true
```

**Against local API:**

```bash
# iOS simulator / desktop
flutter run \
  --dart-define=SYDNEY_API_BASE_URL=http://localhost:3000 \
  --dart-define=SYDNEY_AUTH_ORIGIN=http://localhost:3000 \
  --dart-define=SYDNEY_USE_MOCKS=false

# Web (port 5173 is in default TRUSTED_ORIGINS)
flutter run -d chrome --web-port=5173 \
  --dart-define=SYDNEY_API_BASE_URL=http://localhost:3000 \
  --dart-define=SYDNEY_USE_MOCKS=false

# Android emulator (uses 10.0.2.2:3000 automatically for local API)
flutter run --dart-define=SYDNEY_USE_MOCKS=false
```

More detail: [frontend/README.md](./frontend/README.md)

## Core API surface

| Area | Endpoints (high level) |
| --- | --- |
| Health | `GET /health` |
| Auth | Better Auth at `/auth/*` (email + Google); `GET /auth/token` for mobile JWT |
| User | `GET /users/me` |
| Agents | `GET/POST /agents`, `GET/PATCH/DELETE /agents/:id`, `POST /agents/:id/run` |
| Messages | `GET/POST /agents/:id/messages` |
| Connectors | OAuth start/callback for Google Workspace + GitHub |

Protected routes accept Better Auth session cookies or `Authorization: Bearer <jwt>`.

## Security notes

- Connector tokens are encrypted (AES-256-GCM) in the vault; never sent to the client.
- Connector, document, and web content are treated as untrusted: redacted, screened, and isolated behind prompt trust boundaries before LLM calls.
- Prefer read-only connector scopes; expand write actions only with explicit authorization checks.

## Product & design docs

| Doc | Purpose |
| --- | --- |
| [sydney_product.md](./sydney_product.md) | What Cuppet is and who it’s for |
| [sydney_technical.md](./sydney_technical.md) | Stack, schema, auth, queues |
| [sydney_design.md](./sydney_design.md) | Design system |
| [sydney_components.md](./sydney_components.md) | UI components |
| [sydney_examples.md](./sydney_examples.md) | Example flows |
| [consumer_agent_delegation_design_doc_v5.md](./consumer_agent_delegation_design_doc_v5.md) | Delegation design |

## License

Private / unpublished unless otherwise specified.

# Sydney Backend

Backend foundation for Sydney.

## Local Setup With Docker

1. Copy `.env.example` to `.env`.
2. Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Start the full backend stack:

```bash
docker compose up --build
```

This starts:
- `postgres`
- `redis`
- one-shot `migrate`
- `api` on `http://localhost:3000`
- `worker`, which listens for BullMQ agent execution jobs

Useful Docker commands:

```bash
docker compose up --build
docker compose down
docker compose logs -f api
docker compose run --rm migrate
```

For local non-container tooling, `npm install` is still useful for typecheck/build:

```bash
npm install
npm run typecheck
npm run build
```

## Local Setup Without Docker

If Docker is not installed, Homebrew services work:

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
```

Create the local database and role:

```bash
/opt/homebrew/opt/postgresql@16/bin/psql -h localhost -d postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sydney') THEN CREATE ROLE sydney LOGIN PASSWORD 'sydney'; ELSE ALTER ROLE sydney LOGIN PASSWORD 'sydney'; END IF; END \$\$;"
/opt/homebrew/opt/postgresql@16/bin/createdb -h localhost -O sydney sydney_dev
```

Then run:

```bash
npm run migrate
npm run dev:api
```

## Initial Routes

- `GET /health`
- `GET|POST /auth/*` handled by Better Auth at base path `/auth`
- `POST /auth/sign-up/email`
- `POST /auth/sign-in/email`
- `GET /auth/token` returns a JWT for mobile clients after sign-in
- `GET /users/me` protected by Better Auth session lookup
- `GET /agents`
- `POST /agents`
- `GET /agents/:id`
- `POST /agents/:id/run` queues an immediate agent execution
- `PATCH /agents/:id`
- `DELETE /agents/:id`
- `GET /agents/:id/messages`
- `POST /agents/:id/messages`
- `PATCH /agents/:id/messages/:msgId`

Better Auth Fastify integration follows the official catch-all handler pattern.

Protected routes accept both Better Auth session cookies and `Authorization: Bearer <jwt>` tokens.

New users automatically get the pre-installed Assistant contact and welcome message.

Scheduled agents are registered in BullMQ when they are created or updated. The API also resyncs active schedules from Postgres on startup, so Redis resets do not permanently drop schedules.

Google Workspace OAuth supports Gmail, Drive, and Calendar as separate read-only connectors. Enable the Gmail API, Google Drive API, and Google Calendar API for the configured Google Cloud project. Calendar uses the `calendar.events.readonly` scope and reads upcoming events from the user's primary calendar without creating or changing events.

## Week 3 Tech News Agent

The Tech News agent uses Anthropic Messages API server-side web search, so it only needs `ANTHROPIC_API_KEY`; there is no separate Brave Search key.

Anthropic web search must be enabled for the organization in Claude Console. `ANTHROPIC_MODEL` is optional and defaults to `claude-haiku-4-5-20251001`.

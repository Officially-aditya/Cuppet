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

Google Workspace OAuth supports Gmail, Drive, and Calendar as separate read-only connectors. Enable the Gmail API, Google Drive API, and Google Calendar API for the configured Google Cloud project. Calendar uses the `calendar.events.readonly` and `calendar.calendarlist.readonly` scopes and reads upcoming events from the user's selected calendars without creating or changing events. Existing Calendar connections must reconnect once after either scope changes.

The production API embeds an agent worker by default so an API-only deployment cannot accept jobs that no process will consume. Set `RUN_AGENT_WORKER_IN_API=false` only when a dedicated `npm run start:worker` service is deployed and monitored. `GET /health` reports the embedded worker state in `agent_worker`.

GitHub OAuth uses `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and
`GITHUB_REDIRECT_URI`. Configure the production OAuth callback as:

```text
https://sydney-production.up.railway.app/connectors/github/callback
```

`GITHUB_OAUTH_SCOPES` defaults to `read:user`, which limits the connector to
profile information and public repository activity. Add `repo` only when
private repository access is required; GitHub OAuth defines `repo` as a broad
scope. GitHub access tokens are encrypted with the existing connector vault.

Slack uses a read-only OAuth bot installation. Configure `SLACK_CLIENT_ID`,
`SLACK_CLIENT_SECRET`, and `SLACK_REDIRECT_URI`, and add the exact production
callback URL to the Slack app's OAuth & Permissions page:

```text
https://sydney-production.up.railway.app/connectors/slack/callback
```

The default `SLACK_OAUTH_SCOPES` value reads public/private channel history and
member names; it does not grant message-writing access. After installation,
invite the Cuppet Slack app to each channel that an agent should summarize.
`SLACK_SIGNING_SECRET` is reserved for a future Events API receiver and is not
required for scheduled or manually triggered Slack agents.

## LLM and Input Security

Sydney treats connector records, fetched document/email contents, source
metadata, web results, and prior generated output as untrusted data. These
values are normalized, secret-redacted, prompt-injection screened, XML-escaped,
and placed behind explicit prompt trust boundaries before reaching Gemini.

User-created prompts and thread messages use strict schemas with length,
control-character, and instruction-override validation. LLM-produced JSON is
schema validated before it can affect an agent plan or instruction update.
Gemini requests use explicit safety thresholds, bounded context/output sizes,
and timeouts. Model output is secret-redacted before persistence or delivery.

These controls reduce prompt-injection risk but do not prove that arbitrary LLM
behavior is safe. Keep connector permissions read-only, require deterministic
authorization checks for every state-changing action, and maintain adversarial
tests as connector capabilities expand.

## Week 3 Tech News Agent

The Tech News agent uses Anthropic Messages API server-side web search, so it only needs `ANTHROPIC_API_KEY`; there is no separate Brave Search key.

Anthropic web search must be enabled for the organization in Claude Console. `ANTHROPIC_MODEL` is optional and defaults to `claude-haiku-4-5-20251001`.

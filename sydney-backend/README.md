# Cuppet Backend

Backend foundation for Cuppet.

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
- `POST /waitlist` accepts a public email signup for the website private beta
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

Preference Intelligence routes are opt-in and remain independent from Assistant
memory:

- `GET|PATCH /users/me/personalization`
- `POST|DELETE /users/me/personalization/consents` and `.../:purpose`
- `GET|PATCH|DELETE /users/me/preference-profile` and `.../:itemId`
- `GET /users/me/preference-profile/export`
- `POST|DELETE /messages/:messageId/feedback`
- `POST /assistant/suggestions/:suggestionId/decision`
- `GET /assistant/suggestions/:suggestionId/explanation`
- `POST /assistant/suggestions/:suggestionId/continue`

Personalization events are data-minimized, consent-bound, and processed through
the transactional outbox. No raw connector, browser, or conversation content is
written to the preference event store.

Better Auth Fastify integration follows the official catch-all handler pattern.

Protected routes accept both Better Auth session cookies and `Authorization: Bearer <jwt>` tokens.

New users automatically get the pre-installed Assistant contact and welcome message.

Scheduled agents are registered in BullMQ when they are created or updated. The API also resyncs active schedules from Postgres on startup, so Redis resets do not permanently drop schedules.

Google Workspace OAuth supports Gmail, Drive, and Calendar as separate read-only connectors. Enable the Gmail API, Google Drive API, and Google Calendar API for the configured Google Cloud project. Calendar uses the `calendar.events.readonly` and `calendar.calendarlist.readonly` scopes and reads upcoming events from the user's selected calendars without creating or changing events. Existing Calendar connections must reconnect once after either scope changes.

The API always embeds the agent and message-archive workers so an API-only deployment cannot accept jobs that no process will consume. `GET /health` reports the embedded agent worker state in `agent_worker`; the standalone worker command is intended only for additional queue capacity.

GitHub OAuth uses `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and
`GITHUB_REDIRECT_URI`. Configure the production OAuth callback as:

```text
https://sydney-production.up.railway.app/connectors/github/callback
```

`GITHUB_OAUTH_SCOPES` defaults to `read:user`, which limits the connector to
profile information and public repository activity. Add `repo` only when
private repository access is required; GitHub OAuth defines `repo` as a broad
scope. GitHub access tokens are encrypted with the existing connector vault.

Notion uses a read-only public OAuth connection. Configure
`NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, and the complete
`NOTION_AUTHORIZATION_URL` from the Notion developer dashboard. Register this
production redirect URI:

```text
https://sydney-production.up.railway.app/connectors/notion/callback
```

Enable the connection's read-content capability. During OAuth, each user
selects the pages that Cuppet may access; Notion agents cannot search or read
unselected pages. Access and refresh tokens are encrypted in the connector
vault. `NOTION_API_VERSION` defaults to `2026-03-11`.

Slack uses a read-only OAuth bot installation. Configure `SLACK_CLIENT_ID`,
`SLACK_CLIENT_SECRET`, and `SLACK_REDIRECT_URI`, and add the exact production
callback URL to the Slack app's OAuth & Permissions page:

```text
https://sydney-production.up.railway.app/connectors/slack/callback
```

The default `SLACK_OAUTH_SCOPES` value reads public/private channel history,
member names, and app mentions; it does not grant message-writing access. After installation,
invite the Cuppet Slack app to each channel that an agent should summarize.
Configure Slack Event Subscriptions to send `message.channels`,
`message.groups`, and `app_mention` to:

```text
https://sydney-production.up.railway.app/events/slack
```

The endpoint validates `SLACK_SIGNING_SECRET`, acknowledges events quickly,
deduplicates Slack retries, and queues matching urgent-watcher agents.

GitHub App webhooks can send `push`, `pull_request`, `issues`, `release`, and
`workflow_run` events to `/events/github`. Configure the same long random
`GITHUB_WEBHOOK_SECRET` in GitHub and Railway. Set the GitHub App's Setup URL to:

```text
https://sydney-production.up.railway.app/connectors/github/install/callback
```

Set `GITHUB_APP_SLUG` in Railway to the slug shown in the app's public URL
(`github.com/apps/<slug>`). Cuppet's Connect
button will then request repository access and continue into the existing
GitHub OAuth flow automatically. The stored installation ID routes personal
and organization repository events to the approving Cuppet user.

Gmail Pub/Sub push subscriptions
send to `/events/gmail?token=<GMAIL_PUBSUB_VERIFICATION_TOKEN>`. Gmail push is a
signal: the queued agent performs the targeted Gmail API read after delivery.

Set `GMAIL_PUBSUB_TOPIC` to the fully qualified Pub/Sub topic name. Grant
`gmail-api-push@system.gserviceaccount.com` permission to publish to that topic,
then configure a push subscription targeting the authenticated Gmail event
URL. Cuppet creates mailbox watches after Gmail OAuth and renews them daily.
Calendar and Drive OAuth connections similarly create HTTPS watch channels at
`/events/google/calendar` and `/events/google/drive`; their random channel
tokens are stored only as hashes and watches are replaced before expiration.

Deployments must run `npm run migrate` before starting the event-enabled API so
the installation, inbound-event, provider-subscription, and delivery ledgers
exist.

Event ingestion is push-first. Scheduler usage is limited to subscription
renewal, token refresh, recovery reconciliation, and explicitly scheduled
digests; it is not used to check providers every few seconds.

## LLM and Input Security

Cuppet treats connector records, fetched document/email contents, source
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

## Model providers and web search

The backend uses a provider-neutral model layer. Set `LLM_PROVIDER=gemini`
(the default) with `GEMINI_API_KEY` to use Gemini and Google Search grounding.
`GEMINI_MODEL` defaults to `gemini-3.1-flash-lite`.

Set `TAVILY_API_KEY` to route explicit user search commands such as
`search for ...` through Tavily first. Tavily results are supplied to the
selected model as bounded, untrusted evidence with source links. Set
`FIRECRAWL_API_KEY` to use Firecrawl Search as the next external provider when
Tavily is unavailable, returns no usable results, times out, or exhausts its
quota. If neither external provider returns evidence, the request falls back to
the selected model's native web-search tool. Ordinary chat and scheduled agent
runs do not call these external providers.

Anthropic support remains available: set `LLM_PROVIDER=anthropic`,
`ANTHROPIC_API_KEY`, and optionally `ANTHROPIC_MODEL`. Claude server-side web
search must be enabled for the Anthropic organization when agents need current
web results. The selected provider is used consistently by chat, intent
refinement, connector summarization, and agent renderers.

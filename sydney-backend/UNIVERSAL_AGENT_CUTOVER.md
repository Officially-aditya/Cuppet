# Universal agent runtime cutover

This cutover is intentionally destructive for agent data. It preserves users,
authentication, account preferences and time zones, connector tokens,
installations/statuses, and provider subscriptions.

1. Build and retain the previous deploy artifact.
2. Take and verify a PostgreSQL snapshot.
3. Stop API event ingestion and every agent worker.
4. Apply migrations, including `1870000000000_universal-agent-runtime`.
5. Run `npm run reset:agents -- --confirm-agent-reset`.
6. Deploy the backend and Flutter client from the same release.
7. Recreate synthetic agents through the normal API creation flow.
8. Run manual, schedule, event, connector-missing, action, chat, and retry
   smoke tests before starting workers and reopening event ingestion.

Rollback before launch is the previous deploy artifact plus restoration of the
database snapshot. Do not run the reset while a worker or event endpoint is
active.

# Cuppet App Completion Tasks

Last updated: 2026-08-16

This file is the execution checklist for the app completion plan. Read it before starting each task and update it immediately after the task is completed. Keep only one task marked `IN PROGRESS`. Do not put credentials, tokens, or private keys in this file.

## Execution rules

- Complete tasks in order unless a dependency requires a safe adjustment.
- A task that needs the user's account, secret, device, or deployment action is marked `WAITING FOR USER`; stop before starting the next task.
- A task is `DONE` only after its relevant tests or verification have passed.
- Do not commit or push unless explicitly requested.

## External gates

- **G1 - SMTP:** user supplies generic SMTP settings and confirms the reset email can be tested.
- **G2 - MCP:** user supplies access to a real OAuth-enabled, read-only MCP server for an end-to-end smoke test.
- **G3 - Firebase:** user revokes/rotates the Firebase service-account credential currently present in local/deployment configuration and confirms the replacement is installed.
- **G4 - Android identity:** user provides the final Android application ID and confirms it matches the Play Console/Firebase configuration before release signing is finalized.

## Tasks

- [x] **T0 - Create and maintain this checklist** - establish the source of truth for the implementation.
- [x] **T1 - Password recovery** - add Better Auth reset-email configuration, backend reset handling, a hosted reset page, Flutter request/reset UX, session revocation, and automated coverage.
  - [x] T1A - backend mailer/configuration and reset routes
  - [x] T1B - Flutter forgot-password and reset UX
  - [x] T1C - backend/frontend tests and local verification
  - [x] T1G - `WAITING FOR USER` at G1 for real SMTP delivery smoke test
- [ ] **T2 - User-owned custom MCP providers** - add secure HTTPS-only provider registration, OAuth-only onboarding, encrypted connection storage, read-only tool enforcement, and agent/assistant resolution.
  - [x] T2A - schema/repository/provider validation
  - [x] T2B - provider CRUD and OAuth routes
  - [x] T2C - assistant and agent execution integration
  - [x] T2D - tests and local security verification
  - [ ] T2G - `WAITING FOR USER` at G2; Linear pre-approval passed, but final user approval/token exchange remains deferred by the user
- [x] **T3 - Custom MCP Flutter UI** - replace the `Other...` placeholder with custom MCP provider creation, OAuth connection, status, and disconnect flows.
  - [x] T3A - model/service/provider state
  - [x] T3B - add-provider form and connector list integration
  - [x] T3C - widget tests and analyzer verification
- [x] **T4 - Unsupported message fallback** - replace the newer-version placeholder with a safe generic renderer that displays common fields and no unknown actions.
- [x] **T5 - Deployment credential hygiene** - rotate the Firebase service-account credential and verify no secret is tracked.
  - [x] T5G - G3 completed; the user rotated the credential, the local replacement passed Firebase Admin initialization and OAuth token exchange, and no credential is tracked.
- [x] **T6 - Android release signing** - generate an ignored upload keystore, wire ignored `key.properties`, and prepare release signing without changing the production application ID prematurely.
  - [x] T6A - signing configuration and ignore checks; the local upload keystore is ignored, Gradle release signing is wired, and a signed release APK was verified.
  - [x] T6G - G4 completed; Play Console verification is complete and the closed-test rollout remains an external 14-day requirement.
- [x] **T7 - Full verification and handoff** - backend tests, Flutter tests/analyzer, release APK/AAB builds, final diff, and handoff are complete; Play closed-testing duration remains external.

## Current task

**T7 - COMPLETE:** verification and release artifacts are ready. Remaining external actions are the Play closed test, production-access request after its required duration, and T2G’s deferred final user approval/token exchange.

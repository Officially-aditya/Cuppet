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
- [ ] **T5 - Deployment credential hygiene** - rotate the Firebase service-account credential and verify no secret is tracked.
  - [ ] T5G - `WAITING FOR USER` at G3
- [ ] **T6 - Android release signing** - generate an ignored upload keystore, wire ignored `key.properties`, and prepare release signing without changing the production application ID prematurely.
  - [ ] T6A - signing configuration and ignore checks
  - [ ] T6G - `WAITING FOR USER` at G4 before final package/Firebase alignment
- [ ] **T7 - Full verification and handoff** - run backend tests, Flutter tests/analyzer, build checks, inspect the final diff, and report remaining user actions.

## Current task

**T5 - WAITING FOR USER at G3:** rotate the Firebase service-account credential in local/deployment configuration before credential-hygiene verification. T2G’s final user approval/token exchange remains recorded as deferred.

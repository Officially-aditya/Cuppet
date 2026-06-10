# How To Run

From the project root:

```sh
flutter create --platforms=android,ios .
flutter pub get
flutter run -d android --dart-define=SYDNEY_USE_MOCKS=true
```

For backend integration later, pass real endpoint values:

```sh
flutter run -d android \
  --dart-define=SYDNEY_API_BASE_URL=https://api.example.com/v1 \
  --dart-define=SYDNEY_WEBSOCKET_URL=wss://api.example.com/realtime \
  --dart-define=SYDNEY_CONNECTOR_CALLBACK_SCHEME=sydney \
  --dart-define=SYDNEY_USE_MOCKS=false
```

Native setup still needs to be completed after platform folders are generated:

- Add Firebase Android/iOS configuration before enabling push notifications.
- Add the `flutter_web_auth_2` callback activity/scheme for connector OAuth.

# Session Summary

Date and time: 2026-05-31 03:33:56 +05:30

## What Was Built

Created a Flutter frontend scaffold for Sydney, a mobile-first AI delegation messaging app. The scaffold is frontend-only and keeps backend responsibilities behind service interfaces.

Implemented:

- Flutter package metadata in `pubspec.yaml`.
- App entrypoint and route shell in `lib/main.dart` and `lib/app.dart`.
- Environment config in `lib/config/env.dart`.
- Route constants in `lib/config/routes.dart`.
- Token-first design system in `lib/design/tokens.dart`.
- Shared animation helpers in `lib/design/animations.dart`.
- Null-safe models for users, agents, messages, and connectors.
- Dio API client with auth-token attachment and refresh retry structure.
- Service stubs for auth, agents, messages, connectors, push, and WebSocket updates.
- Riverpod provider wiring for auth/session, agents, messages, connectors, push, and live updates.
- Working screen scaffolds for sign in, sign up, inbox, thread, create agent, confirm create, connectors, and settings.
- Messaging-style inbox with pinned Assistant contact, unread badges, timestamps, previews, and a New action.
- Thread UI with agent/user/system message alignment, reply bar, typing indicator, and scrollable history.
- Prompt-first agent creation flow with template shortcuts and confirmation details.
- Structured message template routing inside `MessageBubble`.
- Reusable templates for plain text, progress tracker, urgency list, data summary, checklist, streak counter, and system messages.
- Mock data for inbox and thread preview states.
- `README.md` with project scope and setup notes.

## Constraints Preserved

- No backend business logic was implemented.
- No connector tokens are stored in the Flutter app.
- The app stores only the Sydney session token through `flutter_secure_storage`.
- Agents are modeled as contacts and their outputs are rendered as messages.
- Connector OAuth is initiated from the frontend, but completion and token ownership are backend-facing.
- WebSocket and push support are abstracted, ready for real backend/native setup.

## Validation Performed

- Confirmed every requested scaffold file exists.
- Scanned for `TODO`, `FIXME`, `print`, and `debugPrint`; none were found.
- Confirmed there are 41 Dart files under `lib`.

## Not Run

Flutter and Dart are not installed on this machine, so these commands could not be run here:

```sh
flutter pub get
dart format .
flutter analyze
flutter test
```

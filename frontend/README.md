# Sydney Flutter Frontend

Mobile-first Flutter frontend scaffold for Sydney, an AI delegation messaging app.

## Scope

- Frontend only.
- Backend APIs are assumed to exist over REST and WebSocket.
- The app stores only the Sydney session token in `flutter_secure_storage`.
- Connector OAuth is initiated in-app, but connector tokens must remain backend-owned.
- Agent outputs are rendered as structured messages.

## Local Setup

Install Flutter, then run:

```sh
flutter pub get
flutter run
```

Mock mode remains available when the backend is not running:

```sh
flutter run \
  --dart-define=SYDNEY_USE_MOCKS=true
```

For the local Sydney backend:

```sh
# iOS simulator
flutter run \
  --dart-define=SYDNEY_API_BASE_URL=http://localhost:3000 \
  --dart-define=SYDNEY_AUTH_ORIGIN=http://localhost:3000 \
  --dart-define=SYDNEY_USE_MOCKS=false

# Web; port 5173 is in the backend TRUSTED_ORIGINS default
flutter run -d chrome --web-port=5173 \
  --dart-define=SYDNEY_API_BASE_URL=http://localhost:3000 \
  --dart-define=SYDNEY_USE_MOCKS=false

# Android emulator
flutter run \
  --dart-define=SYDNEY_USE_MOCKS=false
```

The Android emulator automatically uses `http://10.0.2.2:3000` for the local
backend. Web, macOS, and iOS simulator builds use `http://localhost:3000`.

To launch the configured Android emulator and run the app in one step:

```sh
tool/run_android_emulator.sh
```

If platform folders are not present yet, generate them with the Flutter SDK before mobile builds. Android should be treated as the first target, with Firebase configuration and the `flutter_web_auth_2` callback activity added during native setup.

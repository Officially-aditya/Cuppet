# Cuppet Flutter Frontend

Mobile-first Flutter frontend scaffold for Cuppet, an AI delegation messaging app.

## Scope

- Frontend only.
- Backend APIs are assumed to exist over REST and WebSocket.
- The app stores only the Cuppet session token in `flutter_secure_storage`.
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

For the local Cuppet backend:

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
  --dart-define=SYDNEY_USE_MOCKS=false \
  --dart-define=SYDNEY_GOOGLE_SERVER_CLIENT_ID=196727476983-mcou7vm9g1kar5nr9217sq3ljrbtv53g.apps.googleusercontent.com
```

The Android emulator automatically uses `http://10.0.2.2:3000` for the local
backend. Web, macOS, and iOS simulator builds use `http://localhost:3000`.

Google sign-up uses Better Auth social OAuth through the backend, then returns
to the app with the `sydney://auth/google` URL scheme. Configure the backend
with a Google Web application OAuth client:

```sh
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_ANDROID_CLIENT_ID=...
AUTH_BASE_URL=https://your-dev-backend.example
TRUSTED_ORIGINS=https://your-dev-backend.example,http://localhost:3000
MOBILE_AUTH_CALLBACK_SCHEME=sydney
```

For Android emulator testing, `AUTH_BASE_URL` must be reachable by the browser
that Google opens. A temporary HTTPS tunnel is usually cleaner than `localhost`.
Pass that same origin to Flutter with
`--dart-define=SYDNEY_AUTH_ORIGIN=https://your-dev-backend.example`.

To launch the configured Android emulator and run the app in one step:

```sh
tool/run_android_emulator.sh
```

If platform folders are not present yet, generate them with the Flutter SDK before mobile builds. Android should be treated as the first target, with Firebase configuration and the `flutter_web_auth_2` callback activity added during native setup.

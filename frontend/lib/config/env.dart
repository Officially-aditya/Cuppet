import 'package:flutter/foundation.dart';

class Env {
  const Env._();

  static const _apiBaseUrlOverride = String.fromEnvironment(
    'SYDNEY_API_BASE_URL',
  );

  static String get apiBaseUrl {
    if (_apiBaseUrlOverride.isNotEmpty) {
      return _apiBaseUrlOverride;
    }

    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000';
    }

    return 'http://localhost:3000';
  }

  static const _authOriginOverride = String.fromEnvironment(
    'SYDNEY_AUTH_ORIGIN',
  );

  static String get authOrigin {
    if (_authOriginOverride.isNotEmpty) {
      return _authOriginOverride;
    }

    return 'http://localhost:3000';
  }

  static const websocketUrl = String.fromEnvironment(
    'SYDNEY_WEBSOCKET_URL',
    defaultValue: 'wss://api.sydney.local/realtime',
  );

  static const connectorCallbackScheme = String.fromEnvironment(
    'SYDNEY_CONNECTOR_CALLBACK_SCHEME',
    defaultValue: 'sydney',
  );

  static const authCallbackScheme = String.fromEnvironment(
    'SYDNEY_AUTH_CALLBACK_SCHEME',
    defaultValue: 'sydney',
  );

  static const googleServerClientId = String.fromEnvironment(
    'SYDNEY_GOOGLE_SERVER_CLIENT_ID',
    defaultValue:
        '196727476983-mcou7vm9g1kar5nr9217sq3ljrbtv53g.apps.googleusercontent.com',
  );

  static const useMockData = bool.fromEnvironment(
    'SYDNEY_USE_MOCKS',
    defaultValue: false,
  );
}

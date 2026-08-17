
class Env {
  const Env._();

  static const _apiBaseUrlOverride = String.fromEnvironment(
    'SYDNEY_API_BASE_URL',
  );

  static String get apiBaseUrl {
    if (_apiBaseUrlOverride.isNotEmpty) {
      return _apiBaseUrlOverride;
    }

    return 'https://sydney-production.up.railway.app';
  }

  static const _authOriginOverride = String.fromEnvironment(
    'SYDNEY_AUTH_ORIGIN',
  );

  static String get authOrigin {
    if (_authOriginOverride.isNotEmpty) {
      return _authOriginOverride;
    }

    return 'https://sydney-production.up.railway.app';
  }

  static const websocketUrl = String.fromEnvironment(
    'SYDNEY_WEBSOCKET_URL',
    defaultValue: 'wss://sydney-production.up.railway.app/realtime',
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
        '847353841069-uche6dm88c7c5dhoi00i2vvfv42195q3.apps.googleusercontent.com',
  );

  static const useMockData = bool.fromEnvironment(
    'SYDNEY_USE_MOCKS',
    defaultValue: false,
  );
}

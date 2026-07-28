import '../config/env.dart';
import '../models/access_connection.dart';
import 'api.dart';

class AccessOAuthSession {
  const AccessOAuthSession({
    required this.authUrl,
    required this.callbackScheme,
    required this.providerId,
  });

  final Uri authUrl;
  final String callbackScheme;
  final String providerId;
}

class AccessService {
  AccessService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<List<AccessConnection>> listConnections() async {
    if (Env.useMockData) return const <AccessConnection>[];
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/access/connections',
      );
      final values = response.data?['connections'];
      return values is List
          ? values
              .whereType<Map>()
              .map(
                (value) =>
                    AccessConnection.fromJson(Map<String, dynamic>.from(value)),
              )
              .toList()
          : const <AccessConnection>[];
    } catch (error) {
      throw apiExceptionFrom(error, 'We could not load access connections.');
    }
  }

  Future<AccessOAuthSession> beginOAuth(String providerId) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/access/providers/$providerId/oauth/start',
        data: {'callbackScheme': Env.connectorCallbackScheme},
      );
      final data = response.data;
      final authUrl =
          data?['authUrl']?.toString() ?? data?['auth_url']?.toString();
      if (authUrl == null || authUrl.isEmpty) {
        throw const ApiException(
          'The access provider did not return an OAuth URL.',
        );
      }
      return AccessOAuthSession(
        authUrl: Uri.parse(authUrl),
        callbackScheme:
            data?['callbackScheme']?.toString() ??
            data?['callback_scheme']?.toString() ??
            Env.connectorCallbackScheme,
        providerId:
            data?['providerId']?.toString() ??
            data?['provider_id']?.toString() ??
            providerId,
      );
    } catch (error) {
      throw apiExceptionFrom(error, 'We could not start access authorization.');
    }
  }

  Future<AccessConnection> completeOAuth(
    String providerId,
    Uri callbackUrl,
  ) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/access/providers/$providerId/oauth/complete',
        data: {'callbackUrl': callbackUrl.toString()},
      );
      final data = response.data;
      if (data == null) {
        throw const ApiException(
          'The access provider did not return a connection.',
        );
      }
      return AccessConnection.fromJson(data);
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not finish access authorization.',
      );
    }
  }

  Future<void> disconnect(String connectionId) async {
    try {
      await _api.delete<void>('/access/connections/$connectionId');
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not disconnect that access connection.',
      );
    }
  }
}

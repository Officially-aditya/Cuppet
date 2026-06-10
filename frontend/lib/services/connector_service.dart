import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import '../config/env.dart';
import '../models/connector.dart';
import 'api.dart';

class ConnectorOAuthSession {
  const ConnectorOAuthSession({
    required this.authUrl,
    required this.callbackScheme,
  });

  final Uri authUrl;
  final String callbackScheme;
}

class ConnectorService {
  ConnectorService({required ApiClient api}) : _api = api;

  final ApiClient _api;
  List<Connector>? _mockConnectors;

  Future<List<Connector>> listConnectors() async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 260));
      _mockConnectors ??= _mockConnectorList();
      return List<Connector>.unmodifiable(_mockConnectors!);
    }

    try {
      final response = await _api.get<List<dynamic>>('/connectors');
      return (response.data ?? const [])
          .whereType<Map>()
          .map(
            (connector) =>
                Connector.fromJson(Map<String, dynamic>.from(connector)),
          )
          .toList();
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not load connector status. Try again in a moment.',
      );
    }
  }

  Future<Connector> linkConnector(String connectorId) async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 500));
      _mockConnectors ??= _mockConnectorList();
      final index = _mockConnectors!.indexWhere(
        (item) => item.id == connectorId,
      );
      if (index == -1) {
        throw const ApiException('That connector is not available.');
      }
      final linked = _mockConnectors![index].copyWith(
        status: ConnectorStatus.connected,
      );
      _mockConnectors = [
        for (final connector in _mockConnectors!)
          connector.id == connectorId ? linked : connector,
      ];
      return linked;
    }

    final session = await beginOAuth(connectorId);
    final callbackUrl = await FlutterWebAuth2.authenticate(
      url: session.authUrl.toString(),
      callbackUrlScheme: session.callbackScheme,
    );
    return completeOAuth(connectorId, Uri.parse(callbackUrl));
  }

  Future<ConnectorOAuthSession> beginOAuth(String connectorId) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/connectors/$connectorId/oauth/start',
        data: {'callbackScheme': Env.connectorCallbackScheme},
      );
      final url = response.data?['authUrl']?.toString();
      final callbackScheme =
          response.data?['callbackScheme']?.toString() ??
          Env.connectorCallbackScheme;
      if (url == null || url.isEmpty) {
        throw const ApiException('The server did not return an OAuth URL.');
      }
      return ConnectorOAuthSession(
        authUrl: Uri.parse(url),
        callbackScheme: callbackScheme,
      );
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not start connector authorization.',
      );
    }
  }

  Future<Connector> completeOAuth(String connectorId, Uri callbackUrl) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/connectors/$connectorId/oauth/complete',
        data: {'callbackUrl': callbackUrl.toString()},
      );
      final data = response.data;
      if (data == null) {
        throw const ApiException('The connector did not return a status.');
      }
      return Connector.fromJson(data);
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not finish connector authorization.',
      );
    }
  }
}

List<Connector> _mockConnectorList() {
  return const [
    Connector(
      id: 'gmail',
      name: 'Gmail',
      description: 'Read and send emails',
      status: ConnectorStatus.connected,
      iconName: 'mail',
      requiredScopes: ['Read selected email metadata', 'Draft replies'],
    ),
    Connector(
      id: 'calendar',
      name: 'Google Calendar',
      description: 'Manage schedule',
      status: ConnectorStatus.disconnected,
      iconName: 'calendar',
      requiredScopes: ['Read events', 'Create reminders'],
    ),
    Connector(
      id: 'slack',
      name: 'Slack',
      description: 'Action required',
      status: ConnectorStatus.actionRequired,
      iconName: 'tag',
      requiredScopes: ['Read selected channels', 'Post drafts for approval'],
    ),
  ];
}

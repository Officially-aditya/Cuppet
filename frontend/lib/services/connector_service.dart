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

  Future<Connector> setConnectorConnected(
    String connectorId, {
    required bool connected,
  }) async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 240));
      _mockConnectors ??= _mockConnectorList();
      final index = _mockConnectors!.indexWhere(
        (item) => item.id == connectorId,
      );
      if (index == -1) {
        throw const ApiException('That connector is not available.');
      }
      final updated = _mockConnectors![index].copyWith(
        status:
            connected
                ? ConnectorStatus.connected
                : ConnectorStatus.disconnected,
      );
      _mockConnectors = [
        for (final connector in _mockConnectors!)
          connector.id == connectorId ? updated : connector,
      ];
      return updated;
    }

    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/connectors/$connectorId/status',
        data: {'connected': connected},
      );
      final data = response.data;
      if (data == null) {
        throw const ApiException('The connector did not return a status.');
      }
      return Connector.fromJson(data);
    } catch (error) {
      throw apiExceptionFrom(
        error,
        connected
            ? 'We could not connect that connector.'
            : 'We could not disconnect that connector.',
      );
    }
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

  Future<Connector> createCustomMcpProvider({
    required String name,
    required String endpoint,
    required List<String> capabilities,
    String description = '',
    String category = 'CUSTOM MCP',
    List<String> oauthScopes = const <String>[],
  }) async {
    if (Env.useMockData) {
      final connector = Connector(
        id: 'mcp.user.${DateTime.now().millisecondsSinceEpoch}',
        name: name,
        description:
            description.isEmpty
                ? 'Read approved data from this MCP provider.'
                : description,
        status: ConnectorStatus.disconnected,
        category: category,
        iconName: 'Extension',
        requiredScopes: oauthScopes,
        authConfigured: true,
        authMethod: 'oauth2',
      );
      _mockConnectors ??= _mockConnectorList();
      _mockConnectors = [..._mockConnectors!, connector];
      return connector;
    }

    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/access/providers',
        data: {
          'name': name,
          'description': description,
          'category': category,
          'icon_name': 'Extension',
          'endpoint': endpoint,
          'capabilities': capabilities,
          'oauth_scopes': oauthScopes,
        },
      );
      final data = response.data;
      final providerId = data?['provider_id']?.toString();
      if (providerId == null || providerId.isEmpty) {
        throw const ApiException('The provider did not return an identifier.');
      }

      try {
        final latest = await listConnectors();
        final listed = latest.where(
          (connector) =>
              connector.id == providerId || connector.providerId == providerId,
        );
        if (listed.isNotEmpty) return listed.first;
      } catch (_) {
        // The provider was created successfully. Return the server payload below.
      }

      return Connector.fromJson({
        ...?data,
        'id': providerId,
        'name': data?['name'] ?? name,
        'description': data?['description'] ?? description,
        'category': data?['category'] ?? category,
        'icon_name': data?['icon_name'] ?? 'Extension',
        'status': 'disconnected',
        'auth_method': 'oauth2',
        'auth_configured': true,
        'required_scopes': data?['required_scopes'] ?? oauthScopes,
      });
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not add that MCP provider. Check the HTTPS endpoint and try again.',
      );
    }
  }

  Future<void> deleteCustomMcpProvider(String providerId) async {
    try {
      await _api.delete<void>('/access/providers/$providerId');
    } catch (error) {
      throw apiExceptionFrom(error, 'We could not remove that MCP provider.');
    }
  }
}

List<Connector> _mockConnectorList() {
  return const [
    Connector(
      id: 'gmail',
      name: 'Gmail',
      description:
          'Let agents read approved mailbox context through the backend.',
      status: ConnectorStatus.connected,
      category: 'EMAIL & COMMUNICATION',
      iconName: 'Mail',
      requiredScopes: ['Read selected email metadata', 'Draft replies'],
    ),
    Connector(
      id: 'calendar',
      name: 'Google Calendar',
      description: 'Use availability and upcoming events when you approve it.',
      status: ConnectorStatus.disconnected,
      category: 'CALENDAR & SCHEDULING',
      iconName: 'Calendar',
      requiredScopes: ['Read upcoming events'],
      authConfigured: true,
    ),
    Connector(
      id: 'slack',
      name: 'Slack',
      description: 'Watch selected channels and prepare concise updates.',
      status: ConnectorStatus.connecting,
      category: 'EMAIL & COMMUNICATION',
      iconName: 'MessageSquare',
      requiredScopes: [
        'Read channels where Cuppet is a member',
        'Read member names',
      ],
      authConfigured: true,
    ),
    Connector(
      id: 'outlook',
      name: 'Outlook',
      description:
          'Access emails and communications from your Microsoft account.',
      status: ConnectorStatus.disconnected,
      category: 'EMAIL & COMMUNICATION',
      iconName: 'Layers',
    ),
    Connector(
      id: 'calendly',
      name: 'Calendly',
      description: 'Manage your scheduling and meeting links seamlessly.',
      status: ConnectorStatus.disconnected,
      category: 'CALENDAR & SCHEDULING',
      iconName: 'Clock',
    ),
    Connector(
      id: 'notion',
      name: 'Notion',
      description: 'Connect your workspace for documentation and notes.',
      status: ConnectorStatus.disconnected,
      category: 'PRODUCTIVITY & DOCS',
      iconName: 'BookOpen',
    ),
    Connector(
      id: 'gdocs',
      name: 'Google Docs',
      description: 'Allow agents to reference and summarize documents.',
      status: ConnectorStatus.disconnected,
      category: 'PRODUCTIVITY & DOCS',
      iconName: 'FileText',
    ),
    Connector(
      id: 'jira',
      name: 'Jira',
      description: 'Track project progress and issue statuses.',
      status: ConnectorStatus.disconnected,
      category: 'PROJECT MANAGEMENT',
      iconName: 'Trello',
    ),
    Connector(
      id: 'asana',
      name: 'Asana',
      description: 'Keep your tasks and projects in sync with Cuppet.',
      status: ConnectorStatus.disconnected,
      category: 'PROJECT MANAGEMENT',
      iconName: 'CheckSquare',
    ),
    Connector(
      id: 'github',
      name: 'GitHub',
      description: 'Monitor repositories, issues, and pull requests.',
      status: ConnectorStatus.disconnected,
      category: 'DEVELOPER TOOLS',
      iconName: 'Github',
      requiredScopes: [
        'Read GitHub profile',
        'Read public repository activity',
      ],
      authConfigured: true,
    ),
    Connector(
      id: 'gdrive',
      name: 'Google Drive',
      description: 'Access your cloud files and resources.',
      status: ConnectorStatus.disconnected,
      category: 'STORAGE & FILES',
      iconName: 'HardDrive',
    ),
    Connector(
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Keep your digital media synchronized.',
      status: ConnectorStatus.disconnected,
      category: 'STORAGE & FILES',
      iconName: 'FolderOpen',
    ),
  ];
}

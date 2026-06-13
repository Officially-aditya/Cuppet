enum ConnectorStatus {
  connected,
  disconnected,
  actionRequired,
  linking,
  oauth,
  connecting,
}

class Connector {
  const Connector({
    required this.id,
    required this.name,
    required this.description,
    required this.status,
    this.category = 'EMAIL & COMMUNICATION',
    this.iconName,
    this.requiredScopes = const [],
    this.authConfigured = false,
  });

  final String id;
  final String name;
  final String description;
  final ConnectorStatus status;
  final String category;
  final String? iconName;
  final List<String> requiredScopes;
  final bool authConfigured;

  bool get isConnected => status == ConnectorStatus.connected;
  bool get shouldUseOAuth => authConfigured && requiredScopes.isNotEmpty;

  Connector copyWith({
    String? id,
    String? name,
    String? description,
    ConnectorStatus? status,
    String? category,
    String? iconName,
    List<String>? requiredScopes,
    bool? authConfigured,
  }) {
    return Connector(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      status: status ?? this.status,
      category: category ?? this.category,
      iconName: iconName ?? this.iconName,
      requiredScopes: requiredScopes ?? this.requiredScopes,
      authConfigured: authConfigured ?? this.authConfigured,
    );
  }

  factory Connector.fromJson(Map<String, dynamic> json) {
    return Connector(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Connector',
      description: json['description']?.toString() ?? '',
      status: _statusFromString(json['status']?.toString()),
      category: json['category']?.toString() ?? 'EMAIL & COMMUNICATION',
      iconName: json['iconName']?.toString() ?? json['icon_name']?.toString(),
      requiredScopes: _stringList(
        json['requiredScopes'] ?? json['required_scopes'],
      ),
      authConfigured:
          json['authConfigured'] == true || json['auth_configured'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'status': status.name,
      'category': category,
      'iconName': iconName,
      'requiredScopes': requiredScopes,
      'authConfigured': authConfigured,
    };
  }
}

ConnectorStatus _statusFromString(String? value) {
  final normalized =
      value?.replaceAll('_', '').replaceAll('-', '').toLowerCase();
  if (normalized == 'oauth') {
    return ConnectorStatus.oauth;
  }
  if (normalized == 'connecting') {
    return ConnectorStatus.connecting;
  }
  return ConnectorStatus.values.firstWhere(
    (status) => status.name.toLowerCase() == normalized,
    orElse: () => ConnectorStatus.disconnected,
  );
}

List<String> _stringList(Object? value) {
  if (value is List) {
    return value.map((item) => item.toString()).toList();
  }
  return const [];
}

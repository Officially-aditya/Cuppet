enum ConnectorStatus { connected, disconnected, actionRequired, linking }

class Connector {
  const Connector({
    required this.id,
    required this.name,
    required this.description,
    required this.status,
    this.iconName,
    this.requiredScopes = const [],
  });

  final String id;
  final String name;
  final String description;
  final ConnectorStatus status;
  final String? iconName;
  final List<String> requiredScopes;

  bool get isConnected => status == ConnectorStatus.connected;

  Connector copyWith({
    String? id,
    String? name,
    String? description,
    ConnectorStatus? status,
    String? iconName,
    List<String>? requiredScopes,
  }) {
    return Connector(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      status: status ?? this.status,
      iconName: iconName ?? this.iconName,
      requiredScopes: requiredScopes ?? this.requiredScopes,
    );
  }

  factory Connector.fromJson(Map<String, dynamic> json) {
    return Connector(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Connector',
      description: json['description']?.toString() ?? '',
      status: _statusFromString(json['status']?.toString()),
      iconName: json['iconName']?.toString() ?? json['icon_name']?.toString(),
      requiredScopes: _stringList(
        json['requiredScopes'] ?? json['required_scopes'],
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'status': status.name,
      'iconName': iconName,
      'requiredScopes': requiredScopes,
    };
  }
}

ConnectorStatus _statusFromString(String? value) {
  final normalized =
      value?.replaceAll('_', '').replaceAll('-', '').toLowerCase();
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

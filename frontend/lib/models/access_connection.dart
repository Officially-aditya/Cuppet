enum AccessConnectionStatus { connected, disconnected, actionRequired }

class AccessConnection {
  const AccessConnection({
    required this.id,
    required this.providerId,
    required this.providerKind,
    required this.status,
    required this.capabilities,
    this.accountLabel,
    this.externalAccountId,
    this.metadata = const <String, dynamic>{},
  });

  final String id;
  final String providerId;
  final String providerKind;
  final AccessConnectionStatus status;
  final String? accountLabel;
  final String? externalAccountId;
  final List<String> capabilities;
  final Map<String, dynamic> metadata;

  factory AccessConnection.fromJson(Map<String, dynamic> json) {
    return AccessConnection(
      id: json['id']?.toString() ?? '',
      providerId:
          json['providerId']?.toString() ??
          json['provider_id']?.toString() ??
          '',
      providerKind:
          json['providerKind']?.toString() ??
          json['provider_kind']?.toString() ??
          'mcp',
      status: _statusFromString(json['status']?.toString()),
      accountLabel:
          json['accountLabel']?.toString() ?? json['account_label']?.toString(),
      externalAccountId:
          json['externalAccountId']?.toString() ??
          json['external_account_id']?.toString(),
      capabilities: _stringList(json['capabilities']),
      metadata:
          json['metadata'] is Map
              ? Map<String, dynamic>.from(json['metadata'] as Map)
              : const <String, dynamic>{},
    );
  }
}

AccessConnectionStatus _statusFromString(String? value) {
  switch (value?.replaceAll('_', '').toLowerCase()) {
    case 'connected':
      return AccessConnectionStatus.connected;
    case 'actionrequired':
      return AccessConnectionStatus.actionRequired;
    default:
      return AccessConnectionStatus.disconnected;
  }
}

List<String> _stringList(Object? value) {
  if (value is List) return value.map((item) => item.toString()).toList();
  return const <String>[];
}

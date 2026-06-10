class RealtimeEvent {
  const RealtimeEvent({
    required this.id,
    required this.type,
    required this.userId,
    required this.createdAt,
    this.agentId,
    this.messageId,
    this.runId,
    this.data = const {},
  });

  final String id;
  final String type;
  final String userId;
  final DateTime createdAt;
  final String? agentId;
  final String? messageId;
  final String? runId;
  final Map<String, dynamic> data;

  factory RealtimeEvent.fromJson(Map<String, dynamic> json) {
    return RealtimeEvent(
      id: json['id']?.toString() ?? '',
      type: json['type']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      createdAt:
          DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
      agentId: json['agent_id']?.toString(),
      messageId: json['message_id']?.toString(),
      runId: json['run_id']?.toString(),
      data: _map(json['data']),
    );
  }
}

Map<String, dynamic> _map(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return const {};
}

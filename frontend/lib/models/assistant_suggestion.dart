class AssistantSuggestion {
  const AssistantSuggestion({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.status,
    this.deliveredAt,
    this.decidedAt,
    this.explanation = const {},
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String status;
  final DateTime? deliveredAt;
  final DateTime? decidedAt;
  final Map<String, dynamic> explanation;

  factory AssistantSuggestion.fromJson(Map<String, dynamic> json) {
    return AssistantSuggestion(
      id: json['id']?.toString() ?? json['suggestion_id']?.toString() ?? '',
      type: json['suggestion_type']?.toString() ?? 'content',
      title: json['title']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      status: json['status']?.toString() ?? 'delivered',
      deliveredAt: _parseDate(json['delivered_at']),
      decidedAt: _parseDate(json['decided_at']),
      explanation:
          json['explanation'] is Map
              ? Map<String, dynamic>.from(json['explanation'] as Map)
              : const {},
    );
  }
}

DateTime? _parseDate(Object? value) {
  final text = value?.toString();
  return text == null ? null : DateTime.tryParse(text);
}

class AssistantMemory {
  const AssistantMemory({
    required this.id,
    required this.canonicalKey,
    required this.type,
    required this.text,
    required this.reinforcementCount,
  });

  final String id;
  final String canonicalKey;
  final String type;
  final String text;
  final int reinforcementCount;

  factory AssistantMemory.fromJson(Map<String, dynamic> json) {
    final value = json['value'];
    return AssistantMemory(
      id: json['id']?.toString() ?? '',
      canonicalKey: json['canonical_key']?.toString() ?? '',
      type: json['memory_type']?.toString() ?? 'profile_fact',
      text:
          value is Map
              ? value['text']?.toString() ?? ''
              : value?.toString() ?? '',
      reinforcementCount:
          int.tryParse(json['reinforcement_count']?.toString() ?? '') ?? 1,
    );
  }
}

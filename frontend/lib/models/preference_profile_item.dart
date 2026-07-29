class PreferenceProfileItem {
  const PreferenceProfileItem({
    required this.id,
    required this.dimension,
    required this.key,
    required this.weight,
    required this.confidence,
    required this.evidenceCount,
    required this.strongestEvidenceType,
    required this.derivedFrom,
    required this.firstObservedAt,
    required this.lastObservedAt,
    this.expiresAt,
    this.metadata = const {},
  });

  final String id;
  final String dimension;
  final String key;
  final double weight;
  final double confidence;
  final int evidenceCount;
  final String strongestEvidenceType;
  final List<String> derivedFrom;
  final DateTime firstObservedAt;
  final DateTime lastObservedAt;
  final DateTime? expiresAt;
  final Map<String, dynamic> metadata;

  bool get isNegative => weight < 0;

  factory PreferenceProfileItem.fromJson(Map<String, dynamic> json) {
    return PreferenceProfileItem(
      id: json['id']?.toString() ?? '',
      dimension: json['dimension']?.toString() ?? 'topic',
      key: json['key']?.toString() ?? '',
      weight: _number(json['weight']),
      confidence: _number(json['confidence']),
      evidenceCount:
          int.tryParse(json['evidence_count']?.toString() ?? '') ?? 0,
      strongestEvidenceType: json['strongest_evidence_type']?.toString() ?? '',
      derivedFrom:
          (json['derived_from'] is List)
              ? (json['derived_from'] as List)
                  .map((item) => item.toString())
                  .toList(growable: false)
              : const [],
      firstObservedAt: _profileDate(json['first_observed_at']),
      lastObservedAt: _profileDate(json['last_observed_at']),
      expiresAt: _profileNullableDate(json['expires_at']),
      metadata:
          json['metadata'] is Map
              ? Map<String, dynamic>.from(json['metadata'] as Map)
              : const {},
    );
  }
}

double _number(Object? value) => double.tryParse(value?.toString() ?? '') ?? 0;

DateTime _profileDate(Object? value) =>
    DateTime.tryParse(value?.toString() ?? '') ?? DateTime.now();

DateTime? _profileNullableDate(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

class PersonalizationConsent {
  const PersonalizationConsent({
    required this.id,
    required this.purpose,
    required this.status,
    required this.policyVersion,
    required this.createdAt,
    this.grantedAt,
    this.revokedAt,
    this.source = '',
  });

  final String id;
  final String purpose;
  final String status;
  final String policyVersion;
  final DateTime createdAt;
  final DateTime? grantedAt;
  final DateTime? revokedAt;
  final String source;

  bool get isGranted => status == 'granted';

  factory PersonalizationConsent.fromJson(Map<String, dynamic> json) {
    return PersonalizationConsent(
      id: json['id']?.toString() ?? '',
      purpose: json['purpose']?.toString() ?? '',
      status: json['status']?.toString() ?? 'revoked',
      policyVersion: json['policy_version']?.toString() ?? '',
      createdAt: _date(json['created_at']),
      grantedAt: _nullableDate(json['granted_at']),
      revokedAt: _nullableDate(json['revoked_at']),
      source: json['source']?.toString() ?? '',
    );
  }
}

DateTime _date(Object? value) =>
    DateTime.tryParse(value?.toString() ?? '') ?? DateTime.now();

DateTime? _nullableDate(Object? value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

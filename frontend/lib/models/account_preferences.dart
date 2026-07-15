class AccountPreferences {
  const AccountPreferences({
    required this.timeZone,
    required this.followDeviceTimeZone,
    this.timeZoneIsExplicit = true,
  });

  final String? timeZone;
  final bool followDeviceTimeZone;
  final bool timeZoneIsExplicit;

  factory AccountPreferences.fromJson(Map<String, dynamic> json) {
    final rawTimeZone =
        json['time_zone']?.toString() ?? json['timeZone']?.toString();
    final rawFollow =
        json['follow_device_time_zone'] ?? json['followDeviceTimeZone'];
    final rawExplicit =
        json['time_zone_is_explicit'] ?? json['timeZoneIsExplicit'];

    return AccountPreferences(
      timeZone:
          rawTimeZone == null || rawTimeZone.trim().isEmpty
              ? null
              : normalizeTimeZoneIdentifier(rawTimeZone),
      followDeviceTimeZone: rawFollow is bool ? rawFollow : true,
      timeZoneIsExplicit:
          rawExplicit is bool ? rawExplicit : rawTimeZone != null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'time_zone': timeZone,
      'follow_device_time_zone': followDeviceTimeZone,
    };
  }
}

String normalizeTimeZoneIdentifier(String value) {
  final normalized = value.trim();
  return const {'UTC', 'Etc/UTC', 'Etc/GMT', 'GMT'}.contains(normalized)
      ? 'UTC'
      : normalized;
}

import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/account_preferences.dart';

void main() {
  test('maps backend time-zone preferences', () {
    final preferences = AccountPreferences.fromJson(const {
      'time_zone': 'America/New_York',
      'follow_device_time_zone': false,
    });

    expect(preferences.timeZone, 'America/New_York');
    expect(preferences.followDeviceTimeZone, isFalse);
    expect(preferences.timeZoneIsExplicit, isTrue);
    expect(preferences.toJson(), {
      'time_zone': 'America/New_York',
      'follow_device_time_zone': false,
    });
  });

  test('recognizes a legacy fallback that still needs its first sync', () {
    final preferences = AccountPreferences.fromJson(const {
      'time_zone': 'Asia/Kolkata',
      'time_zone_is_explicit': false,
      'follow_device_time_zone': true,
    });

    expect(preferences.timeZone, 'Asia/Kolkata');
    expect(preferences.timeZoneIsExplicit, isFalse);
  });

  test('canonicalizes UTC aliases to avoid repeated device syncs', () {
    for (final alias in const ['UTC', 'Etc/UTC', 'Etc/GMT', 'GMT']) {
      expect(normalizeTimeZoneIdentifier(alias), 'UTC');
      expect(
        AccountPreferences.fromJson({
          'time_zone': alias,
          'follow_device_time_zone': true,
        }).timeZone,
        'UTC',
      );
    }
  });
}

import 'package:flutter_timezone/flutter_timezone.dart';

import '../models/account_preferences.dart';

class DeviceTimezoneService {
  const DeviceTimezoneService();

  Future<String> getLocalTimeZone() async {
    final timezone = await FlutterTimezone.getLocalTimezone();
    final identifier = timezone.identifier.trim();
    if (identifier.isEmpty) {
      throw const DeviceTimezoneException('The device returned no time zone.');
    }
    return normalizeTimeZoneIdentifier(identifier);
  }
}

class DeviceTimezoneException implements Exception {
  const DeviceTimezoneException(this.message);

  final String message;

  @override
  String toString() => message;
}

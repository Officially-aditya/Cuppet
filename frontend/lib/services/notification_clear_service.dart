import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';

class NotificationClearService {
  static const _channel = MethodChannel('sydney/notifications');

  static Future<void> clearAll() async {
    try {
      await _channel.invokeMethod('clearAll');
      debugPrint('NotificationClearService: Cleared all notifications');
    } catch (e) {
      debugPrint('NotificationClearService: Failed to clear notifications: $e');
    }
  }
}

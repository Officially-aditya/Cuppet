import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

class PushSetupResult {
  const PushSetupResult({required this.permissionStatus, this.token});

  final AuthorizationStatus permissionStatus;
  final String? token;

  bool get isEnabled =>
      permissionStatus == AuthorizationStatus.authorized ||
      permissionStatus == AuthorizationStatus.provisional;
}

class PushSetupException implements Exception {
  const PushSetupException(this.message);

  final String message;

  @override
  String toString() => message;
}

bool pushPermissionIsGranted(AuthorizationStatus status) {
  return status == AuthorizationStatus.authorized ||
      status == AuthorizationStatus.provisional;
}

class PushService {
  PushService({required this.onTokenRegistered});

  final Future<void> Function(String token) onTokenRegistered;

  Future<PushSetupResult> configure({bool requestPermission = true}) async {
    try {
      if (Firebase.apps.isEmpty) {
        throw const PushSetupException(
          'Firebase not initialized. Cannot enable push notifications.',
        );
      }

      final messaging = FirebaseMessaging.instance;
      var settings = await messaging.getNotificationSettings();
      if (requestPermission &&
          !pushPermissionIsGranted(settings.authorizationStatus)) {
        settings = await messaging.requestPermission();
      }

      if (!pushPermissionIsGranted(settings.authorizationStatus)) {
        return PushSetupResult(permissionStatus: settings.authorizationStatus);
      }

      final token = await messaging.getToken();

      if (token != null) {
        // Register token with backend
        await onTokenRegistered(token);

        // Listen for token refreshes
        FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
          onTokenRegistered(newToken).catchError((error) {
            debugPrint('Failed to refresh FCM token: $error');
          });
        });
      }

      return PushSetupResult(
        permissionStatus: settings.authorizationStatus,
        token: token,
      );
    } catch (e) {
      if (e is PushSetupException) {
        rethrow;
      }
      throw const PushSetupException(
        'Could not configure push notifications. Check that notifications are allowed in your device settings.',
      );
    }
  }

  Stream<RemoteMessage> get foregroundMessages => FirebaseMessaging.onMessage;
}

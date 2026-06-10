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

class PushService {
  Future<PushSetupResult> configure() async {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
      final settings = await FirebaseMessaging.instance.requestPermission();
      final token = await FirebaseMessaging.instance.getToken();
      return PushSetupResult(
        permissionStatus: settings.authorizationStatus,
        token: token,
      );
    } catch (_) {
      throw const PushSetupException(
        'Push notifications need Firebase platform configuration before they can be enabled.',
      );
    }
  }

  Stream<RemoteMessage> get foregroundMessages => FirebaseMessaging.onMessage;
}

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user.dart';
import '../services/api.dart';
import '../services/auth_service.dart';
import '../services/push_service.dart';

final secureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage(aOptions: AndroidOptions());
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(secureStorage: ref.watch(secureStorageProvider));
  ref.onDispose(() => unawaited(client.dispose()));
  return client;
});

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(api: ref.watch(apiClientProvider));
});

final pushServiceProvider = Provider<PushService>((ref) {
  final api = ref.watch(apiClientProvider);

  return PushService(
    onTokenRegistered: (token) async {
      try {
        await api.post(
          '/notifications/register',
          data: {
            'token': token,
            'device_info': {'platform': 'android', 'app_version': '0.1.0'},
          },
        );
        debugPrint('FCM token registered successfully');
      } catch (e) {
        debugPrint('Failed to register FCM token: $e');
        rethrow;
      }
    },
  );
});

final authControllerProvider = AsyncNotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

class AuthState {
  const AuthState({required this.user, required this.sessionToken});

  const AuthState.signedOut() : user = null, sessionToken = null;

  final User? user;
  final String? sessionToken;

  bool get isAuthenticated => user != null && sessionToken != null;
}

class AuthController extends AsyncNotifier<AuthState> {
  StreamSubscription<void>? _sessionExpiredSubscription;

  @override
  Future<AuthState> build() async {
    await _sessionExpiredSubscription?.cancel();
    _sessionExpiredSubscription = ref
        .watch(apiClientProvider)
        .sessionExpired
        .listen((_) {
          state = const AsyncValue<AuthState>.data(AuthState.signedOut());
        });
    ref.onDispose(
      () => unawaited(_sessionExpiredSubscription?.cancel() ?? Future.value()),
    );
    final session = await ref.watch(authServiceProvider).restoreSession();
    if (session == null) {
      return const AuthState.signedOut();
    }
    return AuthState(user: session.user, sessionToken: session.token);
  }

  Future<void> signIn({required String email, required String password}) async {
    state = const AsyncValue<AuthState>.loading();
    state = await AsyncValue.guard(() async {
      final session = await ref
          .read(authServiceProvider)
          .signIn(email: email, password: password);
      return AuthState(user: session.user, sessionToken: session.token);
    });
  }

  Future<void> signUp({
    required String displayName,
    required String email,
    required String password,
  }) async {
    state = const AsyncValue<AuthState>.loading();
    state = await AsyncValue.guard(() async {
      final session = await ref
          .read(authServiceProvider)
          .signUp(displayName: displayName, email: email, password: password);
      return AuthState(user: session.user, sessionToken: session.token);
    });
  }

  Future<void> continueWithGoogle() async {
    state = const AsyncValue<AuthState>.loading();
    state = await AsyncValue.guard(() async {
      final session = await ref.read(authServiceProvider).continueWithGoogle();
      return AuthState(user: session.user, sessionToken: session.token);
    });
  }

  Future<void> signOut() async {
    await ref.read(authServiceProvider).signOut();
    state = const AsyncValue<AuthState>.data(AuthState.signedOut());
  }

  Future<void> deleteAccount() async {
    state = const AsyncValue<AuthState>.loading();
    state = await AsyncValue.guard(() async {
      await ref.read(authServiceProvider).deleteAccount();
      return const AuthState.signedOut();
    });
  }
}

String readableAuthError(Object error) {
  return friendlyErrorMessage(
    error,
    fallback: 'We couldn’t update your session right now.',
  );
}

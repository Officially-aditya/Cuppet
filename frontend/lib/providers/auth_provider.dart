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
  return ApiClient(secureStorage: ref.watch(secureStorageProvider));
});

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService(api: ref.watch(apiClientProvider));
});

final pushServiceProvider = Provider<PushService>((ref) => PushService());

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
  @override
  Future<AuthState> build() async {
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

  Future<void> signOut() async {
    await ref.read(authServiceProvider).signOut();
    state = const AsyncValue<AuthState>.data(AuthState.signedOut());
  }
}

String readableAuthError(Object error) {
  if (error is ApiException) {
    return error.message;
  }
  return 'Something went wrong with your session. Please try again.';
}

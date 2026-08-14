import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../config/env.dart';
import '../models/user.dart';
import 'api.dart';

class AuthSession {
  const AuthSession({
    required this.user,
    required this.token,
    this.isNewUser = false,
  });

  final User user;
  final String token;
  final bool isNewUser;
}

class AuthService {
  AuthService({required ApiClient api}) : _api = api;

  static Future<void>? _googleInitialization;

  final ApiClient _api;

  Future<AuthSession?> restoreSession() async {
    final token = await _api.readSessionToken();
    if (token == null || token.isEmpty) {
      return null;
    }

    if (Env.useMockData) {
      return AuthSession(user: _mockUser(), token: token);
    }

    try {
      final response = await _api.get<Map<String, dynamic>>('/users/me');
      final data = response.data;
      final userData = data?['user'];
      if (userData is! Map) {
        return null;
      }
      return AuthSession(
        user: User.fromJson(Map<String, dynamic>.from(userData)),
        token: token,
      );
    } catch (_) {
      await _api.clearSessionToken();
      return null;
    }
  }

  Future<AuthSession> signIn({
    required String email,
    required String password,
  }) async {
    if (email.trim().isEmpty || password.isEmpty) {
      throw const ApiException('Enter your email and password to continue.');
    }

    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 450));
      final token = 'mock-session-${DateTime.now().millisecondsSinceEpoch}';
      await _api.writeSessionToken(token);
      return AuthSession(user: _mockUser(email: email), token: token);
    }

    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/auth/sign-in/email',
        data: {'email': email, 'password': password},
        options: authRouteOptions(),
      );
      return await _sessionFromResponse(response);
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not sign you in. Check your details and try again.',
      );
    }
  }

  Future<AuthSession> signUp({
    required String displayName,
    required String email,
    required String password,
  }) async {
    if (displayName.trim().isEmpty ||
        email.trim().isEmpty ||
        password.isEmpty) {
      throw const ApiException(
        'Add your name, email, and password to continue.',
      );
    }

    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 550));
      final token = 'mock-session-${DateTime.now().millisecondsSinceEpoch}';
      final user = User(
        id: 'user_mock',
        email: email,
        displayName: displayName.trim(),
      );
      await _api.writeSessionToken(token);
      return AuthSession(user: user, token: token, isNewUser: true);
    }

    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/auth/sign-up/email',
        data: {'name': displayName, 'email': email, 'password': password},
        options: authRouteOptions(),
      );
      return await _sessionFromResponse(response, isNewUser: true);
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not create your account. Please try again.',
      );
    }
  }

  Future<AuthSession> continueWithGoogle({
    bool isAccountCreation = false,
  }) async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 500));
      final token = 'mock-session-${DateTime.now().millisecondsSinceEpoch}';
      final user = _mockUser(email: 'alex@gmail.com');
      await _api.writeSessionToken(token);
      return AuthSession(
        user: user,
        token: token,
        isNewUser: isAccountCreation,
      );
    }

    try {
      await _ensureGoogleSignInInitialized();
      if (!GoogleSignIn.instance.supportsAuthenticate()) {
        throw const ApiException(
          'Google sign-in is not available on this device.',
        );
      }

      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw const ApiException('Google did not return an ID token.');
      }

      final response = await _api.post<Map<String, dynamic>>(
        '/auth/mobile/google',
        data: {'idToken': idToken},
        options: skipAuthOptions(),
      );

      final data = response.data;
      final token = data?['token']?.toString();
      final userData = data?['user'];
      if (token == null || token.isEmpty || userData is! Map) {
        throw const ApiException('The server returned an incomplete session.');
      }

      await _api.writeSessionToken(token);
      return AuthSession(
        user: User.fromJson(Map<String, dynamic>.from(userData)),
        token: token,
        isNewUser: data?['isNewUser'] == true,
      );
    } on GoogleSignInException catch (error) {
      throw ApiException(_googleSignInExceptionMessage(error));
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not continue with Google. Please try again.',
      );
    }
  }

  Future<void> signOut() async {
    if (!Env.useMockData) {
      try {
        await _api.post<void>('/auth/sign-out');
      } catch (_) {
        // Local sign-out still clears the session when the server is unreachable.
      }
    }
    await _api.clearSessionToken();
  }

  Future<void> deleteAccount() async {
    if (!Env.useMockData) {
      try {
        await _api.delete<void>('/users/me');
      } catch (error) {
        throw apiExceptionFrom(
          error,
          'We could not delete your account. Please try again.',
        );
      }
    }
    await _api.clearSessionToken();
  }

  Future<AuthSession> _sessionFromResponse(
    Response<Map<String, dynamic>> response, {
    bool isNewUser = false,
  }) async {
    final data = response.data;
    final cookie = _sessionCookieFromHeaders(response.headers);
    final token =
        data?['token']?.toString() ?? await _tokenFromSessionCookie(cookie);
    final userData = data?['user'];
    if (token == null || token.isEmpty || userData is! Map) {
      throw const ApiException('The server returned an incomplete session.');
    }
    final fallbackUser = User.fromJson(Map<String, dynamic>.from(userData));
    await _api.writeSessionToken(token);
    final currentUser = await _loadCurrentUser(fallback: fallbackUser);
    return AuthSession(user: currentUser, token: token, isNewUser: isNewUser);
  }

  Future<User> _loadCurrentUser({required User fallback}) async {
    try {
      final response = await _api.get<Map<String, dynamic>>('/users/me');
      final userData = response.data?['user'];
      if (userData is Map) {
        return User.fromJson(Map<String, dynamic>.from(userData));
      }
    } catch (_) {
      // The auth response remains a valid fallback if the profile refresh fails.
    }
    return fallback;
  }

  Future<void> _ensureGoogleSignInInitialized() async {
    const defaultClientId =
        '196727476983-mcou7vm9g1kar5nr9217sq3ljrbtv53g.apps.googleusercontent.com';
    final serverClientId =
        Env.googleServerClientId.isNotEmpty
            ? Env.googleServerClientId
            : defaultClientId;

    try {
      _googleInitialization ??= GoogleSignIn.instance.initialize(
        serverClientId: serverClientId,
      );
      await _googleInitialization;
    } catch (_) {
      _googleInitialization = null;
      rethrow;
    }
  }

  String? _sessionCookieFromHeaders(Headers headers) {
    final values = headers.map['set-cookie'];
    if (values == null || values.isEmpty) {
      return null;
    }
    return values.map((value) => value.split(';').first).join('; ');
  }

  Future<String?> _tokenFromSessionCookie(String? cookie) async {
    final response = await _api.get<Map<String, dynamic>>(
      '/auth/token',
      options: Options(
        extra: const {'skipAuth': true, 'withCredentials': true},
        headers: _authHeaders(cookie: cookie),
      ),
    );
    return response.data?['token']?.toString();
  }

  User _mockUser({String email = 'alex@sydney.app'}) {
    return User(
      id: 'user_mock',
      email: email,
      displayName: email.split('@').first,
    );
  }
}

String _googleSignInExceptionMessage(GoogleSignInException error) {
  return switch (error.code) {
    GoogleSignInExceptionCode.canceled => 'Google sign-in was cancelled.',
    GoogleSignInExceptionCode.interrupted =>
      'Google sign-in was interrupted. Please try again.',
    GoogleSignInExceptionCode.clientConfigurationError ||
    GoogleSignInExceptionCode.providerConfigurationError =>
      'Google sign-in is not configured correctly for this app.',
    GoogleSignInExceptionCode.uiUnavailable =>
      'Google sign-in is not available on this device.',
    _ => 'Google sign-in did not finish. Please try again.',
  };
}

Options skipAuthOptions() {
  return Options(extra: const {'skipAuth': true});
}

Options authRouteOptions() {
  return Options(
    extra: const {'skipAuth': true, 'withCredentials': true},
    headers: _authHeaders(),
  );
}

Map<String, String> _authHeaders({String? cookie}) {
  if (kIsWeb) {
    return const {};
  }

  return {
    'Origin': Env.authOrigin,
    if (cookie != null && cookie.isNotEmpty) 'Cookie': cookie,
  };
}

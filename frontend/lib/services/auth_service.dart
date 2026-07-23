import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../config/env.dart';
import '../models/user.dart';
import 'api.dart';

class AuthSession {
  const AuthSession({required this.user, required this.token});

  final User user;
  final String token;
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
      return AuthSession(user: user, token: token);
    }

    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/auth/sign-up/email',
        data: {'name': displayName, 'email': email, 'password': password},
        options: authRouteOptions(),
      );
      return await _sessionFromResponse(response);
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not create your account. Please try again.',
      );
    }
  }

  Future<AuthSession> continueWithGoogle() async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 500));
      final token = 'mock-session-${DateTime.now().millisecondsSinceEpoch}';
      final user = _mockUser(email: 'alex@gmail.com');
      await _api.writeSessionToken(token);
      return AuthSession(user: user, token: token);
    }

    try {
      await _ensureGoogleSignInInitialized();
      if (GoogleSignIn.instance.supportsAuthenticate()) {
        final account = await GoogleSignIn.instance.authenticate();
        final idToken = account.authentication.idToken;
        if (idToken != null && idToken.isNotEmpty) {
          final response = await _api.post<Map<String, dynamic>>(
            '/auth/mobile/google',
            data: {'idToken': idToken},
            options: skipAuthOptions(),
          );

          final data = response.data;
          final token = data?['token']?.toString();
          final userData = data?['user'];
          if (token != null && token.isNotEmpty && userData is Map) {
            await _api.writeSessionToken(token);
            return AuthSession(
              user: User.fromJson(Map<String, dynamic>.from(userData)),
              token: token,
            );
          }
        }
      }
    } catch (_) {
      // Native sign-in unconfigured or failed; fall through to web OAuth flow.
    }

    return _continueWithGoogleWeb();
  }

  Future<AuthSession> _continueWithGoogleWeb() async {
    try {
      final callbackUri = Uri(
        scheme: Env.authCallbackScheme,
        host: 'auth',
        path: '/google',
      );
      final authOrigin =
          Env.authOrigin.endsWith('/')
              ? Env.authOrigin.substring(0, Env.authOrigin.length - 1)
              : Env.authOrigin;
      final mobileCallbackUri = Uri.parse(
        '$authOrigin/auth/mobile/google/callback',
      ).replace(queryParameters: {'redirect_uri': callbackUri.toString()});

      final response = await _api.post<Map<String, dynamic>>(
        '/auth/sign-in/social',
        data: {
          'provider': 'google',
          'disableRedirect': true,
          'requestSignUp': true,
          'callbackURL': mobileCallbackUri.toString(),
          'newUserCallbackURL': mobileCallbackUri.toString(),
          'errorCallbackURL': callbackUri.toString(),
        },
        options: authRouteOptions(),
      );

      final authUrl = response.data?['url']?.toString();
      if (authUrl == null || authUrl.isEmpty) {
        throw const ApiException('Google sign-in is not configured yet.');
      }

      final result = await FlutterWebAuth2.authenticate(
        url: authUrl,
        callbackUrlScheme: Env.authCallbackScheme,
      );
      final params = _callbackParameters(Uri.parse(result));
      final error = params['error'];
      if (error != null && error.isNotEmpty) {
        throw ApiException('Google sign-in did not finish. $error');
      }

      final token = params['token'];
      if (token == null || token.isEmpty) {
        throw const ApiException('Google did not return a session token.');
      }

      await _api.writeSessionToken(token);
      final me = await _api.get<Map<String, dynamic>>('/users/me');
      final userData = me.data?['user'];
      if (userData is! Map) {
        throw const ApiException('The server returned an incomplete session.');
      }

      return AuthSession(
        user: User.fromJson(Map<String, dynamic>.from(userData)),
        token: token,
      );
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
    Response<Map<String, dynamic>> response,
  ) async {
    final data = response.data;
    final cookie = _sessionCookieFromHeaders(response.headers);
    final token =
        data?['token']?.toString() ?? await _tokenFromSessionCookie(cookie);
    final userData = data?['user'];
    if (token == null || token.isEmpty || userData is! Map) {
      throw const ApiException('The server returned an incomplete session.');
    }
    await _api.writeSessionToken(token);
    return AuthSession(
      user: User.fromJson(Map<String, dynamic>.from(userData)),
      token: token,
    );
  }

  Future<void> _ensureGoogleSignInInitialized() async {
    if (Env.googleServerClientId.isEmpty) {
      throw const ApiException('Google sign-in is missing its client ID.');
    }

    try {
      _googleInitialization ??= GoogleSignIn.instance.initialize(
        serverClientId: Env.googleServerClientId,
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

Map<String, String> _callbackParameters(Uri uri) {
  final params = <String, String>{...uri.queryParameters};
  if (uri.fragment.isNotEmpty) {
    params.addAll(Uri.splitQueryString(uri.fragment));
  }
  return params;
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

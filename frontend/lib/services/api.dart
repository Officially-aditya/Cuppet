import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/env.dart';

class ApiException implements Exception {
  const ApiException(
    this.message, {
    this.statusCode,
    this.code,
    this.retryable = false,
    this.retryAfterSeconds,
  });

  final String message;
  final int? statusCode;
  final String? code;
  final bool retryable;
  final int? retryAfterSeconds;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({required FlutterSecureStorage secureStorage, Dio? dio})
    : _secureStorage = secureStorage,
      dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: Env.apiBaseUrl,
              connectTimeout: const Duration(seconds: 12),
              receiveTimeout: const Duration(seconds: 20),
              sendTimeout: const Duration(seconds: 20),
              headers: const {'Accept': 'application/json'},
            ),
          ) {
    _configureInterceptors();
  }

  static const sessionTokenKey = 'sydney.session_token';

  final FlutterSecureStorage _secureStorage;
  final Dio dio;
  final StreamController<void> _sessionExpiredController =
      StreamController<void>.broadcast();
  bool _sessionExpiredSent = false;

  Stream<void> get sessionExpired => _sessionExpiredController.stream;

  Future<String?> readSessionToken() {
    return _secureStorage.read(key: sessionTokenKey);
  }

  Future<void> writeSessionToken(String token) async {
    _sessionExpiredSent = false;
    await _secureStorage.write(key: sessionTokenKey, value: token);
  }

  Future<void> clearSessionToken() {
    return _secureStorage.delete(key: sessionTokenKey);
  }

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return dio.get<T>(path, queryParameters: queryParameters, options: options);
  }

  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return dio.post<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> put<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return dio.put<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> delete<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return dio.delete<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  Future<Response<T>> patch<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) {
    return dio.patch<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
    );
  }

  void _configureInterceptors() {
    dio.interceptors.add(
      QueuedInterceptorsWrapper(
        onRequest: (options, handler) async {
          if (options.extra['skipAuth'] == true) {
            handler.next(options);
            return;
          }

          final token = await readSessionToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          final request = error.requestOptions;
          final shouldRefresh =
              error.response?.statusCode == 401 &&
              request.extra['skipAuth'] != true &&
              request.extra['retried'] != true;

          if (!shouldRefresh) {
            handler.next(error);
            return;
          }

          try {
            final refreshedToken = await _refreshSessionToken();
            if (refreshedToken == null || refreshedToken.isEmpty) {
              await _expireSession();
              handler.next(error);
              return;
            }

            final response = await _retry(request, refreshedToken);
            handler.resolve(response);
          } catch (_) {
            await _expireSession();
            handler.next(error);
          }
        },
      ),
    );
  }

  Future<String?> _refreshSessionToken() async {
    if (Env.useMockData) {
      return readSessionToken();
    }
    return null;
  }

  Future<Response<dynamic>> _retry(RequestOptions request, String token) {
    final headers = Map<String, dynamic>.from(request.headers)
      ..['Authorization'] = 'Bearer $token';
    final options = Options(
      method: request.method,
      headers: headers,
      responseType: request.responseType,
      contentType: request.contentType,
      extra: {...request.extra, 'retried': true},
      followRedirects: request.followRedirects,
      validateStatus: request.validateStatus,
      receiveDataWhenStatusError: request.receiveDataWhenStatusError,
    );

    return dio.request<dynamic>(
      request.path,
      data: request.data,
      queryParameters: request.queryParameters,
      options: options,
    );
  }

  Future<void> _expireSession() async {
    await clearSessionToken();
    if (_sessionExpiredSent || _sessionExpiredController.isClosed) return;
    _sessionExpiredSent = true;
    _sessionExpiredController.add(null);
  }

  Future<void> dispose() => _sessionExpiredController.close();
}

ApiException apiExceptionFrom(Object error, String fallback) {
  if (error is ApiException) {
    return ApiException(
      friendlyErrorMessage(error, fallback: fallback),
      statusCode: error.statusCode,
      code: error.code,
      retryable: error.retryable,
      retryAfterSeconds: error.retryAfterSeconds,
    );
  }
  if (error is DioException) {
    if (error.response == null) {
      final timedOut = {
        DioExceptionType.connectionTimeout,
        DioExceptionType.sendTimeout,
        DioExceptionType.receiveTimeout,
      }.contains(error.type);
      return ApiException(
        timedOut
            ? 'Cuppet is taking longer than expected. Please wait a moment and try again.'
            : 'Cuppet couldn’t connect right now. Check your connection and try again.',
        retryable: true,
      );
    }

    final statusCode = error.response?.statusCode;
    final data = _decodedResponse(error.response?.data);
    final root = data is Map ? data : const <String, dynamic>{};
    final nested = root['error'] is Map ? root['error'] as Map : null;
    final code = nested?['code']?.toString() ?? root['code']?.toString();
    final retryable =
        nested?['retryable'] is bool
            ? nested!['retryable'] as bool
            : _retryableStatus(statusCode);
    final retryAfterSeconds = _integer(
      nested?['retry_after_seconds'] ?? root['retry_after_seconds'],
    );
    final rawMessage =
        nested?['message']?.toString() ??
        root['message']?.toString() ??
        (root['error'] is String ? root['error']?.toString() : null);
    final message = _messageForResponse(
      rawMessage: rawMessage,
      fallback: fallback,
      statusCode: statusCode,
      code: code,
    );
    return ApiException(
      message,
      statusCode: statusCode,
      code: code,
      retryable: retryable,
      retryAfterSeconds: retryAfterSeconds,
    );
  }
  return ApiException(_withRecovery(fallback));
}

String friendlyErrorMessage(
  Object error, {
  String fallback =
      'Cuppet couldn’t complete that right now. Please wait a moment and try again.',
}) {
  if (error is DioException) {
    return apiExceptionFrom(error, fallback).message;
  }
  if (error is ApiException) {
    if (error.code == 'LLM_TOKEN_LIMIT_EXCEEDED') return error.message;
    final safe = _safeMessage(error.message);
    return _withRecovery(safe ?? fallback, statusCode: error.statusCode);
  }
  return _withRecovery(fallback);
}

Object? _decodedResponse(Object? data) {
  if (data is! String) return data;
  try {
    return jsonDecode(data);
  } catch (_) {
    return null;
  }
}

String _messageForResponse({
  required String? rawMessage,
  required String fallback,
  required int? statusCode,
  required String? code,
}) {
  final credentialError =
      code != null &&
      RegExp(
        r'(PASSWORD|CREDENTIAL|SIGN_IN)',
        caseSensitive: false,
      ).hasMatch(code);
  if (statusCode == 401 && !credentialError) {
    return 'Your session has ended. Please sign in again.';
  }
  if (code == 'LLM_TOKEN_LIMIT_EXCEEDED') {
    return rawMessage ??
        'Limit Exhausted. Your Limit will reset after five hours.';
  }
  if (statusCode == 429) {
    return 'Cuppet is handling a lot right now. Please wait a moment and try again.';
  }
  if (statusCode != null && statusCode >= 500) {
    return 'Cuppet couldn’t complete that right now. Please wait a moment and try again.';
  }
  if (code == 'CONNECTOR_OAUTH_REQUIRED') {
    return 'This connection needs to be linked again before Cuppet can continue.';
  }
  final safe = rawMessage == null ? null : _safeMessage(rawMessage);
  return _withRecovery(safe ?? fallback, statusCode: statusCode);
}

String? _safeMessage(String value) {
  final message = value.trim();
  if (message.isEmpty || message.length > 500) return null;
  if (RegExp(
    r'^[a-z0-9]+(?:_[a-z0-9]+)+$',
    caseSensitive: false,
  ).hasMatch(message)) {
    return null;
  }
  if (RegExp(
    r'^(Error|Exception|TypeError|StateError|DioException)\b',
    caseSensitive: false,
  ).hasMatch(message)) {
    return null;
  }
  if (RegExp(
    r'\b(ECONN[A-Z]*|ENOTFOUND|ETIMEDOUT|SQLSTATE|postgres|redis|API key|client secret|stack trace|jwt expired)\b',
    caseSensitive: false,
  ).hasMatch(message)) {
    return null;
  }
  if ((message.startsWith('{') && message.endsWith('}')) ||
      (message.startsWith('[') && message.endsWith(']'))) {
    return null;
  }
  return message;
}

String _withRecovery(String message, {int? statusCode}) {
  final value = message.trim();
  if (RegExp(
    r'\b(try again|wait|sign in|reconnect|refresh|choose|select|enter|add|open|connect again)\b',
    caseSensitive: false,
  ).hasMatch(value)) {
    return value;
  }
  final base = value.replaceFirst(RegExp(r'[.!?]+$'), '');
  if (statusCode == 401) return '$base. Please sign in again.';
  if (statusCode == 403) {
    return '$base. Check your access and try again.';
  }
  if (statusCode == 404 || statusCode == 409) {
    return '$base. Refresh and try again.';
  }
  if (statusCode == 408 || statusCode == 429 || (statusCode ?? 0) >= 500) {
    return '$base. Please wait a moment and try again.';
  }
  return '$base. Please try again.';
}

bool _retryableStatus(int? statusCode) {
  if (statusCode == null) return true;
  return {408, 409, 425, 429}.contains(statusCode) || statusCode >= 500;
}

int? _integer(Object? value) {
  if (value is int) return value;
  return int.tryParse(value?.toString() ?? '');
}

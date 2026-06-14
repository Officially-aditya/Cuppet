import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/env.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

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

  Future<String?> readSessionToken() {
    return _secureStorage.read(key: sessionTokenKey);
  }

  Future<void> writeSessionToken(String token) {
    return _secureStorage.write(key: sessionTokenKey, value: token);
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
              handler.next(error);
              return;
            }

            final response = await _retry(request, refreshedToken);
            handler.resolve(response);
          } catch (_) {
            await clearSessionToken();
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
}

ApiException apiExceptionFrom(Object error, String fallback) {
  if (error is ApiException) {
    return error;
  }
  if (error is DioException) {
    if (error.response == null) {
      return const ApiException(
        'Sydney could not reach the backend. Check your connection or install a build configured for the deployed API.',
        statusCode: null,
      );
    }

    final data = error.response?.data;
    final message =
        data is Map
            ? data['message']?.toString() ??
                _nestedErrorMessage(data['error']) ??
                data['error']?.toString()
            : null;
    return ApiException(
      message ?? fallback,
      statusCode: error.response?.statusCode,
    );
  }
  return ApiException(fallback);
}

String? _nestedErrorMessage(Object? value) {
  if (value is Map) {
    return value['message']?.toString();
  }
  return null;
}

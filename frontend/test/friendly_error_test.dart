import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/services/api.dart';

void main() {
  test('reads the standardized API error contract', () {
    final exception = apiExceptionFrom(
      _responseError(429, const {
        'error': {
          'code': 'RATE_LIMITED',
          'message':
              'Cuppet is handling a lot right now. Please wait a moment and try again.',
          'retryable': true,
          'retry_after_seconds': 15,
        },
      }),
      'Fallback message',
    );

    expect(exception.code, 'RATE_LIMITED');
    expect(exception.retryable, isTrue);
    expect(exception.retryAfterSeconds, 15);
    expect(exception.message, contains('wait a moment'));
  });

  test('preserves the token limit reset message', () {
    final exception = apiExceptionFrom(
      _responseError(429, const {
        'error': {
          'code': 'LLM_TOKEN_LIMIT_EXCEEDED',
          'message':
              'Limit Exhausted. Your Limit will reset at 2026-07-28T12:34:56.000Z.',
          'retryable': false,
          'retry_after_seconds': 18000,
        },
      }),
      'Fallback message',
    );

    expect(
      exception.message,
      'Limit Exhausted. Your Limit will reset at 2026-07-28T12:34:56.000Z.',
    );
    expect(exception.retryable, isFalse);
    expect(exception.retryAfterSeconds, 18000);
  });

  test('supports JSON-string and legacy bare error responses', () {
    final exception = apiExceptionFrom(
      _responseError(404, '{"error":"Message not found"}'),
      'This conversation could not load.',
    );

    expect(exception.statusCode, 404);
    expect(exception.message, 'Message not found. Refresh and try again.');
  });

  test('does not expose technical server details', () {
    final exception = apiExceptionFrom(
      _responseError(400, const {
        'error': {
          'code': 'CONNECTOR_OAUTH_FAILED',
          'message': 'github_token_exchange_failed_500',
        },
      }),
      'That connection could not be completed.',
    );

    expect(exception.message, isNot(contains('github_token')));
    expect(exception.message, isNot(contains('{')));
    expect(exception.message, contains('try again'));
  });

  test('hides unexpected 500 response content', () {
    final exception = apiExceptionFrom(
      _responseError(500, const {
        'message': 'connect ECONNREFUSED 127.0.0.1:5432',
      }),
      'The request failed.',
    );

    expect(exception.message, isNot(contains('ECONNREFUSED')));
    expect(exception.message, contains('wait a moment'));
    expect(exception.retryable, isTrue);
  });

  test('distinguishes timeouts from offline failures', () {
    final request = RequestOptions(path: '/messages');
    final timeout = apiExceptionFrom(
      DioException(
        requestOptions: request,
        type: DioExceptionType.receiveTimeout,
      ),
      'The request failed.',
    );
    final offline = apiExceptionFrom(
      DioException(
        requestOptions: request,
        type: DioExceptionType.connectionError,
      ),
      'The request failed.',
    );

    expect(timeout.message, contains('taking longer'));
    expect(offline.message, contains('Check your connection'));
    expect(timeout.retryable, isTrue);
    expect(offline.retryable, isTrue);
  });

  test('friendly formatter never renders arbitrary exception text', () {
    final message = friendlyErrorMessage(
      Exception('{error: postgres_password}'),
      fallback: 'That update could not be saved.',
    );

    expect(message, 'That update could not be saved. Please try again.');
    expect(message, isNot(contains('postgres')));
    expect(message, isNot(contains('{')));
  });

  test('friendly formatter also normalizes direct Dio failures', () {
    final message = friendlyErrorMessage(
      _responseError(400, const {'error': 'connector_token_decryption_failed'}),
      fallback: 'That connection couldn’t be updated.',
    );

    expect(message, 'That connection couldn’t be updated. Please try again.');
    expect(message, isNot(contains('connector_token')));
  });

  test('an unrecoverable protected 401 expires the local session', () async {
    FlutterSecureStorage.setMockInitialValues({
      ApiClient.sessionTokenKey: 'session-token',
    });
    final dio = Dio(BaseOptions(baseUrl: 'https://cuppet.test'));
    dio.httpClientAdapter = _StatusAdapter(
      401,
      '{"error":{"code":"INVALID_SESSION","message":"jwt expired"}}',
    );
    final client = ApiClient(
      secureStorage: const FlutterSecureStorage(),
      dio: dio,
    );
    final expired = client.sessionExpired.first;

    await expectLater(
      client.get<void>('/users/me'),
      throwsA(isA<DioException>()),
    );
    await expired.timeout(const Duration(seconds: 1));

    expect(await client.readSessionToken(), isNull);
    await client.dispose();
  });
}

DioException _responseError(int statusCode, Object data) {
  final request = RequestOptions(path: '/test');
  return DioException(
    requestOptions: request,
    response: Response<Object>(
      requestOptions: request,
      statusCode: statusCode,
      data: data,
    ),
    type: DioExceptionType.badResponse,
  );
}

class _StatusAdapter implements HttpClientAdapter {
  _StatusAdapter(this.statusCode, this.body);

  final int statusCode;
  final String body;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      body,
      statusCode,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

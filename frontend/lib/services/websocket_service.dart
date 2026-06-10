import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import '../config/env.dart';
import '../models/realtime_event.dart';

enum SydneySocketState { disconnected, connecting, connected }

class WebsocketService {
  WebsocketService({Dio? dio}) : _dio = dio ?? Dio(BaseOptions(baseUrl: Env.apiBaseUrl));

  final Dio _dio;
  final StreamController<RealtimeEvent> _events =
      StreamController.broadcast();
  final StreamController<SydneySocketState> _state =
      StreamController.broadcast();

  SydneySocketState _currentState = SydneySocketState.disconnected;
  CancelToken? _cancelToken;
  String? _sessionToken;
  bool _disposed = false;
  final List<String> _dataLines = [];

  Stream<RealtimeEvent> get events => _events.stream;
  Stream<SydneySocketState> get states => _state.stream;
  SydneySocketState get currentState => _currentState;

  Future<void> connect({required String sessionToken}) async {
    if (Env.useMockData || _disposed) {
      _setState(SydneySocketState.connected);
      return;
    }

    if (_sessionToken == sessionToken &&
        (_currentState == SydneySocketState.connected ||
            _currentState == SydneySocketState.connecting)) {
      return;
    }

    await disconnect();
    _sessionToken = sessionToken;
    _cancelToken = CancelToken();
    unawaited(_connectLoop(sessionToken, _cancelToken!));
  }

  Future<void> disconnect() async {
    _cancelToken?.cancel('disconnect');
    _cancelToken = null;
    _dataLines.clear();
    if (!_disposed) {
      _setState(SydneySocketState.disconnected);
    }
  }

  void injectMockEvent(RealtimeEvent event) {
    if (Env.useMockData && !_events.isClosed) {
      _events.add(event);
    }
  }

  void dispose() {
    _disposed = true;
    _cancelToken?.cancel('dispose');
    _events.close();
    _state.close();
  }

  Future<void> _connectLoop(String sessionToken, CancelToken cancelToken) async {
    while (!_disposed && !cancelToken.isCancelled) {
      _setState(SydneySocketState.connecting);

      try {
        final response = await _dio.get<ResponseBody>(
          '/events',
          options: Options(
            responseType: ResponseType.stream,
            headers: {'Authorization': 'Bearer $sessionToken'},
          ),
          cancelToken: cancelToken,
        );

        _setState(SydneySocketState.connected);
        final body = response.data;
        if (body == null) {
          throw const SydneyRealtimeException('No realtime stream returned.');
        }

        await for (final line in body.stream
            .cast<List<int>>()
            .transform(utf8.decoder)
            .transform(const LineSplitter())) {
          if (_disposed || cancelToken.isCancelled) {
            return;
          }
          _handleLine(line);
        }
      } on DioException catch (error) {
        if (CancelToken.isCancel(error) || _disposed) {
          return;
        }
        _setState(SydneySocketState.disconnected);
      } catch (_) {
        if (_disposed || cancelToken.isCancelled) {
          return;
        }
        _setState(SydneySocketState.disconnected);
      }

      if (!_disposed && !cancelToken.isCancelled) {
        await Future<void>.delayed(const Duration(seconds: 2));
      }
    }
  }

  void _handleLine(String line) {
    if (line.isEmpty) {
      _dispatchEvent();
      return;
    }

    if (line.startsWith(':')) {
      return;
    }

    final separator = line.indexOf(':');
    final field = separator == -1 ? line : line.substring(0, separator);
    final value =
        separator == -1
            ? ''
            : line.substring(separator + 1).replaceFirst(RegExp(r'^ '), '');

    if (field == 'data') {
      _dataLines.add(value);
    }
  }

  void _dispatchEvent() {
    if (_dataLines.isEmpty) {
      return;
    }

    final rawData = _dataLines.join('\n');
    _dataLines.clear();

    try {
      final decoded = jsonDecode(rawData);
      if (decoded is Map) {
        _events.add(RealtimeEvent.fromJson(Map<String, dynamic>.from(decoded)));
      }
    } catch (_) {
      // Ignore malformed stream events; the connection itself is still usable.
    }
  }

  void _setState(SydneySocketState next) {
    _currentState = next;
    if (!_state.isClosed) {
      _state.add(next);
    }
  }
}

class SydneyRealtimeException implements Exception {
  const SydneyRealtimeException(this.message);

  final String message;

  @override
  String toString() => message;
}

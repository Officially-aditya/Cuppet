import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import '../config/env.dart';
import '../models/message.dart';
import '../models/message_archive.dart';
import 'api.dart';

class MessageArchiveService {
  MessageArchiveService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<MessageArchiveState> loadState() async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/users/me/message-archive',
      );
      return MessageArchiveState.fromJson(response.data ?? const {});
    } catch (error) {
      throw apiExceptionFrom(error, 'We could not load Drive archive status.');
    }
  }

  Future<MessageArchiveState> setEnabled(bool enabled) async {
    try {
      final response = await _api.put<Map<String, dynamic>>(
        '/users/me/message-archive',
        data: {
          'enabled': enabled,
          'callback_scheme': Env.connectorCallbackScheme,
        },
      );
      final data = response.data ?? const <String, dynamic>{};
      final authorization = data['authorization'];
      if (enabled && authorization is Map) {
        final authUrl = authorization['auth_url']?.toString();
        final scheme =
            authorization['callback_scheme']?.toString() ??
            Env.connectorCallbackScheme;
        if (authUrl == null || authUrl.isEmpty) {
          throw const ApiException(
            'The server did not return a Drive consent URL.',
          );
        }
        await FlutterWebAuth2.authenticate(
          url: authUrl,
          callbackUrlScheme: scheme,
        );
        return loadState();
      }
      return MessageArchiveState.fromJson(data);
    } catch (error) {
      throw apiExceptionFrom(
        error,
        enabled
            ? 'We could not enable Drive conversation archiving.'
            : 'We could not disable Drive conversation archiving.',
      );
    }
  }

  Future<ArchivedMessagePage> loadArchivedMessages({
    required String agentId,
    String? cursor,
    int limit = 50,
  }) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/agents/$agentId/archived-messages',
        queryParameters: {
          'limit': limit.clamp(1, 50),
          if (cursor != null) 'cursor': cursor,
        },
      );
      final data = response.data ?? const <String, dynamic>{};
      final raw = data['messages'];
      return ArchivedMessagePage(
        messages: (raw is List ? raw : const [])
            .whereType<Map>()
            .map((item) => Message.fromJson(Map<String, dynamic>.from(item)))
            .toList(growable: false),
        nextCursor: data['next_cursor']?.toString(),
        filesRead: int.tryParse(data['files_read']?.toString() ?? '') ?? 0,
      );
    } catch (error) {
      throw apiExceptionFrom(error, 'Archived messages could not be loaded.');
    }
  }

  Future<void> deleteFiles() async {
    try {
      await _api.delete<Map<String, dynamic>>(
        '/users/me/message-archive/files',
        data: {'confirmation': 'DELETE_DRIVE_ARCHIVES'},
      );
    } catch (error) {
      throw apiExceptionFrom(error, 'Drive archives could not be deleted.');
    }
  }
}

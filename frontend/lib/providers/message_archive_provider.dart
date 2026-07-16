import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/message_archive.dart';
import '../services/message_archive_service.dart';
import 'auth_provider.dart';
import 'connectors_provider.dart';

final messageArchiveServiceProvider = Provider<MessageArchiveService>((ref) {
  return MessageArchiveService(api: ref.watch(apiClientProvider));
});

final messageArchiveProvider =
    AsyncNotifierProvider<MessageArchiveController, MessageArchiveState>(
      MessageArchiveController.new,
    );

class MessageArchiveController extends AsyncNotifier<MessageArchiveState> {
  @override
  Future<MessageArchiveState> build() {
    final auth = ref.watch(authControllerProvider).value;
    if (auth?.isAuthenticated != true) {
      return Future.value(
        const MessageArchiveState(
          enabled: false,
          status: 'disabled',
          actionRequired: false,
        ),
      );
    }
    return ref.watch(messageArchiveServiceProvider).loadState();
  }

  Future<void> setEnabled(bool enabled) async {
    final previous = state;
    state = const AsyncLoading();
    try {
      final updated = await ref
          .read(messageArchiveServiceProvider)
          .setEnabled(enabled);
      state = AsyncData(updated);
      ref.invalidate(connectorsProvider);
    } catch (error, stackTrace) {
      state = previous;
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<void> deleteFiles() async {
    await ref.read(messageArchiveServiceProvider).deleteFiles();
    state = AsyncData(
      await ref.read(messageArchiveServiceProvider).loadState(),
    );
  }
}

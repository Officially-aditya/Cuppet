import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/message.dart';
import '../models/realtime_event.dart';
import '../services/message_service.dart';
import '../services/websocket_service.dart';
import 'agents_provider.dart';
import 'auth_provider.dart';
import 'connectors_provider.dart';

final messageServiceProvider = Provider<MessageService>((ref) {
  return MessageService(api: ref.watch(apiClientProvider));
});

final websocketServiceProvider = Provider.autoDispose<WebsocketService>((ref) {
  final service = WebsocketService();
  ref.onDispose(service.dispose);
  return service;
});

final messagesProvider = FutureProvider.family<List<Message>, String>((
  ref,
  threadId,
) async {
  final auth = ref.watch(authControllerProvider).value;
  if (auth?.isAuthenticated != true) {
    return const <Message>[];
  }
  final messages = await ref
      .watch(messageServiceProvider)
      .fetchThread(threadId);
  Future.microtask(() {
    ref.invalidate(agentsProvider);
  });
  return messages;
});

final briefingsProvider = FutureProvider<List<Message>>((ref) {
  final auth = ref.watch(authControllerProvider).value;
  if (auth?.isAuthenticated != true) {
    return Future.value(const <Message>[]);
  }
  return ref.watch(messageServiceProvider).fetchBriefings();
});

final liveEventsProvider = StreamProvider<RealtimeEvent>((ref) {
  return ref.watch(websocketServiceProvider).events;
});

final messageActionsProvider = Provider<MessageActions>((ref) {
  return MessageActions(ref);
});

class MessageActions {
  const MessageActions(this._ref);

  final Ref _ref;

  Future<Message> sendReply({
    required String threadId,
    required String text,
    List<String> attachmentIds = const [],
  }) async {
    final result = await _ref
        .read(messageServiceProvider)
        .sendReply(
          threadId: threadId,
          text: text,
          attachmentIds: attachmentIds,
        );
    final updatedAgent = result.updatedAgent;
    if (result.deletedAgentId case final deletedAgentId?) {
      _ref.read(agentsProvider.notifier).removeAgent(deletedAgentId);
    } else if (updatedAgent != null) {
      _ref.read(agentsProvider.notifier).upsertAgent(updatedAgent);
    }
    _ref.invalidate(messagesProvider(threadId));
    return result.message;
  }

  Future<Message> sendAssistantAction({
    required String threadId,
    required String decision,
    required String pendingActionId,
  }) async {
    final result = await _ref
        .read(messageServiceProvider)
        .sendAssistantAction(
          threadId: threadId,
          decision: decision,
          pendingActionId: pendingActionId,
        );
    final updatedAgent = result.updatedAgent;
    if (result.deletedAgentId case final deletedAgentId?) {
      _ref.read(agentsProvider.notifier).removeAgent(deletedAgentId);
    } else if (updatedAgent != null) {
      _ref.read(agentsProvider.notifier).upsertAgent(updatedAgent);
    }
    _ref.invalidate(messagesProvider(threadId));
    return result.message;
  }

  Future<void> connectLiveUpdates() async {
    final auth = await _ref.read(authControllerProvider.future);
    final token = auth.sessionToken;
    if (token == null) {
      return;
    }
    await _ref.read(websocketServiceProvider).connect(sessionToken: token);
  }

  Future<void> disconnectLiveUpdates() {
    return _ref.read(websocketServiceProvider).disconnect();
  }
}

void handleRealtimeEvent(WidgetRef ref, RealtimeEvent event) {
  final agentId = event.agentId;
  final agentDeleted =
      event.type == 'agent.deleted' || event.data['deleted'] == true;
  if (agentDeleted && agentId != null && agentId.isNotEmpty) {
    ref.read(agentsProvider.notifier).removeAgent(agentId);
    return;
  }
  if (agentId != null && agentId.isNotEmpty) {
    ref.invalidate(messagesProvider(agentId));
  }
  if (event.type.startsWith('connector.') ||
      event.data['action_required'] == true ||
      event.data['connector_id'] != null) {
    ref.invalidate(connectorsProvider);
  }
  ref.invalidate(agentsProvider);
}

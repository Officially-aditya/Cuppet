import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../../providers/agents_provider.dart';
import '../../providers/connectors_provider.dart';
import '../../providers/messages_provider.dart';
import '../../config/routes.dart';
import '../../widgets/thread/message_card.dart';
import '../../widgets/thread/reply_bar.dart';
import '../../widgets/thread/typing_indicator.dart';
import '../../widgets/sydney_primitives.dart';

class ThreadScreen extends ConsumerStatefulWidget {
  const ThreadScreen({required this.agent, super.key});

  final Agent agent;

  @override
  ConsumerState<ThreadScreen> createState() => _ThreadScreenState();
}

class _ThreadScreenState extends ConsumerState<ThreadScreen> {
  final _scrollController = ScrollController();
  int _lastRenderedMessageCount = -1;

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(messagesProvider(widget.agent.threadId));

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        backgroundColor: SydneyColors.surfaceContainerLowest,
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
        ),
        title: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: Color(widget.agent.accentColor),
                borderRadius: BorderRadius.circular(SydneyRadius.sm),
              ),
              alignment: Alignment.center,
              child: Text(
                widget.agent.avatarInitials,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: SydneySpacing.md),
            Flexible(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.agent.name,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(
                      context,
                    ).textTheme.titleSmall?.copyWith(fontSize: 14),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const SizedBox(
                        width: 6,
                        height: 6,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: SydneyColors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        widget.agent.availability == AgentAvailability.paused
                            ? 'PAUSED'
                            : 'ACTIVE',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: SydneyColors.primary,
                          fontSize: 10,
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Connectors',
            onPressed:
                () => Navigator.of(context).pushNamed(AppRoutes.connectors),
            icon: const Icon(
              Icons.public_rounded,
              color: SydneyColors.primary,
              size: 18,
            ),
          ),
          IconButton(
            tooltip: 'Agent preferences',
            onPressed:
                () =>
                    Navigator.of(context).pushNamed(AppRoutes.agentPreferences),
            icon: const Icon(Icons.settings_outlined, size: 18),
          ),
          const SizedBox(width: SydneySpacing.sm),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: messages.when(
                data: (items) {
                  if (_lastRenderedMessageCount != items.length) {
                    _lastRenderedMessageCount = items.length;
                    _scrollToBottomSoon();
                  }

                  return ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(
                      SydneySpacing.page,
                      SydneySpacing.lg,
                      SydneySpacing.page,
                      SydneySpacing.lg,
                    ),
                    itemCount: items.length + 2,
                    itemBuilder: (context, index) {
                      if (index == 0) {
                        return const _ThreadDayPill();
                      }
                      final messageIndex = index - 1;
                      if (messageIndex == items.length) {
                        return widget.agent.availability ==
                                AgentAvailability.thinking
                            ? const TypingIndicator()
                            : const SizedBox.shrink();
                      }
                      return MessageCard(
                        message: items[messageIndex],
                        onAction: _handleMessageAction,
                      );
                    },
                  );
                },
                loading: () => const _ThreadLoading(),
                error:
                    (error, _) => SydneyErrorState(
                      title: 'Conversation could not load',
                      message: error.toString(),
                      onRetry:
                          () => ref.invalidate(
                            messagesProvider(widget.agent.threadId),
                          ),
                    ),
              ),
            ),
            ReplyBar(onSend: _sendReply),
          ],
        ),
      ),
    );
  }

  Future<void> _sendReply(String text) async {
    try {
      await ref
          .read(messageActionsProvider)
          .sendReply(threadId: widget.agent.threadId, text: text);
      await Future<void>.delayed(const Duration(milliseconds: 80));
      if (_scrollController.hasClients) {
        await _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
        );
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  void _scrollToBottomSoon() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) {
        return;
      }
      _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
    });
  }

  void _handleMessageAction(Map<String, dynamic> action) {
    unawaited(_handleMessageActionAsync(action));
  }

  Future<void> _handleMessageActionAsync(Map<String, dynamic> action) async {
    final actionType = action['type']?.toString();
    final actionId = action['id']?.toString() ?? '';
    final connectorId = _connectorIdFromAction(action);

    if (connectorId == null) {
      if (actionType == 'open_connectors' || actionId == 'connect') {
        await Navigator.of(context).pushNamed(AppRoutes.connectors);
      }
      return;
    }

    try {
      final connectorName = _connectorName(action, connectorId);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Opening $connectorName...')));
      await ref.read(connectorServiceProvider).linkConnector(connectorId);
      if (!mounted) {
        return;
      }
      ref.invalidate(connectorsProvider);

      final runAfterConnect = action['run_after_connect'] != false;
      if (runAfterConnect) {
        await ref.read(agentServiceProvider).runAgent(widget.agent.id);
        ref.invalidate(messagesProvider(widget.agent.threadId));
        ref.invalidate(agentsProvider);
        _scheduleThreadRefresh(const Duration(seconds: 2));
        _scheduleThreadRefresh(const Duration(seconds: 6));
      }

      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            runAfterConnect
                ? '$connectorName connected. Run queued.'
                : '$connectorName connected.',
          ),
        ),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  void _scheduleThreadRefresh(Duration delay) {
    Future<void>.delayed(delay, () {
      if (mounted) {
        ref.invalidate(messagesProvider(widget.agent.threadId));
      }
    });
  }
}

String? _connectorIdFromAction(Map<String, dynamic> action) {
  final direct = action['connector_id'] ?? action['connectorId'];
  if (direct != null && direct.toString().trim().isNotEmpty) {
    return direct.toString().trim();
  }

  final id = action['id']?.toString() ?? '';
  final match = RegExp(r'^(?:reconnect|connect)_([a-z0-9_-]+)$').firstMatch(id);
  return match?.group(1);
}

String _connectorName(Map<String, dynamic> action, String connectorId) {
  final providedName = action['connector_name'] ?? action['connectorName'];
  if (providedName != null && providedName.toString().trim().isNotEmpty) {
    return providedName.toString().trim();
  }

  return switch (connectorId) {
    'gmail' => 'Gmail',
    'drive' => 'Google Drive',
    'web_search' => 'Web Search',
    'slack' => 'Slack',
    _ => 'Connector',
  };
}

class _ThreadDayPill extends StatelessWidget {
  const _ThreadDayPill();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: SydneySpacing.lg),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: 10,
            vertical: SydneySpacing.xs,
          ),
          decoration: BoxDecoration(
            color: SydneyColors.surfaceContainer,
            borderRadius: BorderRadius.circular(SydneyRadius.full),
          ),
          child: Text(
            'TODAY',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.mutedInk,
              letterSpacing: 1.1,
            ),
          ),
        ),
      ),
    );
  }
}

class _ThreadLoading extends StatelessWidget {
  const _ThreadLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(SydneySpacing.page),
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: Container(
            width: 220,
            height: 72,
            decoration: BoxDecoration(
              color: SydneyColors.surfaceRaised,
              borderRadius: SydneyRadius.bubbleAgent,
              border: Border.all(color: SydneyColors.line),
            ),
          ),
        ),
        const SizedBox(height: SydneySpacing.lg),
        Align(
          alignment: Alignment.centerRight,
          child: Container(
            width: 180,
            height: 54,
            decoration: const BoxDecoration(
              color: SydneyColors.userBubble,
              borderRadius: SydneyRadius.bubbleUser,
            ),
          ),
        ),
      ],
    );
  }
}

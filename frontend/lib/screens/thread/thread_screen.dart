import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../../models/message.dart';
import '../../providers/agents_provider.dart';
import '../../providers/connectors_provider.dart';
import '../../providers/messages_provider.dart';
import '../../config/routes.dart';
import '../../widgets/thread/message_card.dart';
import '../../widgets/thread/sydney_heatmap.dart';
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
  AgentAvailability? _lastAvailability;
  String? _lastReadSyncedMessageId;

  Agent get _activeAgent {
    return ref.read(agentsProvider).maybeWhen(
      data: (list) => list.firstWhere(
        (a) => a.id == widget.agent.id,
        orElse: () => widget.agent,
      ),
      orElse: () => widget.agent,
    );
  }

  bool _shouldShowHeatmap(Agent agent) {
    final intent = agent.parsedIntent?['intent']?.toString();
    final template = agent.parsedIntent?['output_template']?.toString();
    final hasHistory = agent.parsedIntent?['history'] != null;

    final isKnownIntent = const {
      'study_plan',
      'interview_prep',
      'language_word',
      'coding_tip',
      'book_companion',
      'dsa_question',
      'habit_tracker',
    }.contains(intent);

    final isTrackableTemplate = const {
      'study_guide',
      'dsa_question',
      'streak_counter',
      'daily_task',
    }.contains(template);

    final nameLower = agent.name.toLowerCase();
    final descriptionLower = agent.description.toLowerCase();
    final containsTrackableKeywords = nameLower.contains('study') ||
        nameLower.contains('practice') ||
        nameLower.contains('streak') ||
        nameLower.contains('habit') ||
        nameLower.contains('dsa') ||
        nameLower.contains('leetcode') ||
        nameLower.contains('learn') ||
        descriptionLower.contains('study') ||
        descriptionLower.contains('practice') ||
        descriptionLower.contains('streak') ||
        descriptionLower.contains('habit') ||
        descriptionLower.contains('dsa') ||
        descriptionLower.contains('leetcode') ||
        descriptionLower.contains('learn');

    return isKnownIntent || isTrackableTemplate || hasHistory || containsTrackableKeywords;
  }

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
    final agentsAsync = ref.watch(agentsProvider);
    final agent = agentsAsync.maybeWhen(
      data:
          (list) => list.firstWhere(
            (a) => a.id == widget.agent.id,
            orElse: () => widget.agent,
          ),
      orElse: () => widget.agent,
    );
    final messages = ref.watch(messagesProvider(agent.threadId));

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
                color: Color(agent.accentColor),
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: Text(
                agent.avatarInitials,
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
                    agent.name,
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
                        agent.availability == AgentAvailability.paused
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
          PopupMenuButton<String>(
            icon: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: SydneyColors.line),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x04000000),
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: const Icon(Icons.more_vert_rounded, size: 18, color: SydneyColors.ink),
            ),
            tooltip: 'More options',
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: SydneyColors.line, width: 0.8),
            ),
            color: Colors.white,
            elevation: 4,
            shadowColor: Colors.black.withValues(alpha: 0.1),
            surfaceTintColor: Colors.transparent,
            onSelected: (value) => _handleMenuAction(value),
            itemBuilder: (context) => [
              PopupMenuItem(
                value: 'clear_chat',
                child: Row(
                  children: [
                    const Icon(Icons.delete_sweep_rounded, size: 18, color: SydneyColors.onSurfaceVariant),
                    const SizedBox(width: 10),
                    Text(
                      'Clear chat',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: SydneyColors.ink,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'toggle_pause',
                child: Row(
                  children: [
                    Icon(
                      agent.availability == AgentAvailability.paused
                          ? Icons.play_arrow_rounded
                          : Icons.pause_rounded,
                      size: 18,
                      color: SydneyColors.onSurfaceVariant,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      agent.availability == AgentAvailability.paused
                          ? 'Resume agent'
                          : 'Pause agent',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: SydneyColors.ink,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'mute',
                child: Row(
                  children: [
                    const Icon(Icons.notifications_off_outlined, size: 18, color: SydneyColors.onSurfaceVariant),
                    const SizedBox(width: 10),
                    Text(
                      'Mute agent',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: SydneyColors.ink,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
              const PopupMenuDivider(height: 8),
              PopupMenuItem(
                value: 'preferences',
                child: Row(
                  children: [
                    const Icon(Icons.settings_outlined, size: 18, color: SydneyColors.onSurfaceVariant),
                    const SizedBox(width: 10),
                    Text(
                      'Agent preferences',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: SydneyColors.ink,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
              if (_shouldShowHeatmap(agent))
                PopupMenuItem(
                  value: 'view_heatmap',
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_month_rounded, size: 18, color: SydneyColors.onSurfaceVariant),
                      const SizedBox(width: 10),
                      Text(
                        'View progress heatmap',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: SydneyColors.ink,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                ),
              if (!agent.isAssistant)
                PopupMenuItem(
                  value: 'run_now',
                  child: Row(
                    children: [
                      const Icon(Icons.play_circle_outline_rounded, size: 18, color: SydneyColors.onSurfaceVariant),
                      const SizedBox(width: 10),
                      Text(
                        'Run agent now',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: SydneyColors.ink,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                ),
              if (!agent.isAssistant) ...[
                const PopupMenuDivider(height: 8),
                PopupMenuItem(
                  value: 'delete',
                  child: Row(
                    children: [
                      const Icon(
                        Icons.delete_outline_rounded,
                        size: 18,
                        color: Color(0xFFDC2626),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        'Delete agent',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: const Color(0xFFDC2626),
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
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
                  _syncReadStateWithInbox(items);
                  if (_lastRenderedMessageCount != items.length ||
                      _lastAvailability != agent.availability) {
                    _lastRenderedMessageCount = items.length;
                    _lastAvailability = agent.availability;
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
                        return agent.availability ==
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
                            messagesProvider(_activeAgent.threadId),
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
          .sendReply(threadId: _activeAgent.threadId, text: text);
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

      // Perform secondary jumps to handle layout changes of lazy-loaded items
      Future.delayed(const Duration(milliseconds: 60), () {
        if (_scrollController.hasClients) {
          _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
        }
      });
      Future.delayed(const Duration(milliseconds: 180), () {
        if (_scrollController.hasClients) {
          _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
        }
      });
    });
  }

  void _syncReadStateWithInbox(List<Message> items) {
    String? latestVisibleMessageId;
    for (final message in items.reversed) {
      if (message.sender == MessageSender.agent ||
          message.sender == MessageSender.system) {
        latestVisibleMessageId = message.id;
        break;
      }
    }

    if (latestVisibleMessageId == null ||
        latestVisibleMessageId == _lastReadSyncedMessageId) {
      return;
    }

    _lastReadSyncedMessageId = latestVisibleMessageId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.invalidate(agentsProvider);
      }
    });
  }

  void _handleMessageAction(Map<String, dynamic> action) {
    unawaited(_handleMessageActionAsync(action));
  }

  Future<void> _handleMessageActionAsync(Map<String, dynamic> action) async {
    final actionType = action['type']?.toString();
    final actionId = action['id']?.toString() ?? '';
    final connectorId = _connectorIdFromAction(action);

    if (actionId == 'done' || actionId == 'snooze' || actionId == 'skip') {
      final messageId = action['messageId']?.toString();
      if (messageId == null || messageId.isEmpty) {
        return;
      }
      try {
        final actionText =
            actionId == 'done'
                ? "Completing today's study..."
                : actionId == 'skip'
                ? "Skipping today's study..."
                : "Snoozing study for 30 minutes...";

        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(actionText)));

        await ref
            .read(agentServiceProvider)
            .executeMessageAction(_activeAgent.id, messageId, actionId);

        ref.invalidate(messagesProvider(_activeAgent.threadId));
        ref.invalidate(agentsProvider);
      } catch (error) {
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
      return;
    }

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
        await ref.read(agentServiceProvider).runAgent(_activeAgent.id);
        ref.invalidate(messagesProvider(_activeAgent.threadId));
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
        ref.invalidate(messagesProvider(_activeAgent.threadId));
      }
    });
  }

  void _handleMenuAction(String action) {
    switch (action) {
      case 'clear_chat':
        _confirmClearChat();
      case 'toggle_pause':
        _togglePause();
      case 'mute':
        _toggleMute();
      case 'preferences':
        Navigator.of(
          context,
        ).pushNamed(AppRoutes.agentPreferences, arguments: _activeAgent);
      case 'view_heatmap':
        _showProgressHeatmap(_activeAgent);
      case 'run_now':
        _runAgentNow();
      case 'delete':
        _confirmDelete();
    }
  }

  void _showProgressHeatmap(Agent agent) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return SydneyHeatmapSheet(
          agentName: agent.name,
          history: agent.parsedIntent?['history'] is Map
              ? Map<String, dynamic>.from(agent.parsedIntent?['history'] as Map)
              : const {},
          intent: agent.parsedIntent?['intent']?.toString(),
        );
      },
    );
  }

  Future<void> _runAgentNow() async {
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Starting agent run...')),
      );
      await ref.read(agentServiceProvider).runAgent(_activeAgent.id);
      ref.invalidate(messagesProvider(_activeAgent.threadId));
      ref.invalidate(agentsProvider);
      _scheduleThreadRefresh(const Duration(seconds: 2));
      _scheduleThreadRefresh(const Duration(seconds: 6));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to run agent: $e')),
        );
      }
    }
  }

  Future<void> _confirmClearChat() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: const Text('Clear chat'),
            content: const Text(
              'This will permanently delete all messages in this conversation.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFFDC2626),
                ),
                child: const Text('Clear'),
              ),
            ],
          ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await ref.read(agentServiceProvider).clearChat(_activeAgent.id);
      ref.invalidate(messagesProvider(_activeAgent.threadId));
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Chat cleared.')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _togglePause() async {
    final isPaused = _activeAgent.availability == AgentAvailability.paused;
    final nextStatus = isPaused ? 'active' : 'paused';
    try {
      await ref.read(agentServiceProvider).patchAgent(_activeAgent.id, {
        'status': nextStatus,
      });
      ref.invalidate(agentsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isPaused ? 'Agent resumed.' : 'Agent paused.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  void _toggleMute() {
    // Mute is a local preference — show confirmation for now.
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Agent muted. You won\'t receive notifications for this agent.',
        ),
      ),
    );
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: const Text('Delete agent'),
            content: Text(
              'This will permanently delete "${_activeAgent.name}" and all its messages. This cannot be undone.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFFDC2626),
                ),
                child: const Text('Delete'),
              ),
            ],
          ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await ref.read(agentServiceProvider).archiveAgent(_activeAgent.id);
      ref.invalidate(agentsProvider);
      if (mounted) {
        Navigator.of(context).popUntil((route) => route.isFirst);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('"${_activeAgent.name}" deleted.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
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

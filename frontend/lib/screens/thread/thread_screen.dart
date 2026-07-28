import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../../models/message.dart';
import '../../models/attachment.dart';
import '../../models/message_archive.dart';
import '../../providers/agents_provider.dart';
import '../../providers/connectors_provider.dart';
import '../../providers/messages_provider.dart';
import '../../providers/message_archive_provider.dart';
import '../../config/routes.dart';
import '../../widgets/thread/message_card.dart';
import '../../widgets/thread/sydney_heatmap.dart';
import '../../widgets/thread/reply_bar.dart';
import '../../widgets/thread/typing_indicator.dart';
import '../../services/notification_clear_service.dart';
import '../../services/api.dart';
import '../../widgets/cuppet_logo.dart';
import '../../widgets/sydney_primitives.dart';

class ThreadScreen extends ConsumerStatefulWidget {
  const ThreadScreen({required this.agent, this.initialMessage, super.key});

  final Agent agent;
  final String? initialMessage;

  @override
  ConsumerState<ThreadScreen> createState() => _ThreadScreenState();
}

const _assistantWelcomeMessage =
    "I'm here for everyday conversation, just like the AI chatbots you already know and love. But stick around for the magic — tell me what you want, and I'll create a contact that messages you, like clockwork, exactly when you need it.";

PopupMenuItem<String> _agentMenuItem(
  BuildContext context, {
  required String value,
  required String label,
}) {
  return PopupMenuItem<String>(
    value: value,
    child: Text(
      label,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
        color: CuppetWorkspaceColors.ink,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class _ThreadScreenState extends ConsumerState<ThreadScreen> {
  final _scrollController = ScrollController();
  Timer? _shortScrollCorrection;
  Timer? _longScrollCorrection;
  int _lastRenderedMessageCount = -1;
  AgentAvailability? _lastAvailability;
  String? _lastReadSyncedMessageId;

  /// Optimistic UI: the message the user just sent, shown immediately.
  Message? _pendingUserMessage;

  /// True while we are waiting for the agent's reply after an optimistic send.
  bool _awaitingResponse = false;

  Message? _selectedMessage;
  Message? _replyToMessage;
  final List<Message> _archivedMessages = [];
  bool _archiveLoading = false;
  String? _archiveError;
  String? _archiveCursor;
  bool _archiveLoaded = false;

  Agent get _activeAgent {
    return ref
        .read(agentsProvider)
        .maybeWhen(
          data:
              (list) => list.firstWhere(
                (a) => a.id == widget.agent.id,
                orElse: () => widget.agent,
              ),
          orElse: () => widget.agent,
        );
  }

  List<Message> _assistantDisplayMessages(Agent agent, List<Message> messages) {
    if (!agent.isAssistant) {
      return messages;
    }

    final firstAgentIndex = messages.indexWhere(
      (message) => message.sender == MessageSender.agent,
    );
    if (firstAgentIndex == -1) {
      return messages;
    }

    final original = messages[firstAgentIndex];
    final updatedContent = Map<String, dynamic>.from(original.content);
    final rawData = updatedContent['data'];
    final updatedData =
        rawData is Map
            ? Map<String, dynamic>.from(rawData)
            : <String, dynamic>{};
    updatedContent['template'] = 'plain_text';
    updatedData['text'] = _assistantWelcomeMessage;
    updatedContent['data'] = updatedData;

    final updatedMessages = [...messages];
    updatedMessages[firstAgentIndex] = Message(
      id: original.id,
      threadId: original.threadId,
      sender: original.sender,
      createdAt: original.createdAt,
      content: updatedContent,
      deliveryState: original.deliveryState,
      driveBacked: original.driveBacked,
      readOnly: original.readOnly,
    );
    return updatedMessages;
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
    final containsTrackableKeywords =
        nameLower.contains('study') ||
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

    return isKnownIntent ||
        isTrackableTemplate ||
        hasHistory ||
        containsTrackableKeywords;
  }

  @override
  void initState() {
    super.initState();
    NotificationClearService.clearAll();
    final initialMessage = widget.initialMessage?.trim();
    if (initialMessage != null && initialMessage.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _sendReply(initialMessage, const []);
      });
    }
  }

  @override
  void dispose() {
    _shortScrollCorrection?.cancel();
    _longScrollCorrection?.cancel();
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
    final archiveState = ref.watch(messageArchiveProvider).asData?.value;

    return Scaffold(
      key: const ValueKey('thread-scaffold'),
      backgroundColor: CuppetWorkspaceColors.background,
      appBar:
          _selectedMessage != null
              ? AppBar(
                key: const ValueKey('thread-selection-app-bar'),
                titleSpacing: 0,
                backgroundColor: CuppetWorkspaceColors.background,
                foregroundColor: CuppetWorkspaceColors.ink,
                surfaceTintColor: Colors.transparent,
                bottom: const PreferredSize(
                  preferredSize: Size.fromHeight(1),
                  child: Divider(
                    height: 1,
                    color: CuppetWorkspaceColors.panelBorder,
                  ),
                ),
                leading: IconButton(
                  tooltip: 'Cancel selection',
                  onPressed: () => setState(() => _selectedMessage = null),
                  icon: const Icon(Icons.close_rounded, size: 18),
                ),
                title: Text(
                  '1 message selected',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontSize: 14),
                ),
                actions: [
                  IconButton(
                    tooltip: 'Copy text',
                    icon: const Icon(
                      Icons.copy_rounded,
                      size: 18,
                      color: CuppetWorkspaceColors.ink,
                    ),
                    onPressed: () {
                      Clipboard.setData(
                        ClipboardData(text: _selectedMessage!.preview),
                      );
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Message copied to clipboard'),
                        ),
                      );
                      setState(() => _selectedMessage = null);
                    },
                  ),
                  IconButton(
                    tooltip: 'Reply to message',
                    icon: const Icon(
                      Icons.reply_rounded,
                      size: 18,
                      color: CuppetWorkspaceColors.ink,
                    ),
                    onPressed: () {
                      final msg = _selectedMessage;
                      setState(() {
                        _replyToMessage = msg;
                        _selectedMessage = null;
                      });
                    },
                  ),
                  const SizedBox(width: SydneySpacing.md),
                ],
              )
              : AppBar(
                key: const ValueKey('thread-app-bar'),
                titleSpacing: 0,
                backgroundColor: CuppetWorkspaceColors.background,
                foregroundColor: CuppetWorkspaceColors.ink,
                surfaceTintColor: Colors.transparent,
                bottom: const PreferredSize(
                  preferredSize: Size.fromHeight(1),
                  child: Divider(
                    height: 1,
                    color: CuppetWorkspaceColors.panelBorder,
                  ),
                ),
                leading: IconButton(
                  tooltip: 'Back',
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.arrow_back_rounded, size: 18),
                ),
                title: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    Navigator.of(
                      context,
                    ).pushNamed(AppRoutes.agentPreferences, arguments: agent);
                  },
                  child: Row(
                    children: [
                      if (agent.isAssistant)
                        const CuppetAssistantAvatar(
                          key: ValueKey('assistant-thread-avatar'),
                          size: 32,
                        )
                      else
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: CuppetWorkspaceColors.softSage,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: CuppetWorkspaceColors.panelBorder,
                            ),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            agent.avatarInitials,
                            style: Theme.of(
                              context,
                            ).textTheme.labelMedium?.copyWith(
                              color: CuppetWorkspaceColors.primaryInk,
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
                                SizedBox(
                                  width: 6,
                                  height: 6,
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      color:
                                          agent.availability ==
                                                  AgentAvailability.paused
                                              ? CuppetWorkspaceColors.muted
                                              : CuppetWorkspaceColors.primary,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  agent.scheduledTimingLabel,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.labelSmall?.copyWith(
                                    color:
                                        agent.availability ==
                                                AgentAvailability.paused
                                            ? CuppetWorkspaceColors.muted
                                            : CuppetWorkspaceColors.primaryInk,
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
                ),
                actions: [
                  PopupMenuButton<String>(
                    constraints: const BoxConstraints(
                      minWidth: 160,
                      maxWidth: 205,
                    ),
                    icon: const Icon(
                      Icons.more_vert_rounded,
                      size: 20,
                      color: CuppetWorkspaceColors.ink,
                    ),
                    tooltip: 'More options',
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(
                        color: CuppetWorkspaceColors.border,
                        width: 0.8,
                      ),
                    ),
                    color: CuppetWorkspaceColors.card,
                    elevation: 4,
                    shadowColor: Colors.black.withValues(alpha: 0.1),
                    surfaceTintColor: Colors.transparent,
                    onSelected: (value) => _handleMenuAction(value),
                    itemBuilder:
                        (context) => [
                          if (!agent.isAssistant)
                            _agentMenuItem(
                              context,
                              value: 'run_now',
                              label: 'Run agent now',
                            ),
                          _agentMenuItem(
                            context,
                            value: 'preferences',
                            label: 'Agent preferences',
                          ),
                          if (_shouldShowHeatmap(agent))
                            _agentMenuItem(
                              context,
                              value: 'view_heatmap',
                              label: 'View progress heatmap',
                            ),
                          _agentMenuItem(
                            context,
                            value: 'clear_chat',
                            label: 'Clear chat',
                          ),
                          _agentMenuItem(
                            context,
                            value: 'mute',
                            label:
                                agent.notificationsMuted
                                    ? 'Unmute agent'
                                    : 'Mute agent',
                          ),
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

                  // Count items including optimistic ones for scroll detection.
                  final effectiveCount =
                      items.length + (_pendingUserMessage != null ? 1 : 0);
                  if (_lastRenderedMessageCount != effectiveCount ||
                      _lastAvailability != agent.availability) {
                    _lastRenderedMessageCount = effectiveCount;
                    _lastAvailability = agent.availability;
                    _scrollToBottomSoon();
                  }

                  // Build the display list: real items + optional pending user message.
                  final displayItems = [
                    ..._assistantDisplayMessages(agent, items),
                  ];
                  if (_pendingUserMessage != null) {
                    displayItems.add(_pendingUserMessage!);
                  }
                  final archivedEntries = _threadListEntries(_archivedMessages);
                  final liveEntries = _threadListEntries(
                    displayItems,
                    showTodayWhenEmpty: true,
                  );

                  // Show typing indicator while awaiting response or agent is thinking.
                  final showTyping =
                      _awaitingResponse ||
                      agent.availability == AgentAvailability.thinking;
                  final showArchiveBoundary =
                      archiveState?.enabled == true ||
                      archiveState?.actionRequired == true;
                  final itemCount =
                      archivedEntries.length +
                      (showArchiveBoundary ? 1 : 0) +
                      liveEntries.length +
                      (showTyping ? 1 : 0);

                  return ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(
                      vertical: SydneySpacing.lg,
                    ),
                    itemCount: itemCount,
                    itemBuilder: (context, index) {
                      if (index < archivedEntries.length) {
                        final entry = archivedEntries[index];
                        if (entry.dayLabel != null) {
                          return _ThreadDayPill(label: entry.dayLabel!);
                        }
                        return _ArchivedMessageTile(message: entry.message!);
                      }
                      var relativeIndex = index - archivedEntries.length;
                      if (showArchiveBoundary && relativeIndex == 0) {
                        return _ArchiveBoundary(
                          state: archiveState!,
                          loading: _archiveLoading,
                          loaded: _archiveLoaded,
                          hasMore: _archiveCursor != null,
                          error: _archiveError,
                          onLoad: () => _loadArchivedMessages(agent.id),
                          onReconnect:
                              () => Navigator.of(
                                context,
                              ).pushNamed(AppRoutes.connectors),
                        );
                      }
                      if (showArchiveBoundary) relativeIndex -= 1;
                      if (relativeIndex < liveEntries.length) {
                        final entry = liveEntries[relativeIndex];
                        if (entry.dayLabel != null) {
                          return _ThreadDayPill(label: entry.dayLabel!);
                        }
                        final message = entry.message!;
                        final isSelected = _selectedMessage?.id == message.id;
                        return GestureDetector(
                          onLongPress: () {
                            setState(() {
                              _selectedMessage = message;
                            });
                          },
                          onTap: () {
                            if (_selectedMessage != null) {
                              setState(() {
                                if (isSelected) {
                                  _selectedMessage = null;
                                } else {
                                  _selectedMessage = message;
                                }
                              });
                            }
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            decoration: BoxDecoration(
                              color:
                                  isSelected
                                      ? CuppetWorkspaceColors.primary
                                          .withValues(alpha: 0.08)
                                      : Colors.transparent,
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: SydneySpacing.page,
                            ),
                            child: MessageCard(
                              message: message,
                              onAction: _handleMessageAction,
                              useWorkspacePalette: true,
                            ),
                          ),
                        );
                      }
                      // Last slot is the typing indicator.
                      return showTyping
                          ? const Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: SydneySpacing.page,
                            ),
                            child: TypingIndicator(),
                          )
                          : const SizedBox.shrink();
                    },
                  );
                },
                loading: () => const _ThreadLoading(),
                error:
                    (error, _) => SydneyErrorState(
                      title: 'Conversation could not load',
                      message: friendlyErrorMessage(
                        error,
                        fallback: 'This conversation couldn’t be loaded.',
                      ),
                      onRetry:
                          () => ref.invalidate(
                            messagesProvider(_activeAgent.threadId),
                          ),
                    ),
              ),
            ),
            ReplyBar(
              onSend: _sendReply,
              replyToMessage: _replyToMessage,
              onCancelReply: () => setState(() => _replyToMessage = null),
              showRunNowHint: !_activeAgent.isAssistant,
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _loadArchivedMessages(String agentId) async {
    if (_archiveLoading || (_archiveLoaded && _archiveCursor == null)) return;
    setState(() {
      _archiveLoading = true;
      _archiveError = null;
    });
    try {
      final page = await ref
          .read(messageArchiveServiceProvider)
          .loadArchivedMessages(
            agentId: agentId,
            cursor: _archiveLoaded ? _archiveCursor : null,
          );
      if (!mounted) return;
      setState(() {
        _archivedMessages.insertAll(0, page.messages);
        _archiveCursor = page.nextCursor;
        _archiveLoaded = true;
      });
    } catch (error) {
      if (!mounted) return;
      setState(
        () =>
            _archiveError = friendlyErrorMessage(
              error,
              fallback: 'Older messages couldn’t be loaded from Drive.',
            ),
      );
    } finally {
      if (mounted) setState(() => _archiveLoading = false);
    }
  }

  Future<void> _sendReply(
    String text,
    List<ComposerAttachment> attachments, {
    String? sourceMessageId,
  }) async {
    final toQuote = _replyToMessage;
    setState(() => _replyToMessage = null);

    final finalReplyText =
        toQuote != null
            ? '> ${toQuote.preview.split('\n').join('\n> ')}\n\n$text'
            : text;

    // Optimistic: show the user's message immediately.
    final optimistic = Message(
      id: 'pending_${DateTime.now().microsecondsSinceEpoch}',
      threadId: _activeAgent.threadId,
      sender: MessageSender.user,
      createdAt: DateTime.now(),
      content: {
        'template': 'plain_text',
        'data': {
          'body': finalReplyText,
          if (attachments.isNotEmpty)
            'attachments': [
              for (final attachment in attachments)
                {
                  'id': attachment.id,
                  'name': attachment.name,
                  'mime_type': attachment.mimeType,
                  'size': attachment.size,
                },
            ],
        },
      },
    );
    setState(() {
      _pendingUserMessage = optimistic;
      _awaitingResponse = true;
    });
    _scrollToBottomSoon();

    // Fire the API call in the background — don't block the ReplyBar.
    unawaited(
      _sendReplyAsync(
        finalReplyText,
        attachments.map((attachment) => attachment.id).toList(),
        sourceMessageId: sourceMessageId,
      ),
    );
  }

  Future<void> _sendReplyAsync(
    String text,
    List<String> attachmentIds, {
    String? sourceMessageId,
  }) async {
    try {
      await ref
          .read(messageActionsProvider)
          .sendReply(
            threadId: _activeAgent.threadId,
            text: text,
            attachmentIds: attachmentIds,
            sourceMessageId: sourceMessageId,
          );
      // A text reply can request an asynchronous run (for example, "run now").
      // Keep polling as a fallback when a realtime event is delayed or missed.
      _scheduleRunRefreshes();
      // API succeeded — the real message is now in the server list.
      // Clear the optimistic duplicate; typing indicator will continue
      // showing via agent.availability == thinking until the agent responds.
      if (mounted) {
        setState(() {
          _pendingUserMessage = null;
          _awaitingResponse = false;
        });
      }
    } catch (error) {
      if (!mounted) return;
      // Clear optimistic state on failure so the UI doesn't stay stuck.
      setState(() {
        _pendingUserMessage = null;
        _awaitingResponse = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            friendlyErrorMessage(
              error,
              fallback: 'Your message couldn’t be sent.',
            ),
          ),
        ),
      );
    }
  }

  void _scrollToBottomSoon() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) {
        return;
      }
      _scrollController.jumpTo(_scrollController.position.maxScrollExtent);

      // Perform secondary jumps to handle layout changes of lazy-loaded items
      _shortScrollCorrection?.cancel();
      _shortScrollCorrection = Timer(const Duration(milliseconds: 60), () {
        if (_scrollController.hasClients) {
          _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
        }
      });
      _longScrollCorrection?.cancel();
      _longScrollCorrection = Timer(const Duration(milliseconds: 180), () {
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

    if (actionType == 'explore_news') {
      final rawHeadline = action['headline']?.toString() ?? '';
      final normalizedHeadline =
          rawHeadline
              .replaceAll(RegExp(r'\s+'), ' ')
              .replaceAll('"', "'")
              .trim();
      if (normalizedHeadline.isEmpty) return;
      final headline =
          normalizedHeadline.length > 500
              ? normalizedHeadline.substring(0, 500)
              : normalizedHeadline;
      final sourceMessageId = action['messageId']?.toString().trim();
      await _sendReply(
        'Search the web for "$headline" and explain in detail what happened, '
        'the verified timeline, why it matters, and the latest developments. '
        'Include source links.',
        const [],
        sourceMessageId:
            sourceMessageId?.isNotEmpty == true ? sourceMessageId : null,
      );
      return;
    }

    if (actionType == 'open_in_assistant') {
      final messageId = action['messageId']?.toString();
      if (messageId == null || messageId.isEmpty) return;
      try {
        final assistantId = await ref
            .read(messageServiceProvider)
            .handoffToAssistant(agentId: _activeAgent.id, messageId: messageId);
        final agents = await ref.read(agentServiceProvider).listAgents();
        final assistant = agents.firstWhere((agent) => agent.id == assistantId);
        ref.invalidate(messagesProvider(assistant.threadId));
        ref.invalidate(agentsProvider);
        if (!mounted) return;
        await Navigator.of(
          context,
        ).pushNamed(AppRoutes.thread, arguments: assistant);
      } catch (error) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                error,
                fallback: 'Assistant couldn’t open that message right now.',
              ),
            ),
          ),
        );
      }
      return;
    }

    if (actionType == 'generate_draft') {
      final title = action['title']?.toString() ?? '';
      final sourceMessageId = action['messageId']?.toString().trim();
      await _sendReply(
        'Generate a draft from this selected idea in your previous output: "$title"',
        const [],
        sourceMessageId:
            sourceMessageId?.isNotEmpty == true ? sourceMessageId : null,
      );
      return;
    }

    if (actionType == 'assistant_pending_action') {
      final decision = action['decision']?.toString();
      final pendingActionId = action['pending_action_id']?.toString();
      if (decision == null || pendingActionId == null) return;
      final selectedAgentId = action['selected_agent_id']?.toString();
      if (mounted) {
        setState(() => _awaitingResponse = true);
        _scrollToBottomSoon();
      }
      try {
        await ref
            .read(messageActionsProvider)
            .sendAssistantAction(
              threadId: _activeAgent.threadId,
              decision: decision,
              pendingActionId: pendingActionId,
              payload: {
                if (selectedAgentId != null)
                  'selected_agent_id': selectedAgentId,
              },
            );
        final refreshedMessages = await ref.refresh(
          messagesProvider(_activeAgent.threadId).future,
        );
        _syncReadStateWithInbox(refreshedMessages);
        ref.invalidate(agentsProvider);
      } catch (error) {
        if (!mounted) return;
        ref.invalidate(messagesProvider(_activeAgent.threadId));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                error,
                fallback: 'That action couldn’t be completed right now.',
              ),
            ),
          ),
        );
      } finally {
        if (mounted) {
          setState(() => _awaitingResponse = false);
        }
      }
      return;
    }

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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                error,
                fallback: 'That study action couldn’t be saved right now.',
              ),
            ),
          ),
        );
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
        _scheduleRunRefreshes();
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            friendlyErrorMessage(
              error,
              fallback: 'That connection couldn’t be completed right now.',
            ),
          ),
        ),
      );
    }
  }

  void _scheduleThreadRefresh(Duration delay) {
    Future<void>.delayed(delay, () {
      if (mounted) {
        ref.invalidate(messagesProvider(_activeAgent.threadId));
      }
    });
  }

  void _scheduleRunRefreshes() {
    for (final delay in const [
      Duration(seconds: 2),
      Duration(seconds: 5),
      Duration(seconds: 10),
      Duration(seconds: 20),
    ]) {
      _scheduleThreadRefresh(delay);
    }
  }

  void _handleMenuAction(String action) {
    switch (action) {
      case 'clear_chat':
        _confirmClearChat();
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
          history:
              agent.parsedIntent?['history'] is Map
                  ? Map<String, dynamic>.from(
                    agent.parsedIntent?['history'] as Map,
                  )
                  : const {},
          intent: agent.parsedIntent?['intent']?.toString(),
        );
      },
    );
  }

  Future<void> _runAgentNow() async {
    try {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Starting agent run...')));
      await ref.read(agentServiceProvider).runAgent(_activeAgent.id);
      ref.invalidate(messagesProvider(_activeAgent.threadId));
      ref.invalidate(agentsProvider);
      _scheduleRunRefreshes();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Run queued. Waiting for the result...'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                e,
                fallback: 'That agent couldn’t start right now.',
              ),
            ),
          ),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                e,
                fallback: 'This conversation couldn’t be cleared right now.',
              ),
            ),
          ),
        );
      }
    }
  }

  Future<void> _toggleMute() async {
    final shouldMute = !_activeAgent.notificationsMuted;
    try {
      await ref.read(agentServiceProvider).patchAgent(_activeAgent.id, {
        'notifications_muted': shouldMute,
      });
      ref.invalidate(agentsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              shouldMute
                  ? 'Agent muted. Push notifications are off.'
                  : 'Agent unmuted. Push notifications are on.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                e,
                fallback: 'Notification settings couldn’t be updated.',
              ),
            ),
          ),
        );
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
    'calendar' => 'Google Calendar',
    _ => 'Connector',
  };
}

class _ArchiveBoundary extends StatelessWidget {
  const _ArchiveBoundary({
    required this.state,
    required this.loading,
    required this.loaded,
    required this.hasMore,
    required this.onLoad,
    required this.onReconnect,
    this.error,
  });

  final MessageArchiveState state;
  final bool loading;
  final bool loaded;
  final bool hasMore;
  final String? error;
  final VoidCallback onLoad;
  final VoidCallback onReconnect;

  @override
  Widget build(BuildContext context) {
    return Padding(
      key: const ValueKey('thread-archive-boundary'),
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        0,
        SydneySpacing.page,
        SydneySpacing.lg,
      ),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(SydneySpacing.md),
        decoration: BoxDecoration(
          color: CuppetWorkspaceColors.card,
          borderRadius: BorderRadius.circular(SydneyRadius.md),
          border: Border.all(color: CuppetWorkspaceColors.border),
        ),
        child: Column(
          children: [
            const Icon(
              Icons.add_to_drive_outlined,
              color: CuppetWorkspaceColors.primaryInk,
            ),
            const SizedBox(height: SydneySpacing.xs),
            const Text(
              'Messages older than 30 days are archived in Google Drive.',
              textAlign: TextAlign.center,
            ),
            if (error != null) ...[
              const SizedBox(height: SydneySpacing.sm),
              Text(
                error!,
                key: const ValueKey('archive-load-error'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: SydneyColors.warning),
              ),
            ],
            const SizedBox(height: SydneySpacing.sm),
            if (state.actionRequired)
              TextButton.icon(
                onPressed: onReconnect,
                icon: const Icon(Icons.link_rounded),
                label: const Text('Reconnect Google Drive'),
              )
            else if (!loaded || hasMore || error != null)
              TextButton.icon(
                key: const ValueKey('load-archived-messages'),
                onPressed: loading ? null : onLoad,
                icon:
                    loading
                        ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                        : const Icon(Icons.history_rounded),
                label: Text(
                  loaded
                      ? 'Load older archived messages'
                      : 'View older history',
                ),
              )
            else
              const Text('No more archived messages.'),
          ],
        ),
      ),
    );
  }
}

class _ThreadListEntry {
  const _ThreadListEntry.day(this.dayLabel) : message = null;

  const _ThreadListEntry.message(this.message) : dayLabel = null;

  final String? dayLabel;
  final Message? message;
}

List<_ThreadListEntry> _threadListEntries(
  List<Message> messages, {
  bool showTodayWhenEmpty = false,
  DateTime? now,
}) {
  final localNow = (now ?? DateTime.now()).toLocal();
  if (messages.isEmpty) {
    return showTodayWhenEmpty
        ? [_ThreadListEntry.day(_threadDayLabel(localNow, localNow))]
        : const [];
  }

  final entries = <_ThreadListEntry>[];
  final groupDays = <String, DateTime>{};
  DateTime? previousDay;
  for (final message in messages) {
    final actualDay = _dateOnly(message.createdAt.toLocal());
    final groupId = message.groupId;
    final messageDay =
        groupId == null
            ? actualDay
            : groupDays.putIfAbsent(groupId, () => actualDay);
    if (previousDay == null || !_sameCalendarDay(previousDay, messageDay)) {
      entries.add(_ThreadListEntry.day(_threadDayLabel(messageDay, localNow)));
      previousDay = messageDay;
    }
    entries.add(_ThreadListEntry.message(message));
  }
  return entries;
}

DateTime _dateOnly(DateTime value) =>
    DateTime(value.year, value.month, value.day);

bool _sameCalendarDay(DateTime left, DateTime right) =>
    left.year == right.year &&
    left.month == right.month &&
    left.day == right.day;

String _threadDayLabel(DateTime value, DateTime now) {
  final day = _dateOnly(value.toLocal());
  final today = _dateOnly(now.toLocal());
  if (_sameCalendarDay(day, today)) return 'TODAY';
  final yesterday = DateTime(today.year, today.month, today.day - 1);
  if (_sameCalendarDay(day, yesterday)) return 'YESTERDAY';

  const weekdays = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ];
  const months = [
    'JANUARY',
    'FEBRUARY',
    'MARCH',
    'APRIL',
    'MAY',
    'JUNE',
    'JULY',
    'AUGUST',
    'SEPTEMBER',
    'OCTOBER',
    'NOVEMBER',
    'DECEMBER',
  ];
  final date =
      '${weekdays[day.weekday - 1]}, '
      '${months[day.month - 1]} ${day.day}';
  return day.year == today.year ? date : '$date, ${day.year}';
}

class _ArchivedMessageTile extends StatelessWidget {
  const _ArchivedMessageTile({required this.message});

  final Message message;

  @override
  Widget build(BuildContext context) {
    return Padding(
      key: ValueKey('archived-message-${message.id}'),
      padding: const EdgeInsets.symmetric(horizontal: SydneySpacing.page),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: SydneySpacing.xs),
            child: Text(
              'GOOGLE DRIVE · READ ONLY',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: CuppetWorkspaceColors.muted,
                letterSpacing: .8,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          MessageCard(message: message, useWorkspacePalette: true),
        ],
      ),
    );
  }
}

class _ThreadDayPill extends StatelessWidget {
  const _ThreadDayPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      key: ValueKey('thread-day-$label'),
      padding: const EdgeInsets.only(bottom: SydneySpacing.lg),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: 10,
            vertical: SydneySpacing.xs,
          ),
          decoration: BoxDecoration(
            color: CuppetWorkspaceColors.softSage,
            borderRadius: BorderRadius.circular(SydneyRadius.full),
            border: Border.all(color: CuppetWorkspaceColors.panelBorder),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: CuppetWorkspaceColors.primaryInk,
              letterSpacing: 1.1,
              fontWeight: FontWeight.w800,
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
              color: CuppetWorkspaceColors.card,
              borderRadius: SydneyRadius.bubbleAgent,
              border: Border.all(color: CuppetWorkspaceColors.border),
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
              color: CuppetWorkspaceColors.softSage,
              borderRadius: SydneyRadius.bubbleUser,
            ),
          ),
        ),
      ],
    );
  }
}

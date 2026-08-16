import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/message.dart';
import '../sydney_primitives.dart';
import '../templates/assistant_suggestion_template.dart';
import '../templates/checklist_template.dart';
import '../templates/comparison_template.dart';
import '../templates/data_summary_template.dart';
import '../templates/daily_task_template.dart';
import '../templates/news_brief_template.dart';
import '../templates/plain_text_template.dart';
import '../templates/progress_tracker_template.dart';
import '../templates/streak_counter_template.dart';
import '../templates/system_template.dart';
import '../templates/urgency_list_template.dart';
import '../templates/study_guide_template.dart';
import '../templates/dsa_question_template.dart';
import '../templates/content_extractor_template.dart';
import '../templates/portfolio_watch_template.dart';
import '../templates/briefing_card_template.dart';
import '../templates/agent_selection_template.dart';
import '../templates/action_confirmation_template.dart';
import '../templates/all_clear_template.dart';

class MessageCard extends StatelessWidget {
  const MessageCard({
    required this.message,
    this.onAction,
    this.feedbackType,
    this.useWorkspacePalette = false,
    this.selected = false,
    super.key,
  });

  final Message message;
  final ValueChanged<Map<String, dynamic>>? onAction;
  final String? feedbackType;
  final bool useWorkspacePalette;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    if (message.sender == MessageSender.system) {
      return Padding(
        padding: const EdgeInsets.only(bottom: SydneySpacing.lg),
        child: Center(
          child: Container(
            constraints: const BoxConstraints(maxWidth: 320),
            padding: const EdgeInsets.symmetric(
              horizontal: SydneySpacing.lg,
              vertical: 10,
            ),
            decoration: BoxDecoration(
              color:
                  useWorkspacePalette
                      ? CuppetWorkspaceColors.softSage
                      : SydneyColors.systemBubble,
              borderRadius: BorderRadius.circular(SydneyRadius.md),
              border: Border.all(
                color:
                    useWorkspacePalette
                        ? CuppetWorkspaceColors.panelBorder
                        : SydneyColors.line,
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A1C1A17),
                  blurRadius: 8,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  color:
                      useWorkspacePalette
                          ? CuppetWorkspaceColors.primaryInk
                          : SydneyColors.info,
                  size: 16,
                ),
                const SizedBox(width: 10),
                Flexible(child: SystemTemplate(data: message.data)),
              ],
            ),
          ),
        ),
      );
    }

    final isUser = message.sender == MessageSender.user;
    final showFeedback =
        !isUser &&
        onAction != null &&
        !message.isRecoveredRawPayload &&
        message.isFeedbackEligible &&
        message.isLastPart;
    final feedbackSubjectKey = message.feedbackSubjectKey;
    final maxWidth = MediaQuery.sizeOf(context).width * 0.84;
    final defaultSurfaceColor =
        useWorkspacePalette
            ? (isUser
                ? CuppetWorkspaceColors.softSage
                : CuppetWorkspaceColors.card)
            : (isUser ? SydneyColors.userBubble : SydneyColors.agentBubble);
    final content = Container(
      key: ValueKey('message-surface-${message.id}'),
      constraints: BoxConstraints(maxWidth: maxWidth),
      padding: const EdgeInsets.all(SydneySpacing.lg),
      decoration: BoxDecoration(
        color: defaultSurfaceColor,
        borderRadius:
            isUser ? SydneyRadius.bubbleUser : SydneyRadius.bubbleAgent,
        border:
            selected
                ? null
                : useWorkspacePalette
                ? Border.all(
                  color:
                      isUser
                          ? CuppetWorkspaceColors.panelBorder
                          : CuppetWorkspaceColors.border,
                )
                : isUser
                ? null
                : Border.all(color: SydneyColors.line),
        boxShadow: [
          BoxShadow(
            color:
                selected
                    ? CuppetWorkspaceColors.primary.withValues(alpha: 0.14)
                    : const Color(0x0A1C1A17),
            blurRadius: selected ? 10 : 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      foregroundDecoration:
          selected
              ? BoxDecoration(
                color: CuppetWorkspaceColors.primary.withValues(alpha: 0.12),
                borderRadius:
                    isUser ? SydneyRadius.bubbleUser : SydneyRadius.bubbleAgent,
              )
              : null,
      child: DefaultTextStyle.merge(
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color:
              useWorkspacePalette
                  ? CuppetWorkspaceColors.ink
                  : (isUser ? SydneyColors.ink : SydneyColors.onSurface),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (!isUser &&
                message.isMultipart &&
                message.template != 'news_brief') ...[
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: SydneySpacing.sm,
                  vertical: SydneySpacing.xxs,
                ),
                decoration: BoxDecoration(
                  color: SydneyColors.primarySoft,
                  borderRadius: BorderRadius.circular(SydneyRadius.full),
                ),
                child: Text(
                  'PART ${message.partIndex + 1} OF ${message.partCount}',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: SydneyColors.primary,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .7,
                  ),
                ),
              ),
              const SizedBox(height: SydneySpacing.sm),
            ],
            _TemplateRouter(
              message: message,
              isUser: isUser,
              onAction: onAction,
            ),
            if (showFeedback && feedbackType == null) ...[
              const SizedBox(height: SydneySpacing.md),
              Wrap(
                spacing: SydneySpacing.sm,
                runSpacing: SydneySpacing.xs,
                children: [
                  OutlinedButton.icon(
                    key: ValueKey('message-feedback-useful-${message.id}'),
                    onPressed:
                        () => onAction!({
                          'type': 'message_feedback',
                          'feedback_type': 'useful',
                          'messageId': message.id,
                          if (feedbackSubjectKey != null) ...{
                            'subject_type': 'topic',
                            'subject_key': feedbackSubjectKey,
                          },
                        }),
                    icon: const Icon(Icons.thumb_up_alt_outlined, size: 16),
                    label: const Text('Useful'),
                    style: _feedbackButtonStyle(
                      context,
                      useWorkspacePalette: useWorkspacePalette,
                    ),
                  ),
                  OutlinedButton.icon(
                    key: ValueKey('message-feedback-not-useful-${message.id}'),
                    onPressed:
                        () => onAction!({
                          'type': 'message_feedback',
                          'feedback_type': 'not_useful',
                          'messageId': message.id,
                          if (feedbackSubjectKey != null) ...{
                            'subject_type': 'topic',
                            'subject_key': feedbackSubjectKey,
                          },
                        }),
                    icon: const Icon(Icons.thumb_down_alt_outlined, size: 16),
                    label: const Text('Not useful'),
                    style: _feedbackButtonStyle(
                      context,
                      useWorkspacePalette: useWorkspacePalette,
                    ),
                  ),
                ],
              ),
            ],
            if (message.isLastPart) ...[
              const SizedBox(height: SydneySpacing.sm),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  _formatMessageTime(message.createdAt),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: (useWorkspacePalette
                            ? (isUser
                                ? CuppetWorkspaceColors.ink
                                : CuppetWorkspaceColors.muted)
                            : (isUser
                                ? SydneyColors.ink
                                : SydneyColors.mutedInk))
                        .withValues(alpha: 0.68),
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );

    final messageSpacing =
        message.isMultipart && !message.isLastPart
            ? SydneySpacing.xs
            : SydneySpacing.lg;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: messageSpacing),
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child: content,
      ),
    );
  }
}

ButtonStyle _feedbackButtonStyle(
  BuildContext context, {
  bool useWorkspacePalette = false,
}) {
  final primaryColor =
      useWorkspacePalette
          ? CuppetWorkspaceColors.primaryInk
          : SydneyColors.primary;
  final borderColor =
      useWorkspacePalette
          ? CuppetWorkspaceColors.panelBorder
          : SydneyColors.line;
  final bgTint =
      useWorkspacePalette
          ? CuppetWorkspaceColors.softSage.withValues(alpha: 0.35)
          : SydneyColors.primarySoft.withValues(alpha: 0.4);

  return OutlinedButton.styleFrom(
    foregroundColor: primaryColor,
    backgroundColor: bgTint,
    side: BorderSide(color: borderColor),
    padding: const EdgeInsets.symmetric(
      horizontal: SydneySpacing.md,
      vertical: SydneySpacing.sm,
    ),
    minimumSize: const Size(0, 36),
    tapTargetSize: MaterialTapTargetSize.padded,
    visualDensity: VisualDensity.standard,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(SydneyRadius.full),
    ),
    textStyle: Theme.of(context).textTheme.labelMedium?.copyWith(
      fontSize: 12.5,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.1,
    ),
  );
}

String _formatMessageTime(DateTime value) {
  final local = value.toLocal();
  final hour =
      local.hour == 0
          ? 12
          : local.hour > 12
          ? local.hour - 12
          : local.hour;
  final minute = local.minute.toString().padLeft(2, '0');
  final period = local.hour >= 12 ? 'PM' : 'AM';
  return '$hour:$minute $period';
}

class _TemplateRouter extends StatelessWidget {
  const _TemplateRouter({
    required this.message,
    required this.isUser,
    required this.onAction,
  });

  final Message message;
  final bool isUser;
  final ValueChanged<Map<String, dynamic>>? onAction;

  @override
  Widget build(BuildContext context) {
    final data = message.data;
    final actionHandler = message.isRecoveredRawPayload ? null : onAction;
    final messageActionHandler =
        actionHandler == null
            ? null
            : (Map<String, dynamic> actionData) =>
                actionHandler({...actionData, 'messageId': message.id});
    if (isUser) {
      return PlainTextTemplate(data: data, textColor: SydneyColors.ink);
    }

    return switch (message.template) {
      'all_clear' => AllClearTemplate(data: data),
      'plain_text' => PlainTextTemplate(data: data),
      'progress_tracker' => ProgressTrackerTemplate(data: data),
      'urgency_list' => UrgencyListTemplate(data: data),
      'data_summary' => DataSummaryTemplate(data: data),
      'checklist' => ChecklistTemplate(data: data),
      'daily_task' => DailyTaskTemplate(
        data: data,
        onAction: messageActionHandler,
      ),
      'agent_selection' => AgentSelectionTemplate(
        data: data,
        onAction: actionHandler,
      ),
      'action_confirmation' => ActionConfirmationTemplate(
        data: data,
        onAction: actionHandler,
      ),
      'assistant_suggestion' => AssistantSuggestionTemplate(
        data: data,
        onAction: messageActionHandler,
      ),
      'streak_counter' => StreakCounterTemplate(data: data),
      'comparison' => ComparisonTemplate(data: data),
      'system' => SystemTemplate(data: data),
      'news_brief' => NewsBriefTemplate(
        data: data,
        showEmptyState: !message.isMultipart,
        onAction: messageActionHandler,
      ),
      'study_guide' => StudyGuideTemplate(
        data: data,
        onAction: messageActionHandler,
      ),
      'dsa_question' => DsaQuestionTemplate(
        data: data,
        onAction: messageActionHandler,
      ),
      'content_extractor' => ContentExtractorTemplate(
        data: data,
        startIndex: message.itemOffset,
        onAction: messageActionHandler,
      ),
      'portfolio_watch' => PortfolioWatchTemplate(data: data),
      'briefing_card' => BriefingCardTemplate(
        data: data,
        onOpen:
            actionHandler == null ||
                    data['assistant_context'] == true ||
                    !message.isLastPart
                ? null
                : () => actionHandler({
                  'type': 'open_in_assistant',
                  'messageId': message.id,
                }),
      ),
      _ => _UnsupportedTemplateCard(template: message.template, data: data),
    };
  }
}

class _UnsupportedTemplateCard extends StatelessWidget {
  const _UnsupportedTemplateCard({required this.template, required this.data});

  final String template;
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = _fallbackText(data, const [
      'title',
      'heading',
      'name',
      'label',
      'subject',
    ]);
    final body = _fallbackText(data, const [
      'text',
      'body',
      'summary',
      'description',
      'message',
      'detail',
      'why_it_matters',
    ]);
    final entries = _fallbackEntries(data);
    final details = _fallbackDetails(data);
    final hasContent =
        title != null ||
        body != null ||
        entries.isNotEmpty ||
        details.isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(SydneySpacing.md),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.auto_awesome_outlined,
                size: 20,
                color: SydneyColors.primary,
              ),
              const SizedBox(width: SydneySpacing.sm),
              Expanded(
                child: Text(
                  title ?? 'Message update',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: SydneyColors.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          if (body != null) ...[
            const SizedBox(height: SydneySpacing.sm),
            MarkdownText(
              text: body,
              textColor: SydneyColors.onSurface,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(height: 1.38),
            ),
          ],
          if (entries.isNotEmpty) ...[
            if (body != null) const SizedBox(height: SydneySpacing.sm),
            for (var index = 0; index < entries.length; index++) ...[
              _FallbackEntryView(entry: entries[index]),
              if (index < entries.length - 1)
                const SizedBox(height: SydneySpacing.xs),
            ],
          ],
          if (details.isNotEmpty) ...[
            const SizedBox(height: SydneySpacing.sm),
            Wrap(
              spacing: SydneySpacing.sm,
              runSpacing: SydneySpacing.xs,
              children: [
                for (final detail in details)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: SydneySpacing.sm,
                      vertical: SydneySpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: SydneyColors.primarySoft,
                      borderRadius: BorderRadius.circular(SydneyRadius.full),
                    ),
                    child: Text(
                      '${detail.label}: ${detail.value}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: SydneyColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ],
          if (!hasContent)
            Text(
              'This message is available in a newer display format.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
            ),
          if (hasContent) ...[
            const SizedBox(height: SydneySpacing.xs),
            Text(
              'Some interactive options are unavailable in this version.',
              style: Theme.of(
                context,
              ).textTheme.labelSmall?.copyWith(color: SydneyColors.mutedInk),
            ),
          ],
        ],
      ),
    );
  }
}

class _FallbackEntry {
  const _FallbackEntry({this.title, this.body});

  final String? title;
  final String? body;
}

class _FallbackDetail {
  const _FallbackDetail(this.label, this.value);

  final String label;
  final String value;
}

class _FallbackEntryView extends StatelessWidget {
  const _FallbackEntryView({required this.entry});

  final _FallbackEntry entry;

  @override
  Widget build(BuildContext context) {
    final title = entry.title;
    final body = entry.body;
    if (title == null && body == null) return const SizedBox.shrink();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 7),
          child: Icon(Icons.circle, size: 5, color: SydneyColors.primary),
        ),
        const SizedBox(width: SydneySpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (title != null)
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: SydneyColors.ink,
                  ),
                ),
              if (body != null)
                MarkdownText(
                  text: body,
                  textColor: SydneyColors.onSurface,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(height: 1.35),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

String? _fallbackText(Map<String, dynamic> data, List<String> keys) {
  for (final key in keys) {
    final value = data[key];
    if (value is String && value.trim().isNotEmpty) {
      return _limitFallbackText(value.trim());
    }
    if (value is num || value is bool) return value.toString();
  }
  return null;
}

List<_FallbackEntry> _fallbackEntries(Map<String, dynamic> data) {
  const listKeys = [
    'items',
    'entries',
    'results',
    'records',
    'updates',
    'highlights',
    'tldr',
  ];
  final entries = <_FallbackEntry>[];
  for (final key in listKeys) {
    final raw = data[key];
    if (raw is! List) continue;
    for (final item in raw) {
      if (entries.length >= 8) return entries;
      if (item is Map) {
        final map = Map<String, dynamic>.from(item);
        final title = _fallbackText(map, const [
          'title',
          'headline',
          'name',
          'label',
          'subject',
        ]);
        final body = _fallbackText(map, const [
          'summary',
          'description',
          'body',
          'text',
          'detail',
          'status',
        ]);
        if (title != null || body != null) {
          entries.add(_FallbackEntry(title: title, body: body));
        }
      } else if (item is String && item.trim().isNotEmpty) {
        entries.add(_FallbackEntry(body: _limitFallbackText(item.trim())));
      }
    }
    if (entries.isNotEmpty) return entries;
  }
  return entries;
}

List<_FallbackDetail> _fallbackDetails(Map<String, dynamic> data) {
  const detailKeys = <String, String>{
    'status': 'Status',
    'category': 'Category',
    'date': 'Date',
    'time': 'Time',
    'source': 'Source',
    'count': 'Count',
    'progress': 'Progress',
  };
  final details = <_FallbackDetail>[];
  for (final entry in detailKeys.entries) {
    final value = data[entry.key];
    if (value is String && value.trim().isNotEmpty) {
      details.add(
        _FallbackDetail(entry.value, _limitFallbackText(value.trim(), 80)),
      );
    } else if (value is num || value is bool) {
      details.add(_FallbackDetail(entry.value, value.toString()));
    }
  }
  return details;
}

String _limitFallbackText(String value, [int limit = 500]) {
  if (value.length <= limit) return value;
  return '${value.substring(0, limit - 1).trimRight()}…';
}

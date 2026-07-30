import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/message.dart';
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
    super.key,
  });

  final Message message;
  final ValueChanged<Map<String, dynamic>>? onAction;
  final String? feedbackType;
  final bool useWorkspacePalette;

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
    final content = Container(
      key: ValueKey('message-surface-${message.id}'),
      constraints: BoxConstraints(maxWidth: maxWidth),
      padding: const EdgeInsets.all(SydneySpacing.lg),
      decoration: BoxDecoration(
        color:
            useWorkspacePalette
                ? (isUser
                    ? CuppetWorkspaceColors.softSage
                    : CuppetWorkspaceColors.card)
                : (isUser ? SydneyColors.userBubble : SydneyColors.agentBubble),
        borderRadius:
            isUser ? SydneyRadius.bubbleUser : SydneyRadius.bubbleAgent,
        border:
            useWorkspacePalette
                ? Border.all(
                  color:
                      isUser
                          ? CuppetWorkspaceColors.panelBorder
                          : CuppetWorkspaceColors.border,
                )
                : isUser
                ? null
                : Border.all(color: SydneyColors.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A1C1A17),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
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

    return Padding(
      padding: EdgeInsets.only(
        bottom:
            message.isMultipart && !message.isLastPart
                ? SydneySpacing.xs
                : SydneySpacing.lg,
      ),
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
      _ => const _UnsupportedTemplateCard(),
    };
  }
}

class _UnsupportedTemplateCard extends StatelessWidget {
  const _UnsupportedTemplateCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(SydneySpacing.md),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.extension_off_outlined,
            size: 20,
            color: SydneyColors.mutedInk,
          ),
          const SizedBox(width: SydneySpacing.sm),
          Expanded(
            child: Text(
              'This message uses a display template supported in newer app versions.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
            ),
          ),
        ],
      ),
    );
  }
}

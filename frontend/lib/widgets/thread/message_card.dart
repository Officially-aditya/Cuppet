import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/message.dart';
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

class MessageCard extends StatelessWidget {
  const MessageCard({
    required this.message,
    this.onAction,
    this.useWorkspacePalette = false,
    super.key,
  });

  final Message message;
  final ValueChanged<Map<String, dynamic>>? onAction;
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
            _TemplateRouter(
              message: message,
              isUser: isUser,
              onAction: onAction,
            ),
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
                          : (isUser ? SydneyColors.ink : SydneyColors.mutedInk))
                      .withValues(alpha: 0.68),
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: SydneySpacing.lg),
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child: content,
      ),
    );
  }
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
    if (isUser) {
      return PlainTextTemplate(data: data, textColor: SydneyColors.ink);
    }

    return switch (message.template) {
      'plain_text' => PlainTextTemplate(data: data),
      'progress_tracker' => ProgressTrackerTemplate(data: data),
      'urgency_list' => UrgencyListTemplate(data: data),
      'data_summary' => DataSummaryTemplate(data: data),
      'checklist' => ChecklistTemplate(data: data),
      'daily_task' => DailyTaskTemplate(data: data, onAction: onAction),
      'agent_selection' => AgentSelectionTemplate(
        data: data,
        onAction: onAction,
      ),
      'action_confirmation' => ActionConfirmationTemplate(
        data: data,
        onAction: onAction,
      ),
      'streak_counter' => StreakCounterTemplate(data: data),
      'comparison' => ComparisonTemplate(data: data),
      'system' => SystemTemplate(data: data),
      'news_brief' => NewsBriefTemplate(data: data),
      'study_guide' => StudyGuideTemplate(
        data: data,
        onAction: (actionData) {
          if (onAction != null) {
            onAction!({...actionData, 'messageId': message.id});
          }
        },
      ),
      'dsa_question' => DsaQuestionTemplate(
        data: data,
        onAction: (actionData) {
          if (onAction != null) {
            onAction!({...actionData, 'messageId': message.id});
          }
        },
      ),
      'content_extractor' => ContentExtractorTemplate(
        data: data,
        onAction: (actionData) {
          if (onAction != null) {
            onAction!({...actionData, 'messageId': message.id});
          }
        },
      ),
      'portfolio_watch' => PortfolioWatchTemplate(data: data),
      'briefing_card' => BriefingCardTemplate(
        data: data,
        onOpen:
            data['assistant_context'] == true
                ? null
                : () {
                  if (onAction != null) {
                    onAction!({
                      'type': 'open_in_assistant',
                      'messageId': message.id,
                    });
                  }
                },
      ),
      _ => const PlainTextTemplate(
        data: {
          'text':
              'This message uses a template this app version does not support yet.',
        },
      ),
    };
  }
}

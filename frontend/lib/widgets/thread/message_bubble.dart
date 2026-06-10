import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/message.dart';
import '../templates/checklist_template.dart';
import '../templates/data_summary_template.dart';
import '../templates/plain_text_template.dart';
import '../templates/progress_tracker_template.dart';
import '../templates/streak_counter_template.dart';
import '../templates/system_template.dart';
import '../templates/urgency_list_template.dart';

class MessageBubble extends StatelessWidget {
  const MessageBubble({required this.message, super.key});

  final Message message;

  @override
  Widget build(BuildContext context) {
    if (message.sender == MessageSender.system) {
      return Padding(
        padding: const EdgeInsets.only(bottom: SydneySpacing.md),
        child: Center(
          child: Container(
            constraints: const BoxConstraints(maxWidth: 320),
            padding: const EdgeInsets.symmetric(
              horizontal: SydneySpacing.md,
              vertical: SydneySpacing.sm,
            ),
            decoration: BoxDecoration(
              color: SydneyColors.systemBubble,
              borderRadius: BorderRadius.circular(SydneyRadius.full),
            ),
            child: SystemTemplate(data: message.data),
          ),
        ),
      );
    }

    final isUser = message.sender == MessageSender.user;
    final borderRadius =
        isUser ? SydneyRadius.bubbleUser : SydneyRadius.bubbleAgent;
    final color = isUser ? SydneyColors.userBubble : SydneyColors.agentBubble;
    final alignment = isUser ? Alignment.centerRight : Alignment.centerLeft;

    return Align(
      alignment: alignment,
      child: Container(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.82,
        ),
        margin: const EdgeInsets.only(bottom: SydneySpacing.md),
        padding: const EdgeInsets.all(SydneySpacing.md),
        decoration: BoxDecoration(
          color: color,
          borderRadius: borderRadius,
          border: isUser ? null : Border.all(color: SydneyColors.line),
        ),
        child: _TemplateRouter(message: message),
      ),
    );
  }
}

class _TemplateRouter extends StatelessWidget {
  const _TemplateRouter({required this.message});

  final Message message;

  @override
  Widget build(BuildContext context) {
    final data = message.data;
    return switch (message.template) {
      'plain_text' => PlainTextTemplate(data: data),
      'progress_tracker' => ProgressTrackerTemplate(data: data),
      'urgency_list' => UrgencyListTemplate(data: data),
      'data_summary' => DataSummaryTemplate(data: data),
      'checklist' => ChecklistTemplate(data: data),
      'streak_counter' => StreakCounterTemplate(data: data),
      'system' => SystemTemplate(data: data),
      _ => const PlainTextTemplate(
        data: {
          'text':
              'This message uses a template this app version does not support yet.',
        },
      ),
    };
  }
}

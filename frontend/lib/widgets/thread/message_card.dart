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

class MessageCard extends StatelessWidget {
  const MessageCard({required this.message, super.key});

  final Message message;

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
              vertical: SydneySpacing.sm,
            ),
            decoration: BoxDecoration(
              color: SydneyColors.systemBubble,
              borderRadius: BorderRadius.circular(SydneyRadius.full),
              border: Border.all(color: SydneyColors.line),
            ),
            child: SystemTemplate(data: message.data),
          ),
        ),
      );
    }

    final isUser = message.sender == MessageSender.user;
    final maxWidth = MediaQuery.sizeOf(context).width * 0.84;
    final content = Container(
      constraints: BoxConstraints(maxWidth: maxWidth),
      padding: const EdgeInsets.all(SydneySpacing.lg),
      decoration: BoxDecoration(
        color: isUser ? SydneyColors.primary : SydneyColors.agentBubble,
        borderRadius:
            isUser ? SydneyRadius.bubbleUser : SydneyRadius.bubbleAgent,
        border: isUser ? null : Border.all(color: SydneyColors.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: DefaultTextStyle.merge(
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: isUser ? Colors.white : SydneyColors.ink,
        ),
        child: _TemplateRouter(message: message, isUser: isUser),
      ),
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: SydneySpacing.lg),
      child: Align(
        alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
        child:
            message.template == 'data_summary'
                ? _ReadyStack(child: content)
                : content,
      ),
    );
  }
}

class _ReadyStack extends StatelessWidget {
  const _ReadyStack({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.check_circle_rounded,
              color: SydneyColors.primary,
              size: 16,
            ),
            const SizedBox(width: SydneySpacing.xs),
            Text(
              'Ready',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: SydneyColors.primary,
                letterSpacing: 0,
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.xs),
        child,
      ],
    );
  }
}

class _TemplateRouter extends StatelessWidget {
  const _TemplateRouter({required this.message, required this.isUser});

  final Message message;
  final bool isUser;

  @override
  Widget build(BuildContext context) {
    final data = message.data;
    if (isUser) {
      return PlainTextTemplate(data: data, textColor: Colors.white);
    }

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

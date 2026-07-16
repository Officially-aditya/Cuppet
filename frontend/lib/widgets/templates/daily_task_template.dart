import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';
import 'template_utils.dart';

class DailyTaskTemplate extends StatefulWidget {
  const DailyTaskTemplate({required this.data, this.onAction, super.key});

  final Map<String, dynamic> data;
  final ValueChanged<Map<String, dynamic>>? onAction;

  @override
  State<DailyTaskTemplate> createState() => _DailyTaskTemplateState();
}

class _DailyTaskTemplateState extends State<DailyTaskTemplate> {
  bool _submitted = false;
  String? _submittedLabel;

  @override
  void didUpdateWidget(covariant DailyTaskTemplate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.data['pending_action_id'] !=
        widget.data['pending_action_id']) {
      _submitted = false;
      _submittedLabel = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    final title = data['title']?.toString() ?? 'Daily task';
    final task = data['task']?.toString() ?? 'No task was provided.';
    final contextText = data['context']?.toString();
    final minutes = _number(data['estimated_minutes']);
    final resolved = data['resolved'] == true || _submitted;
    final actions =
        resolved
            ? const <Map<String, dynamic>>[]
            : templateMaps(data['actions']);
    final resultLabel = data['result_label']?.toString() ?? _submittedLabel;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.flag_rounded,
              color: SydneyColors.primary,
              size: 20,
            ),
            const SizedBox(width: SydneySpacing.sm),
            Expanded(
              child: Text(title, style: Theme.of(context).textTheme.titleSmall),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.md),
        MarkdownText(
          text: task,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.35),
        ),
        if (contextText != null && contextText.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          MarkdownText(
            text: contextText,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              height: 1.35,
            ),
          ),
        ],
        if (minutes != null) ...[
          const SizedBox(height: SydneySpacing.md),
          _MetaPill(icon: Icons.timer_outlined, label: '$minutes min'),
        ],
        if (resolved && resultLabel != null) ...[
          const SizedBox(height: SydneySpacing.md),
          _ActionResult(
            label: resultLabel,
            failed: data['resolution']?.toString() == 'failed',
          ),
        ],
        if (actions.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          Wrap(
            spacing: SydneySpacing.sm,
            runSpacing: SydneySpacing.sm,
            children: [
              for (final action in actions)
                _ActionPill(
                  label: action['label']?.toString() ?? 'Action',
                  primary: action['style'] == 'primary',
                  onPressed:
                      widget.onAction == null
                          ? null
                          : () {
                            if (action['type'] == 'assistant_pending_action') {
                              setState(() {
                                _submitted = true;
                                _submittedLabel =
                                    action['decision'] == 'cancel'
                                        ? 'Cancellation submitted'
                                        : 'Request submitted';
                              });
                            }
                            widget.onAction!(action);
                          },
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _ActionResult extends StatelessWidget {
  const _ActionResult({required this.label, required this.failed});

  final String label;
  final bool failed;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('resolved-daily-task-action'),
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.md,
        vertical: SydneySpacing.sm,
      ),
      decoration: BoxDecoration(
        color: failed ? SydneyColors.dangerSoft : SydneyColors.primarySoft,
        borderRadius: BorderRadius.circular(SydneyRadius.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            failed ? Icons.error_outline_rounded : Icons.check_circle_rounded,
            size: 16,
            color: failed ? SydneyColors.danger : SydneyColors.primary,
          ),
          const SizedBox(width: SydneySpacing.xs),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: failed ? SydneyColors.danger : SydneyColors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.sm,
        vertical: SydneySpacing.xs,
      ),
      decoration: BoxDecoration(
        color: SydneyColors.primarySoft,
        borderRadius: BorderRadius.circular(SydneyRadius.full),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: SydneyColors.primary),
          const SizedBox(width: SydneySpacing.xs),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.primary,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionPill extends StatelessWidget {
  const _ActionPill({
    required this.label,
    required this.primary,
    required this.onPressed,
  });

  final String label;
  final bool primary;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final foreground =
        primary ? SydneyColors.onPrimary : SydneyColors.onSurface;
    final background =
        primary ? SydneyColors.primary : SydneyColors.surfaceContainer;

    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: foreground,
        backgroundColor: background,
        disabledForegroundColor: foreground,
        disabledBackgroundColor: background,
        padding: const EdgeInsets.symmetric(
          horizontal: SydneySpacing.md,
          vertical: SydneySpacing.sm,
        ),
        minimumSize: const Size(0, 36),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.full),
          side:
              primary
                  ? BorderSide.none
                  : const BorderSide(color: SydneyColors.line),
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: foreground,
          fontWeight: FontWeight.w700,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

int? _number(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value);
  }
  return null;
}

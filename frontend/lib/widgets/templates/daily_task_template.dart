import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';

class DailyTaskTemplate extends StatelessWidget {
  const DailyTaskTemplate({required this.data, this.onAction, super.key});

  final Map<String, dynamic> data;
  final ValueChanged<Map<String, dynamic>>? onAction;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Daily task';
    final task = data['task']?.toString() ?? 'No task was provided.';
    final contextText = data['context']?.toString();
    final minutes = _number(data['estimated_minutes']);
    final actions = _maps(data['actions']);

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
                  onPressed: onAction == null ? null : () => onAction!(action),
                ),
            ],
          ),
        ],
      ],
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

List<Map<String, dynamic>> _maps(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();
}

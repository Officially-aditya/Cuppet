import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class ProgressTrackerTemplate extends StatelessWidget {
  const ProgressTrackerTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Progress';
    final steps = _maps(data['steps']);
    final total = _number(data['total']) ?? steps.length;
    final current =
        _number(data['current']) ??
        steps.where((step) => step['done'] == true).length;
    final progress =
        total <= 0 ? 0.0 : (current / total).clamp(0.0, 1.0).toDouble();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(
              Icons.check_box_outlined,
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
        Text(
          data['text']?.toString() ??
              "I'm ready to help. Let's finish setting up your workflow.",
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: SydneyColors.onSurfaceVariant),
        ),
        const SizedBox(height: SydneySpacing.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Progress',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: SydneyColors.onSurfaceVariant,
                letterSpacing: 0,
              ),
            ),
            Text(
              '$current of $total complete',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: SydneyColors.primary,
                letterSpacing: 0,
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.xs),
        ClipRRect(
          borderRadius: BorderRadius.circular(SydneyRadius.full),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 7,
            color: SydneyColors.primary,
            backgroundColor: SydneyColors.surfaceContainer,
          ),
        ),
        if (steps.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.lg),
          for (final step in steps)
            Padding(
              padding: const EdgeInsets.only(bottom: SydneySpacing.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _StepMarker(done: step['done'] == true),
                  const SizedBox(width: SydneySpacing.sm),
                  Expanded(
                    child: Text(
                      step['label']?.toString() ?? 'Untitled step',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color:
                            step['done'] == true
                                ? SydneyColors.subtleInk
                                : SydneyColors.onSurface,
                        decoration:
                            step['done'] == true
                                ? TextDecoration.lineThrough
                                : TextDecoration.none,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ],
    );
  }
}

class _StepMarker extends StatelessWidget {
  const _StepMarker({required this.done});

  final bool done;

  @override
  Widget build(BuildContext context) {
    if (done) {
      return Container(
        width: 20,
        height: 20,
        decoration: const BoxDecoration(
          color: SydneyColors.primary,
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.check_rounded, color: Colors.white, size: 14),
      );
    }

    return Container(
      width: 20,
      height: 20,
      decoration: BoxDecoration(
        color: SydneyColors.agentBubble,
        shape: BoxShape.circle,
        border: Border.all(color: SydneyColors.outlineVariant, width: 2),
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

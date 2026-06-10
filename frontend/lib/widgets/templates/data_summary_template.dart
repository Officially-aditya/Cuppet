import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class DataSummaryTemplate extends StatelessWidget {
  const DataSummaryTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Summary';
    final summary = data['summary']?.toString();
    final metrics = _maps(data['metrics']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleSmall),
        if (summary != null && summary.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          Text(
            summary,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: SydneyColors.mutedInk),
          ),
        ],
        if (metrics.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          Wrap(
            spacing: SydneySpacing.sm,
            runSpacing: SydneySpacing.sm,
            children: [
              for (final metric in metrics)
                _MetricPill(
                  label: metric['label']?.toString() ?? 'Metric',
                  value: metric['value']?.toString() ?? '-',
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.md,
        vertical: SydneySpacing.sm,
      ),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.mutedInk,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: SydneySpacing.xs),
          Text(value, style: Theme.of(context).textTheme.titleSmall),
        ],
      ),
    );
  }
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

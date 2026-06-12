import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class DataSummaryTemplate extends StatelessWidget {
  const DataSummaryTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Summary';
    final intro = data['text']?.toString();
    final summary =
        data['summary']?.toString() ?? data['description']?.toString();
    final metrics = _maps(data['metrics']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (intro != null && intro.isNotEmpty) ...[
          Text(
            intro,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: SydneyColors.onSurface,
              height: 1.45,
            ),
          ),
          const SizedBox(height: SydneySpacing.md),
          const Divider(height: 1, color: SydneyColors.line),
          const SizedBox(height: SydneySpacing.md),
        ],
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
              'READY',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: SydneyColors.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.md),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(SydneySpacing.md),
          decoration: BoxDecoration(
            color: SydneyColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(SydneyRadius.md),
            border: Border.all(color: SydneyColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title.toUpperCase(),
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: SydneyColors.onSurface,
                  letterSpacing: 0.5,
                ),
              ),
              if (summary != null && summary.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.xs),
                Text(
                  summary,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.onSurfaceVariant,
                    height: 1.35,
                  ),
                ),
              ],
              if (metrics.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.md),
                Row(
                  children: [
                    for (var index = 0; index < metrics.length; index++) ...[
                      Expanded(
                        child: _MetricPill(
                          label:
                              metrics[index]['label']?.toString() ?? 'Metric',
                          value: metrics[index]['value']?.toString() ?? '-',
                        ),
                      ),
                      if (index < metrics.length - 1)
                        const SizedBox(width: SydneySpacing.sm),
                    ],
                  ],
                ),
              ],
            ],
          ),
        ),
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
        horizontal: SydneySpacing.xs,
        vertical: SydneySpacing.sm,
      ),
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              fontSize: 8,
              height: 1.05,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: SydneySpacing.xs),
          Text(
            value,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: SydneyColors.onSurface,
              fontWeight: FontWeight.w800,
            ),
          ),
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

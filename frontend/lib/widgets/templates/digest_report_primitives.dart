import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class DigestMetricStrip extends StatelessWidget {
  const DigestMetricStrip({required this.metrics, super.key});

  final List<Map<String, dynamic>> metrics;

  @override
  Widget build(BuildContext context) {
    final visibleMetrics = metrics.take(4).toList(growable: false);

    return Row(
      children: [
        for (var index = 0; index < visibleMetrics.length; index++) ...[
          Expanded(child: _DigestMetric(metric: visibleMetrics[index])),
          if (index < visibleMetrics.length - 1)
            const SizedBox(width: SydneySpacing.xs),
        ],
      ],
    );
  }
}

class _DigestMetric extends StatelessWidget {
  const _DigestMetric({required this.metric});

  final Map<String, dynamic> metric;

  @override
  Widget build(BuildContext context) {
    final label = metric['label']?.toString() ?? 'Metric';
    final value = metric['value']?.toString() ?? '-';

    return Container(
      height: 62,
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.xxs,
        vertical: SydneySpacing.sm,
      ),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Column(
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: SydneyColors.primary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: SydneySpacing.xs),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              fontSize: 9,
              height: 1.1,
              letterSpacing: 0,
            ),
          ),
        ],
      ),
    );
  }
}

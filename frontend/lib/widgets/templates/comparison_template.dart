import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';
import 'template_utils.dart';

class ComparisonTemplate extends StatelessWidget {
  const ComparisonTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title =
        data['title']?.toString() ??
        data['headline']?.toString() ??
        'Comparison';
    final period = data['period']?.toString();
    final rows = templateMaps(data['rows']);
    final insight = data['insight']?.toString();
    final narrative = data['trending_narrative']?.toString();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.compare_arrows_rounded,
              color: SydneyColors.primary,
              size: 20,
            ),
            const SizedBox(width: SydneySpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleSmall),
                  if (period != null && period.isNotEmpty)
                    Text(
                      period,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: SydneyColors.onSurfaceVariant,
                        letterSpacing: 0,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.md),
        if (rows.isEmpty)
          Text(
            'No comparison rows yet.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: SydneyColors.mutedInk),
          )
        else
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: SydneySpacing.md),
              child: _ComparisonRow(row: row),
            ),
        if (insight != null && insight.isNotEmpty) ...[
          const Divider(height: SydneySpacing.lg, color: SydneyColors.line),
          MarkdownText(
            text: insight,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurface,
              fontWeight: FontWeight.w600,
              height: 1.35,
            ),
          ),
        ],
        if (narrative != null && narrative.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          MarkdownText(
            text: narrative,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              height: 1.35,
            ),
          ),
        ],
      ],
    );
  }
}

class _ComparisonRow extends StatelessWidget {
  const _ComparisonRow({required this.row});

  final Map<String, dynamic> row;

  @override
  Widget build(BuildContext context) {
    final label = row['label']?.toString() ?? 'Item';
    final changes = templateStrings(row['changes']);
    final sentiment = row['sentiment']?.toString();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _StatusDot(sentiment: sentiment),
        const SizedBox(width: SydneySpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: SydneySpacing.xs),
              if (changes.isEmpty)
                Text(
                  'No changes listed.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.onSurfaceVariant,
                  ),
                )
              else
                for (final change in changes)
                  Padding(
                    padding: const EdgeInsets.only(bottom: SydneySpacing.xs),
                    child: MarkdownText(
                      text: change,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: SydneyColors.onSurfaceVariant,
                        height: 1.3,
                      ),
                    ),
                  ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.sentiment});

  final String? sentiment;

  @override
  Widget build(BuildContext context) {
    final color = switch (sentiment) {
      'active' => SydneyColors.primary,
      'quiet' => SydneyColors.subtleInk,
      'needs_input' => SydneyColors.warning,
      _ => SydneyColors.info,
    };

    return Container(
      width: 10,
      height: 10,
      margin: const EdgeInsets.only(top: 5),
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

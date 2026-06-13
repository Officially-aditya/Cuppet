import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class StreakCounterTemplate extends StatelessWidget {
  const StreakCounterTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final label = data['label']?.toString() ?? 'Streak';
    final count = _number(data['count']) ?? 0;
    final unit = data['unit']?.toString() ?? 'days';
    final caption = data['caption']?.toString();
    final word = data['word']?.toString();
    final definition = data['definition']?.toString();
    final example = data['example']?.toString();
    final translation = data['translation']?.toString();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 1),
          child: Icon(Icons.info_outline_rounded, color: SydneyColors.info),
        ),
        const SizedBox(width: SydneySpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: Theme.of(context).textTheme.titleSmall),
              if (word != null && word.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.md),
                Text(
                  word,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: SydneyColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (definition != null && definition.isNotEmpty) ...[
                  const SizedBox(height: SydneySpacing.xs),
                  Text(
                    definition,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurface,
                      height: 1.35,
                    ),
                  ),
                ],
                if (example != null && example.isNotEmpty) ...[
                  const SizedBox(height: SydneySpacing.sm),
                  Text(
                    example,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurfaceVariant,
                      fontStyle: FontStyle.italic,
                      height: 1.35,
                    ),
                  ),
                ],
                if (translation != null && translation.isNotEmpty)
                  Text(
                    translation,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.mutedInk,
                      height: 1.35,
                    ),
                  ),
              ],
              const SizedBox(height: SydneySpacing.xs),
              Text(
                '$count $unit',
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: SydneyColors.mutedInk),
              ),
              if (caption != null && caption.isNotEmpty)
                Text(caption, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      ],
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

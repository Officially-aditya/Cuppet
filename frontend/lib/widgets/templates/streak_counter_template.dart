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

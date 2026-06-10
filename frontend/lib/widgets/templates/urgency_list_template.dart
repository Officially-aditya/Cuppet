import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class UrgencyListTemplate extends StatelessWidget {
  const UrgencyListTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Priority list';
    final items = _maps(data['items']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: SydneySpacing.md),
        if (items.isEmpty)
          Text(
            'No priority items right now.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: SydneyColors.mutedInk),
          )
        else
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: SydneySpacing.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _UrgencyDot(urgency: item['urgency']?.toString()),
                  const SizedBox(width: SydneySpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item['label']?.toString() ?? 'Untitled item',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        if (item['due'] != null)
                          Text(
                            item['due'].toString(),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}

class _UrgencyDot extends StatelessWidget {
  const _UrgencyDot({required this.urgency});

  final String? urgency;

  @override
  Widget build(BuildContext context) {
    final color = switch (urgency) {
      'high' => SydneyColors.danger,
      'medium' => SydneyColors.warning,
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

List<Map<String, dynamic>> _maps(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList();
}

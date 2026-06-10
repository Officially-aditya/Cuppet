import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class ChecklistTemplate extends StatelessWidget {
  const ChecklistTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Checklist';
    final items = _maps(data['items']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: SydneySpacing.md),
        if (items.isEmpty)
          Text(
            'No checklist items yet.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: SydneyColors.mutedInk),
          )
        else
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: SydneySpacing.sm),
              child: Row(
                children: [
                  Icon(
                    item['checked'] == true
                        ? Icons.check_box_rounded
                        : Icons.check_box_outline_blank_rounded,
                    color:
                        item['checked'] == true
                            ? SydneyColors.primary
                            : SydneyColors.subtleInk,
                  ),
                  const SizedBox(width: SydneySpacing.sm),
                  Expanded(
                    child: Text(
                      item['label']?.toString() ?? 'Untitled item',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
      ],
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

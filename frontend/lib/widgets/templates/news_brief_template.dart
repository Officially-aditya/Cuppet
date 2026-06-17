import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class NewsBriefTemplate extends StatelessWidget {
  const NewsBriefTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Update';
    final itemsList = data['items'];
    final items = _maps(itemsList);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Main Title Header (Static)
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: SydneySpacing.xs,
            vertical: SydneySpacing.xs,
          ),
          child: Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: SydneyColors.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: SydneySpacing.sm),
        if (items.isEmpty)
          Padding(
            padding: const EdgeInsets.only(left: SydneySpacing.xs),
            child: Text(
              'No content for this run.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.onSurfaceVariant,
              ),
            ),
          )
        else
          for (final item in items) ...[
            _NewsItemCard(item: item),
            const SizedBox(height: SydneySpacing.sm),
          ],
      ],
    );
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
}

class _NewsItemCard extends StatefulWidget {
  const _NewsItemCard({required this.item});

  final Map<String, dynamic> item;

  @override
  State<_NewsItemCard> createState() => _NewsItemCardState();
}

class _NewsItemCardState extends State<_NewsItemCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final headline = widget.item['headline']?.toString();
    final summary = widget.item['summary']?.toString() ?? '';

    // If there is no headline, render it as a simple text block (intro/outro) - always visible
    if (headline == null || headline.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: SydneySpacing.xs,
          vertical: SydneySpacing.xs,
        ),
        child: Text(
          summary,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: SydneyColors.onSurfaceVariant,
            height: 1.4,
          ),
        ),
      );
    }

    // If there is a headline, render it in a pretty collapsible boxed card
    return GestureDetector(
      onTap: () {
        setState(() {
          _isExpanded = !_isExpanded;
        });
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(SydneySpacing.md),
        decoration: BoxDecoration(
          color: SydneyColors.surface,
          borderRadius: BorderRadius.circular(SydneyRadius.sm),
          border: Border.all(color: SydneyColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  margin: const EdgeInsets.only(top: 6, right: SydneySpacing.sm),
                  decoration: const BoxDecoration(
                    color: SydneyColors.primary,
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(
                  child: Text(
                    headline,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurface,
                      fontWeight: FontWeight.w700,
                      height: 1.3,
                    ),
                  ),
                ),
                const SizedBox(width: SydneySpacing.xs),
                AnimatedRotation(
                  turns: _isExpanded ? 0.5 : 0.0,
                  duration: const Duration(milliseconds: 200),
                  child: Icon(
                    Icons.expand_more_rounded,
                    color: SydneyColors.onSurfaceVariant.withValues(alpha: 0.8),
                    size: 16,
                  ),
                ),
              ],
            ),
            AnimatedCrossFade(
              firstChild: const SizedBox(width: double.infinity),
              secondChild: Padding(
                padding: const EdgeInsets.only(top: SydneySpacing.xs, left: 14),
                child: Text(
                  summary,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.onSurfaceVariant,
                    height: 1.35,
                  ),
                ),
              ),
              crossFadeState: _isExpanded
                  ? CrossFadeState.showSecond
                  : CrossFadeState.showFirst,
              duration: const Duration(milliseconds: 200),
              sizeCurve: Curves.easeInOut,
            ),
          ],
        ),
      ),
    );
  }
}

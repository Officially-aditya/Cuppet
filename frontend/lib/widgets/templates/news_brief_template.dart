import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class NewsBriefTemplate extends StatefulWidget {
  const NewsBriefTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  State<NewsBriefTemplate> createState() => _NewsBriefTemplateState();
}

class _NewsBriefTemplateState extends State<NewsBriefTemplate> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final title = widget.data['title']?.toString() ?? 'Update';
    final itemsList = widget.data['items'];
    final items = _maps(itemsList);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Collapsible Header Card
        GestureDetector(
          onTap: () {
            setState(() {
              _isExpanded = !_isExpanded;
            });
          },
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: SydneySpacing.lg,
              vertical: SydneySpacing.md,
            ),
            decoration: BoxDecoration(
              color: SydneyColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(SydneyRadius.md),
              border: Border.all(color: SydneyColors.line),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x06000000),
                  blurRadius: 4,
                  offset: Offset(0, 1),
                ),
              ],
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.event_note_rounded,
                  color: SydneyColors.primary,
                  size: 20,
                ),
                const SizedBox(width: SydneySpacing.sm),
                Expanded(
                  child: Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: SydneyColors.onSurface,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: SydneySpacing.sm),
                AnimatedRotation(
                  turns: _isExpanded ? 0.5 : 0.0,
                  duration: const Duration(milliseconds: 200),
                  child: Icon(
                    Icons.expand_more_rounded,
                    color: SydneyColors.onSurfaceVariant.withValues(alpha: 0.8),
                    size: 20,
                  ),
                ),
              ],
            ),
          ),
        ),

        // Expanded Content
        AnimatedCrossFade(
          firstChild: const SizedBox(width: double.infinity),
          secondChild: Padding(
            padding: const EdgeInsets.only(top: SydneySpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
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
                    _buildItemWidget(context, item),
                    const SizedBox(height: SydneySpacing.sm),
                  ],
              ],
            ),
          ),
          crossFadeState: _isExpanded
              ? CrossFadeState.showSecond
              : CrossFadeState.showFirst,
          duration: const Duration(milliseconds: 250),
          sizeCurve: Curves.easeInOut,
        ),
      ],
    );
  }

  Widget _buildItemWidget(BuildContext context, Map<String, dynamic> item) {
    final headline = item['headline']?.toString();
    final summary = item['summary']?.toString() ?? '';

    // If there is no headline, render it as a simple text block (intro/outro)
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

    // If there is a headline, render it in a pretty boxed card
    return Container(
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
            ],
          ),
          const SizedBox(height: SydneySpacing.xs),
          Padding(
            padding: const EdgeInsets.only(left: 14), // indent summary to align with headline text
            child: Text(
              summary,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.onSurfaceVariant,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
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

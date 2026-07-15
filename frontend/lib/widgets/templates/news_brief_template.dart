import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';

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
    final items = _normalizedItems(itemsList);

    final initialCountVal =
        widget.data['initial_item_count'] ?? widget.data['initialItemCount'];
    final initialCount =
        initialCountVal is num ? initialCountVal.toInt() : null;

    final shouldTruncate = initialCount != null && items.length > initialCount;
    final visibleItems =
        (shouldTruncate && !_isExpanded)
            ? items.take(initialCount).toList()
            : items;
    final featuredIndex = visibleItems.indexWhere(
      (item) => _hasVisibleText(item['headline']?.toString() ?? ''),
    );

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
        else ...[
          AnimatedSize(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
            alignment: Alignment.topCenter,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var index = 0; index < visibleItems.length; index++) ...[
                  _NewsItemCard(
                    item: visibleItems[index],
                    featured: index == featuredIndex,
                  ),
                  const SizedBox(height: SydneySpacing.sm),
                ],
              ],
            ),
          ),
          if (shouldTruncate) ...[
            const SizedBox(height: SydneySpacing.xs),
            Center(
              child: TextButton.icon(
                onPressed: () {
                  setState(() {
                    _isExpanded = !_isExpanded;
                  });
                },
                icon: Icon(
                  _isExpanded
                      ? Icons.keyboard_arrow_up_rounded
                      : Icons.keyboard_arrow_down_rounded,
                  color: SydneyColors.primary,
                  size: 18,
                ),
                label: Text(
                  _isExpanded
                      ? 'Show less'
                      : 'Show more (${items.length - initialCount} remaining)',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: SydneyColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: SydneySpacing.lg,
                    vertical: SydneySpacing.sm,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SydneyRadius.full),
                    side: const BorderSide(color: SydneyColors.line),
                  ),
                  backgroundColor: SydneyColors.surface,
                ),
              ),
            ),
          ],
        ],
      ],
    );
  }

  List<Map<String, dynamic>> _normalizedItems(Object? value) {
    if (value is! List) {
      return const [];
    }

    final rawItems =
        value
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
    final items = <Map<String, dynamic>>[];

    for (var index = 0; index < rawItems.length; index++) {
      final item = rawItems[index];
      final headline = item['headline']?.toString().trim() ?? '';
      final summary = item['summary']?.toString().trim() ?? '';
      final hasHeadline = _hasVisibleText(headline);
      final hasSummary = _hasVisibleText(summary);

      if (!hasHeadline && !hasSummary) {
        continue;
      }

      if (hasHeadline && !hasSummary && _isDetailLabel(headline)) {
        final next = index + 1 < rawItems.length ? rawItems[index + 1] : null;
        if (next != null) {
          final nextHeadline = next['headline']?.toString().trim() ?? '';
          final nextSummary = next['summary']?.toString().trim() ?? '';
          final detail =
              [
                if (_hasVisibleText(nextHeadline)) nextHeadline,
                if (_hasVisibleText(nextSummary)) nextSummary,
              ].join(' ').trim();

          if (_hasVisibleText(detail)) {
            items.add({...item, 'headline': headline, 'summary': detail});
            index += 1;
            continue;
          }
        }
      }

      if (hasHeadline && !hasSummary) {
        items.add({'summary': headline});
        continue;
      }

      items.add({...item, 'headline': headline, 'summary': summary});
    }

    return items;
  }
}

bool _hasVisibleText(String value) {
  return value
      .replaceAll(RegExp(r'\[([^\]]+)\]\([^)]+\)'), r'$1')
      .replaceAll(RegExp(r'[*_`#>~\s:.-]+'), '')
      .isNotEmpty;
}

bool _isDetailLabel(String value) {
  final normalized =
      value.toLowerCase().replaceAll(RegExp(r'[*_`#>:.-]+'), '').trim();
  return const {
    'focus',
    'hint',
    'target',
    'goal',
    'approach',
    'example',
    'complexity',
    'practice',
    'why it matters',
  }.contains(normalized);
}

class _NewsItemCard extends StatefulWidget {
  const _NewsItemCard({required this.item, required this.featured});

  final Map<String, dynamic> item;
  final bool featured;

  @override
  State<_NewsItemCard> createState() => _NewsItemCardState();
}

class _NewsItemCardState extends State<_NewsItemCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final headline = widget.item['headline']?.toString();
    final summary = widget.item['summary']?.toString() ?? '';
    final hasSummary = _hasVisibleText(summary);
    final category = _newsCategory(widget.item);

    if (headline == null || headline.isEmpty || !hasSummary) {
      return Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: SydneySpacing.xs,
          vertical: SydneySpacing.xs,
        ),
        child: MarkdownText(
          text: hasSummary ? summary : (headline ?? ''),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: SydneyColors.onSurfaceVariant,
            height: 1.4,
          ),
        ),
      );
    }

    if (widget.featured) {
      return Container(
        key: const ValueKey('news-featured-story'),
        width: double.infinity,
        padding: const EdgeInsets.all(SydneySpacing.md),
        decoration: BoxDecoration(
          color: SydneyColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(SydneyRadius.md),
          border: Border.all(
            color: SydneyColors.primary.withValues(alpha: 0.28),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                _NewsLabel(label: 'Top story', prominent: true),
                Spacer(),
                Icon(
                  Icons.newspaper_rounded,
                  color: SydneyColors.primary,
                  size: 18,
                ),
              ],
            ),
            const SizedBox(height: SydneySpacing.md),
            MarkdownText(
              text: headline,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                color: SydneyColors.onSurface,
                fontWeight: FontWeight.w800,
                height: 1.25,
              ),
            ),
            const SizedBox(height: SydneySpacing.sm),
            _NewsLabel(label: category),
            const SizedBox(height: SydneySpacing.sm),
            MarkdownText(
              text: summary,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.onSurfaceVariant,
                height: 1.45,
              ),
            ),
          ],
        ),
      );
    }

    return InkWell(
      onTap: () => setState(() => _isExpanded = !_isExpanded),
      borderRadius: BorderRadius.circular(SydneyRadius.sm),
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
                  width: 32,
                  height: 32,
                  margin: const EdgeInsets.only(right: SydneySpacing.sm),
                  decoration: BoxDecoration(
                    color: SydneyColors.primarySoft,
                    borderRadius: BorderRadius.circular(SydneyRadius.sm),
                  ),
                  child: const Icon(
                    Icons.article_outlined,
                    color: SydneyColors.primary,
                    size: 17,
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      MarkdownText(
                        text: headline,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: SydneyColors.onSurface,
                          fontWeight: FontWeight.w700,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: SydneySpacing.xs),
                      _NewsLabel(label: category),
                    ],
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
                padding: const EdgeInsets.only(top: SydneySpacing.sm, left: 40),
                child: MarkdownText(
                  text: summary,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.onSurfaceVariant,
                    height: 1.35,
                  ),
                ),
              ),
              crossFadeState:
                  _isExpanded
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

class _NewsLabel extends StatelessWidget {
  const _NewsLabel({required this.label, this.prominent = false});

  final String label;
  final bool prominent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.sm,
        vertical: SydneySpacing.xs,
      ),
      decoration: BoxDecoration(
        color:
            prominent
                ? SydneyColors.primary
                : SydneyColors.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(SydneyRadius.full),
      ),
      child: Text(
        label.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color:
              prominent
                  ? SydneyColors.onPrimary
                  : SydneyColors.onSurfaceVariant,
          fontWeight: FontWeight.w800,
          fontSize: 9,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

String _newsCategory(Map<String, dynamic> item) {
  final supplied = item['category']?.toString().trim();
  if (supplied != null && supplied.isNotEmpty) return supplied;

  final text = [item['headline'], item['summary']].join(' ').toLowerCase();
  if (RegExp(r'\b(ai|artificial intelligence|llm|model)\b').hasMatch(text)) {
    return 'AI';
  }
  if (RegExp(r'\b(policy|government|regulation|law|court)\b').hasMatch(text)) {
    return 'Policy';
  }
  if (RegExp(
    r'\b(market|economy|economic|funding|business)\b',
  ).hasMatch(text)) {
    return 'Business';
  }
  if (RegExp(r'\b(science|research|space|climate|health)\b').hasMatch(text)) {
    return 'Science';
  }
  if (RegExp(r'\b(india|indian|delhi|mumbai)\b').hasMatch(text)) {
    return 'India';
  }
  if (RegExp(
    r'\b(software|developer|security|technology|tech)\b',
  ).hasMatch(text)) {
    return 'Technology';
  }
  return 'Update';
}

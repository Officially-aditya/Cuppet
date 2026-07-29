import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';

class NewsBriefTemplate extends StatelessWidget {
  const NewsBriefTemplate({
    required this.data,
    this.showEmptyState = true,
    this.onAction,
    super.key,
  });

  final Map<String, dynamic> data;
  final bool showEmptyState;
  final ValueChanged<Map<String, dynamic>>? onAction;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Update';
    final itemsList = data['items'];
    final items = _normalizedItems(itemsList);
    final tldr =
        data['tldr'] is List
            ? (data['tldr'] as List)
                .map((item) => item.toString().trim())
                .where((item) => item.isNotEmpty)
                .toList(growable: false)
            : const <String>[];
    final perspectives =
        data['perspectives'] is List
            ? (data['perspectives'] as List)
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList(growable: false)
            : const <Map<String, dynamic>>[];
    final timeline =
        data['timeline'] is List
            ? (data['timeline'] as List)
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList(growable: false)
            : const <Map<String, dynamic>>[];
    final whyItMatters = data['why_it_matters']?.toString().trim();
    final featuredIndex = items.indexWhere(
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
        if (tldr.isNotEmpty) ...[
          _NewsContextSection(
            title: 'TL;DR',
            lines: tldr,
            icon: Icons.bolt_rounded,
          ),
          const SizedBox(height: SydneySpacing.sm),
        ],
        if (items.isEmpty && showEmptyState)
          Padding(
            padding: const EdgeInsets.only(left: SydneySpacing.xs),
            child: Text(
              'No content for this run.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.onSurfaceVariant,
              ),
            ),
          )
        else if (items.isNotEmpty)
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var index = 0; index < items.length; index++) ...[
                _NewsItemCard(
                  item: items[index],
                  featured: index == featuredIndex,
                  onActivity:
                      onAction == null
                          ? null
                          : () => onAction!({
                            'type': 'message_activity',
                            'activity_type': 'content_expanded',
                            'subject_type': 'topic',
                            'subject_key': _newsCategory(items[index]),
                          }),
                  onFeedback:
                      onAction == null
                          ? null
                          : (feedbackType) => onAction!({
                            'type': 'message_feedback',
                            'feedback_type': feedbackType,
                            'subject_type':
                                feedbackType == 'not_interested_source'
                                    ? 'source'
                                    : 'topic',
                            'subject_key':
                                feedbackType == 'not_interested_source'
                                    ? _newsSourceKey(items[index]['source'])
                                    : _newsCategory(items[index]),
                          }),
                  onExplore:
                      onAction == null
                          ? null
                          : () => onAction!({
                            'type': 'explore_news',
                            'headline':
                                items[index]['headline']?.toString() ?? '',
                            if (items[index]['source'] != null)
                              'source': items[index]['source'].toString(),
                            if (items[index]['url'] != null)
                              'url': items[index]['url'].toString(),
                          }),
                ),
                const SizedBox(height: SydneySpacing.sm),
              ],
            ],
          ),
        if (perspectives.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          _NewsContextSection(
            title: 'Perspectives',
            lines: perspectives
                .map(
                  (item) =>
                      '${item['label'] ?? 'View'}: ${item['summary'] ?? ''}',
                )
                .toList(growable: false),
            icon: Icons.balance_rounded,
          ),
        ],
        if (whyItMatters != null && whyItMatters.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          _NewsContextSection(
            title: 'Why it matters',
            lines: [whyItMatters],
            icon: Icons.insights_rounded,
          ),
        ],
        if (timeline.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          _NewsContextSection(
            title: 'Lead-story timeline',
            lines: timeline
                .map((item) => '${item['date'] ?? ''}: ${item['event'] ?? ''}')
                .toList(growable: false),
            icon: Icons.timeline_rounded,
          ),
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

class _NewsContextSection extends StatelessWidget {
  const _NewsContextSection({
    required this.title,
    required this.lines,
    required this.icon,
  });

  final String title;
  final List<String> lines;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SydneySpacing.md),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: SydneyColors.primary),
              const SizedBox(width: SydneySpacing.xs),
              Text(
                title,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: SydneyColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.xs),
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: MarkdownText(
                text: lines.length > 1 ? '• $line' : line,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: SydneyColors.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
            ),
        ],
      ),
    );
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
  const _NewsItemCard({
    required this.item,
    required this.featured,
    this.onActivity,
    this.onFeedback,
    this.onExplore,
  });

  final Map<String, dynamic> item;
  final bool featured;
  final VoidCallback? onActivity;
  final ValueChanged<String>? onFeedback;
  final VoidCallback? onExplore;

  @override
  State<_NewsItemCard> createState() => _NewsItemCardState();
}

class _NewsItemCardState extends State<_NewsItemCard> {
  bool _isExpanded = false;
  bool _activityRecorded = false;

  @override
  Widget build(BuildContext context) {
    final headline = widget.item['headline']?.toString();
    final summary = widget.item['summary']?.toString() ?? '';
    final hasSummary = _hasVisibleText(summary);
    final category = _newsCategory(widget.item);
    final source = widget.item['source']?.toString().trim();
    final url = widget.item['url']?.toString().trim();

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

    return Container(
      key:
          widget.featured
              ? const ValueKey('news-featured-story')
              : ValueKey('news-story-$headline'),
      width: double.infinity,
      decoration: BoxDecoration(
        color:
            widget.featured
                ? SydneyColors.surfaceContainerLow
                : SydneyColors.surface,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(
          color:
              widget.featured
                  ? SydneyColors.primary.withValues(alpha: 0.28)
                  : SydneyColors.line,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () {
              setState(() => _isExpanded = !_isExpanded);
              if (_isExpanded && !_activityRecorded) {
                _activityRecorded = true;
                widget.onActivity?.call();
              }
            },
            borderRadius: BorderRadius.circular(SydneyRadius.sm),
            child: Padding(
              padding: const EdgeInsets.all(SydneySpacing.md),
              child: Row(
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
                    child: Icon(
                      widget.featured
                          ? Icons.newspaper_rounded
                          : Icons.article_outlined,
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
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(
                            color: SydneyColors.onSurface,
                            fontWeight: FontWeight.w700,
                            height: 1.3,
                          ),
                        ),
                        const SizedBox(height: SydneySpacing.xs),
                        Wrap(
                          spacing: SydneySpacing.xs,
                          runSpacing: SydneySpacing.xs,
                          children: [
                            if (widget.featured)
                              const _NewsLabel(
                                label: 'Top story',
                                prominent: true,
                              ),
                            _NewsLabel(label: category),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: SydneySpacing.xs),
                  AnimatedRotation(
                    turns: _isExpanded ? 0.5 : 0.0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      Icons.expand_more_rounded,
                      color: SydneyColors.onSurfaceVariant.withValues(
                        alpha: 0.8,
                      ),
                      size: 18,
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(
                SydneySpacing.md,
                0,
                SydneySpacing.md,
                SydneySpacing.md,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Divider(height: 1, color: SydneyColors.line),
                  const SizedBox(height: SydneySpacing.sm),
                  MarkdownText(
                    text: summary,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurfaceVariant,
                      height: 1.4,
                    ),
                  ),
                  if (source != null && source.isNotEmpty) ...[
                    const SizedBox(height: SydneySpacing.sm),
                    MarkdownText(
                      text:
                          url != null && url.isNotEmpty
                              ? 'Source: [$source]($url)'
                              : 'Source: $source',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: SydneyColors.mutedInk,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (widget.onExplore != null) ...[
                    const SizedBox(height: SydneySpacing.xs),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: widget.onExplore,
                        icon: const Icon(
                          Icons.travel_explore_rounded,
                          size: 15,
                        ),
                        label: const Text('Explore more'),
                        style: TextButton.styleFrom(
                          minimumSize: Size.zero,
                          padding: const EdgeInsets.symmetric(
                            horizontal: SydneySpacing.sm,
                            vertical: SydneySpacing.xs,
                          ),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          visualDensity: VisualDensity.compact,
                          foregroundColor: SydneyColors.primary,
                          textStyle: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                  ],
                  if (widget.onFeedback != null) ...[
                    const SizedBox(height: SydneySpacing.xs),
                    PopupMenuButton<String>(
                      tooltip: 'Story feedback',
                      onSelected: widget.onFeedback,
                      itemBuilder:
                          (context) => const [
                            PopupMenuItem(
                              value: 'more_like_this',
                              child: Text('More like this'),
                            ),
                            PopupMenuItem(
                              value: 'less_like_this',
                              child: Text('Less like this'),
                            ),
                            PopupMenuItem(
                              value: 'not_interested_topic',
                              child: Text('Not interested in this topic'),
                            ),
                            PopupMenuItem(
                              value: 'not_interested_source',
                              child: Text('Not interested in this source'),
                            ),
                          ],
                      child: const Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: SydneySpacing.sm,
                          vertical: SydneySpacing.xs,
                        ),
                        child: Text('Tune recommendations'),
                      ),
                    ),
                  ],
                ],
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

String _newsSourceKey(Object? value) {
  final text = value?.toString().trim() ?? '';
  if (text.isEmpty) return 'unknown_source';
  final uri = Uri.tryParse(text);
  final source = uri?.host.isNotEmpty == true ? uri!.host : text;
  final normalized = source
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9:_-]+'), '_')
      .replaceAll(RegExp(r'_+'), '_')
      .replaceAll(RegExp(r'^_+|_+$'), '');
  return normalized.isEmpty
      ? 'unknown_source'
      : normalized.substring(
        0,
        normalized.length > 120 ? 120 : normalized.length,
      );
}

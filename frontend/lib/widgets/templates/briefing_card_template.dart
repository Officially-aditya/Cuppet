import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import 'template_utils.dart';

class BriefingCardTemplate extends StatelessWidget {
  const BriefingCardTemplate({
    required this.data,
    this.onOpen,
    this.compact = false,
    super.key,
  });

  final Map<String, dynamic> data;
  final VoidCallback? onOpen;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final sections = templateMaps(data['sections']);
    final missing = templateStrings(data['missing_sources']);
    final eyebrow = data['eyebrow']?.toString() ?? 'BRIEFING';
    final title = data['title']?.toString() ?? 'Your briefing';
    final summary = data['summary']?.toString();
    final priorities = _briefingLines(data['priorities'], objectTitle: 'title');
    final insights = templateStrings(data['cross_source_insights']);
    final conflicts = _briefingLines(data['conflicts'], objectTitle: 'topic');

    final content =
        compact
            ? _CompactBriefing(
              eyebrow: eyebrow,
              title: title,
              summary: summary,
              sections: sections,
            )
            : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: SydneyColors.primary.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.auto_awesome_mosaic_outlined,
                        size: 16,
                        color: SydneyColors.primary,
                      ),
                    ),
                    const SizedBox(width: SydneySpacing.sm),
                    Expanded(
                      child: Text(
                        eyebrow.toUpperCase(),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: SydneyColors.primary,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SydneySpacing.md),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: SydneyColors.ink,
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                  ),
                ),
                if (summary != null && summary.trim().isNotEmpty) ...[
                  const SizedBox(height: SydneySpacing.xs),
                  Text(
                    summary,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.mutedInk,
                      height: 1.4,
                    ),
                  ),
                ],
                if (priorities.isNotEmpty) ...[
                  const SizedBox(height: SydneySpacing.md),
                  _SynthesisBlock(
                    title: 'Priorities',
                    icon: Icons.flag_outlined,
                    lines: priorities,
                  ),
                ],
                const SizedBox(height: SydneySpacing.lg),
                if (sections.isEmpty)
                  const _EmptyBriefing()
                else
                  for (var index = 0; index < sections.length; index++) ...[
                    _BriefingSection(section: sections[index]),
                    if (index != sections.length - 1)
                      const SizedBox(height: SydneySpacing.sm),
                  ],
                if (missing.isNotEmpty) ...[
                  const SizedBox(height: SydneySpacing.md),
                  Wrap(
                    spacing: SydneySpacing.xs,
                    runSpacing: SydneySpacing.xs,
                    children: [
                      for (final source in missing)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: SydneyColors.surfaceContainer,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: SydneyColors.line),
                          ),
                          child: Text(
                            '$source not connected',
                            style: Theme.of(
                              context,
                            ).textTheme.labelSmall?.copyWith(
                              color: SydneyColors.mutedInk,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
                if (insights.isNotEmpty) ...[
                  const SizedBox(height: SydneySpacing.md),
                  _SynthesisBlock(
                    title: 'Cross-source insights',
                    icon: Icons.hub_outlined,
                    lines: insights,
                  ),
                ],
                if (conflicts.isNotEmpty) ...[
                  const SizedBox(height: SydneySpacing.md),
                  _SynthesisBlock(
                    title: 'Conflicts to review',
                    icon: Icons.compare_arrows_rounded,
                    lines: conflicts,
                  ),
                ],
                if (onOpen != null) ...[
                  const SizedBox(height: SydneySpacing.md),
                  const Divider(height: 1, color: SydneyColors.line),
                  const SizedBox(height: SydneySpacing.sm),
                  Row(
                    children: [
                      const Icon(
                        Icons.forum_outlined,
                        size: 16,
                        color: SydneyColors.primary,
                      ),
                      const SizedBox(width: SydneySpacing.xs),
                      Text(
                        'Open in Assistant',
                        style: Theme.of(
                          context,
                        ).textTheme.labelMedium?.copyWith(
                          color: SydneyColors.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const Spacer(),
                      const Icon(
                        Icons.arrow_forward_rounded,
                        size: 16,
                        color: SydneyColors.primary,
                      ),
                    ],
                  ),
                ],
              ],
            );

    if (onOpen == null) return content;
    return Semantics(
      button: true,
      label: 'Open briefing in Assistant',
      child: InkWell(
        key: const ValueKey('open_briefing_in_assistant'),
        onTap: onOpen,
        borderRadius: BorderRadius.circular(12),
        child: content,
      ),
    );
  }
}

List<String> _briefingLines(Object? value, {required String objectTitle}) {
  if (value is! List) return const [];
  return value
      .map((item) {
        if (item is Map) {
          final map = Map<String, dynamic>.from(item);
          final title = map[objectTitle]?.toString().trim() ?? '';
          final detail = map['detail']?.toString().trim() ?? '';
          return [title, detail].where((part) => part.isNotEmpty).join(' — ');
        }
        return item.toString().trim();
      })
      .where((line) => line.isNotEmpty)
      .toList(growable: false);
}

class _SynthesisBlock extends StatelessWidget {
  const _SynthesisBlock({
    required this.title,
    required this.icon,
    required this.lines,
  });

  final String title;
  final IconData icon;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SydneySpacing.sm),
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
              Icon(icon, size: 15, color: SydneyColors.primary),
              const SizedBox(width: SydneySpacing.xs),
              Text(
                title,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: SydneyColors.primary,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          for (final line in lines)
            Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                '• $line',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: SydneyColors.onSurface,
                  height: 1.3,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CompactBriefing extends StatelessWidget {
  const _CompactBriefing({
    required this.eyebrow,
    required this.title,
    required this.summary,
    required this.sections,
  });

  final String eyebrow;
  final String title;
  final String? summary;
  final List<Map<String, dynamic>> sections;

  @override
  Widget build(BuildContext context) {
    final highlights = <({String source, String title, String tone})>[];
    for (final section in sections) {
      final source =
          section['source']?.toString() ??
          section['title']?.toString() ??
          'Update';
      final tone = section['tone']?.toString() ?? 'neutral';
      for (final item in templateMaps(section['items'])) {
        final itemTitle = item['title']?.toString().trim();
        if (itemTitle == null || itemTitle.isEmpty) continue;
        highlights.add((source: source, title: itemTitle, tone: tone));
        if (highlights.length == 3) break;
      }
      if (highlights.length == 3) break;
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                eyebrow.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: SydneyColors.primary,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                ),
              ),
            ),
            const Icon(
              Icons.arrow_forward_rounded,
              size: 17,
              color: SydneyColors.primary,
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.xs),
        Text(
          title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: SydneyColors.ink,
            fontWeight: FontWeight.w800,
            height: 1.2,
          ),
        ),
        if (summary != null && summary!.trim().isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            summary!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
          ),
        ],
        if (highlights.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          for (final highlight in highlights)
            _CompactHighlight(highlight: highlight),
        ],
      ],
    );
  }
}

class _CompactHighlight extends StatelessWidget {
  const _CompactHighlight({required this.highlight});

  final ({String source, String title, String tone}) highlight;

  @override
  Widget build(BuildContext context) {
    final color = switch (highlight.tone) {
      'attention' => SydneyColors.warning,
      'info' => SydneyColors.info,
      _ => SydneyColors.primary,
    };
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: SydneySpacing.xs),
          Text(
            '${highlight.source}: ',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.mutedInk,
              fontWeight: FontWeight.w700,
              fontSize: 10,
            ),
          ),
          Expanded(
            child: Text(
              highlight.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.onSurface,
                height: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BriefingSection extends StatelessWidget {
  const _BriefingSection({required this.section});

  final Map<String, dynamic> section;

  @override
  Widget build(BuildContext context) {
    final items = templateMaps(section['items']);
    final tone = section['tone']?.toString() ?? 'neutral';
    final color = switch (tone) {
      'attention' => SydneyColors.warning,
      'positive' => SydneyColors.primary,
      'info' => SydneyColors.info,
      _ => SydneyColors.primary,
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SydneySpacing.md),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 3,
            height: 34,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: SydneySpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  section['title']?.toString() ?? 'Update',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: SydneyColors.ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: SydneySpacing.xs),
                if (items.isEmpty)
                  const Text('No notable updates found.')
                else
                  for (var index = 0; index < items.length; index++) ...[
                    _BriefingItem(item: items[index]),
                    if (index != items.length - 1)
                      const SizedBox(height: SydneySpacing.sm),
                  ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BriefingItem extends StatelessWidget {
  const _BriefingItem({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final detail = item['detail']?.toString();
    final meta = item['meta']?.toString();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          item['title']?.toString() ?? 'Update',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: SydneyColors.onSurface,
            fontWeight: FontWeight.w600,
            height: 1.35,
          ),
        ),
        if (detail != null && detail.trim().isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            detail,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.mutedInk,
              height: 1.35,
            ),
          ),
        ],
        if (meta != null && meta.trim().isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            meta.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.mutedInk,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
            ),
          ),
        ],
      ],
    );
  }
}

class _EmptyBriefing extends StatelessWidget {
  const _EmptyBriefing();

  @override
  Widget build(BuildContext context) {
    return Text(
      'Connect the suggested services to build this briefing.',
      style: Theme.of(
        context,
      ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
    );
  }
}

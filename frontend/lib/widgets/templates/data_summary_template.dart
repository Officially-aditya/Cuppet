import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';
import 'gmail_digest_template.dart';
import 'github_activity_template.dart';
import 'template_utils.dart';

class DataSummaryTemplate extends StatelessWidget {
  const DataSummaryTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final timeline = templateMaps(data['timeline']);
    if (data['kind'] == 'github_activity' && timeline.isNotEmpty) {
      return GitHubActivityTemplate(data: data, timeline: timeline);
    }
    if (data['kind'] == 'gmail_digest') {
      return GmailDigestTemplate(data: data);
    }

    final title = data['title']?.toString() ?? 'Summary';
    final intro = data['text']?.toString();
    final summary =
        data['summary']?.toString() ?? data['description']?.toString();
    final metrics = templateMaps(data['metrics']);
    final items = templateMaps(data['items']);
    final blocks = _summaryBlocks(summary, title);
    final showIntro =
        intro != null &&
        intro.isNotEmpty &&
        intro.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').toLowerCase() !=
            title.replaceAll(RegExp(r'[^a-zA-Z0-9]'), '').toLowerCase();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showIntro) ...[
          MarkdownText(
            text: intro,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: SydneyColors.onSurface,
              height: 1.45,
            ),
          ),
          const SizedBox(height: SydneySpacing.md),
          const Divider(height: 1, color: SydneyColors.line),
          const SizedBox(height: SydneySpacing.md),
        ],
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.check_circle_rounded,
              color: SydneyColors.primary,
              size: 16,
            ),
            const SizedBox(width: SydneySpacing.xs),
            Text(
              'READY',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: SydneyColors.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.md),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(SydneySpacing.lg),
          decoration: BoxDecoration(
            color: SydneyColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(SydneyRadius.md),
            border: Border.all(color: SydneyColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MarkdownText(
                text: title.toUpperCase(),
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: SydneyColors.onSurface,
                  letterSpacing: 0.5,
                ),
              ),
              if (blocks.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.md),
                for (var index = 0; index < blocks.length; index++) ...[
                  _SummaryBlockView(block: blocks[index]),
                  if (index < blocks.length - 1)
                    const SizedBox(height: SydneySpacing.md),
                ],
              ],
              if (items.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.md),
                _ItemList(items: items),
              ],
              if (metrics.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.md),
                Row(
                  children: [
                    for (var index = 0; index < metrics.length; index++) ...[
                      Expanded(
                        child: _MetricPill(
                          label:
                              metrics[index]['label']?.toString() ?? 'Metric',
                          value: metrics[index]['value']?.toString() ?? '-',
                        ),
                      ),
                      if (index < metrics.length - 1)
                        const SizedBox(width: SydneySpacing.sm),
                    ],
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _SummaryBlock {
  const _SummaryBlock({this.title, required this.lines});

  final String? title;
  final List<String> lines;
}

class _SummaryBlockView extends StatelessWidget {
  const _SummaryBlockView({required this.block});

  final _SummaryBlock block;

  @override
  Widget build(BuildContext context) {
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
          if (block.title != null && block.title!.isNotEmpty) ...[
            MarkdownText(
              text: block.title!,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: SydneyColors.primary,
                fontWeight: FontWeight.w800,
                letterSpacing: 0,
              ),
            ),
            if (block.lines.isNotEmpty)
              const SizedBox(height: SydneySpacing.sm),
          ],
          for (final line in block.lines)
            Padding(
              padding: const EdgeInsets.only(bottom: SydneySpacing.xs),
              child: _SummaryLine(text: line),
            ),
        ],
      ),
    );
  }
}

class _SummaryLine extends StatelessWidget {
  const _SummaryLine({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 5,
          height: 5,
          margin: const EdgeInsets.only(top: 8),
          decoration: const BoxDecoration(
            color: SydneyColors.primary,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: SydneySpacing.sm),
        Expanded(
          child: MarkdownText(
            text: text,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurface,
              height: 1.35,
            ),
          ),
        ),
      ],
    );
  }
}

class _ItemList extends StatelessWidget {
  const _ItemList({required this.items});

  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
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
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: SydneySpacing.sm),
              child: _ItemRow(item: item),
            ),
        ],
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final label =
        item['label']?.toString() ??
        item['title']?.toString() ??
        item['subject']?.toString() ??
        'Item';
    final preview =
        item['preview']?.toString() ??
        item['summary']?.toString() ??
        item['description']?.toString();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(
          Icons.check_circle_outline_rounded,
          size: 16,
          color: SydneyColors.primary,
        ),
        const SizedBox(width: SydneySpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MarkdownText(
                text: _cleanInline(label),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: SydneyColors.onSurface,
                  fontWeight: FontWeight.w700,
                  height: 1.3,
                ),
              ),
              if (preview != null && preview.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.xs),
                MarkdownText(
                  text: _cleanInline(preview),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.onSurfaceVariant,
                    height: 1.3,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.xs,
        vertical: SydneySpacing.sm,
      ),
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              fontSize: 8,
              height: 1.05,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: SydneySpacing.xs),
          Text(
            value,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: SydneyColors.onSurface,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

List<_SummaryBlock> _summaryBlocks(String? value, String title) {
  if (value == null || value.trim().isEmpty) {
    return const [];
  }

  final titleKey = _comparisonKey(title);
  final blocks = <_SummaryBlock>[];
  String? currentTitle;
  final currentLines = <String>[];

  void flush() {
    if (currentTitle == null && currentLines.isEmpty) {
      return;
    }
    blocks.add(_SummaryBlock(title: currentTitle, lines: [...currentLines]));
    currentTitle = null;
    currentLines.clear();
  }

  for (final rawLine in value.split('\n')) {
    final line = _cleanInline(rawLine);
    if (line.isEmpty || _comparisonKey(line) == titleKey) {
      continue;
    }

    if (_isSectionHeading(rawLine, line)) {
      flush();
      currentTitle = line.replaceFirst(RegExp(r':$'), '');
      continue;
    }

    currentLines.add(line);
  }

  flush();
  return blocks;
}

bool _isSectionHeading(String rawLine, String line) {
  final raw = rawLine.trim();
  if (line.length > 72) return false;
  if (raw.startsWith('#')) return true;
  if (line.endsWith(':')) return true;
  if (RegExp(r'^[A-Z][A-Z0-9\s/&-]{3,}$').hasMatch(line)) return true;
  if (RegExp(r'^[•*-]\s*\*\*.+\*\*$').hasMatch(raw)) return true;
  return RegExp(r'^\*\*.+\*\*$').hasMatch(raw);
}

String _cleanInline(String value) {
  return value
      .trim()
      .replaceFirst(RegExp(r'^#{1,6}\s*'), '')
      .replaceFirst(RegExp(r'^[•*\-](?!\*)\s*'), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

String _comparisonKey(String value) {
  return value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '').trim();
}

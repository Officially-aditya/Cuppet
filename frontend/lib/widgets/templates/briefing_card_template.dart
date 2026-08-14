import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/connector.dart';
import '../connectors/connector_list_item.dart';
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
    final title = cleanDisplayTitle(data['title'], fallback: 'Your briefing');
    final summary = data['summary']?.toString();
    final priorities = _briefingLines(data['priorities'], objectTitle: 'title');
    final insights = templateStrings(data['cross_source_insights']);
    final conflicts = _briefingLines(data['conflicts'], objectTitle: 'topic');
    final compactUpdates =
        compact
            ? _compactBriefingUpdates(sections)
            : const <_CompactBriefingUpdate>[];

    final content =
        compact
            ? _CompactBriefing(
              eyebrow: eyebrow,
              title: title,
              updates: compactUpdates,
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
          final title = cleanDisplayTitle(map[objectTitle]);
          final detail = map['detail']?.toString().trim() ?? '';
          return [title, detail].where((part) => part.isNotEmpty).join(' - ');
        }
        return item.toString().trim();
      })
      .where((line) => line.isNotEmpty)
      .toList(growable: false);
}

List<_CompactBriefingUpdate> _compactBriefingUpdates(
  List<Map<String, dynamic>> sections,
) {
  final updates = <_CompactBriefingUpdate>[];

  for (final section in sections) {
    final source = cleanDisplayTitle(
      section['source'] ?? section['title'],
      fallback: 'Update',
    );
    final items = templateMaps(section['items']);
    Map<String, dynamic>? selectedItem;

    for (final item in items) {
      final itemTitle = cleanDisplayTitle(item['title']);
      if (itemTitle.isNotEmpty && !_isEmptyCompactUpdate(itemTitle)) {
        selectedItem = item;
        break;
      }
    }

    if (selectedItem == null) continue;

    final title = cleanDisplayTitle(selectedItem['title'], fallback: 'Update');
    updates.add(
      _CompactBriefingUpdate(
        source: source,
        connectorId: _compactConnectorId(section['id']?.toString() ?? source),
        title: _compactBriefingText(title, maxCharacters: 96),
        context: _compactBriefingContext(selectedItem),
      ),
    );

    if (updates.length == 3) break;
  }

  return updates;
}

String? _compactBriefingContext(Map<String, dynamic> item) {
  final detail = cleanDisplayTitle(item['detail']).trim();
  final meta = cleanDisplayTitle(item['meta']).trim();
  final context = [detail, meta].where((value) => value.isNotEmpty).join(' · ');
  if (context.isEmpty) return null;
  return _compactBriefingText(context, maxCharacters: 72);
}

String _compactBriefingMessage(List<_CompactBriefingUpdate> updates) {
  if (updates.isEmpty) return 'No new updates from connected sources.';

  final messages =
      updates.map((update) {
        final context = update.context;
        final suffix = context == null ? '' : ' ($context)';
        return '${update.source}: ${update.title}$suffix';
      }).toList();
  return _compactBriefingText(messages.join(' · '), maxCharacters: 180);
}

String _compactBriefingText(String value, {required int maxCharacters}) {
  final normalized = value.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (normalized.length <= maxCharacters) return normalized;
  return '${normalized.substring(0, maxCharacters - 1).trimRight()}…';
}

bool _isEmptyCompactUpdate(String title) {
  final normalized =
      title.toLowerCase().replaceAll(RegExp(r'[.!?]+$'), '').trim();
  return normalized == 'no notable updates found' ||
      normalized == 'no updates found' ||
      normalized == 'no relevant updates found';
}

String _compactConnectorId(String value) {
  final normalized = value.trim().toLowerCase().replaceAll(
    RegExp(r'[^a-z0-9]+'),
    '_',
  );

  if (normalized.contains('gmail') || normalized == 'email') return 'gmail';
  if (normalized.contains('slack')) return 'slack';
  if (normalized.contains('calendar')) return 'calendar';
  if (normalized.contains('drive') || normalized == 'meeting_notes') {
    return 'drive';
  }
  if (normalized.contains('github')) return 'github';
  if (normalized.contains('notion')) return 'notion';
  if (normalized.contains('docs')) return 'gdocs';
  if (normalized.contains('outlook')) return 'outlook';
  return normalized;
}

String? _compactConnectorIconName(String connectorId) {
  return switch (connectorId) {
    'gmail' || 'outlook' => 'Mail',
    'slack' => 'MessageSquare',
    'calendar' => 'Calendar',
    'drive' => 'HardDrive',
    'github' => 'Github',
    'notion' => 'BookOpen',
    'gdocs' => 'FileText',
    'jira' => 'Layers',
    'asana' => 'CheckSquare',
    'dropbox' => 'FolderOpen',
    _ => null,
  };
}

class _CompactBriefingUpdate {
  const _CompactBriefingUpdate({
    required this.source,
    required this.connectorId,
    required this.title,
    this.context,
  });

  final String source;
  final String connectorId;
  final String title;
  final String? context;
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
    required this.updates,
  });

  final String eyebrow;
  final String title;
  final List<_CompactBriefingUpdate> updates;

  @override
  Widget build(BuildContext context) {
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
          _compactBriefingText(title, maxCharacters: 72),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: SydneyColors.ink,
            fontWeight: FontWeight.w800,
            fontSize: 13,
            height: 1.2,
          ),
        ),
        const SizedBox(height: SydneySpacing.xs),
        Text(
          _compactBriefingMessage(updates),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: SydneyColors.mutedInk,
            fontSize: 10.5,
            height: 1.25,
          ),
        ),
        if (updates.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          Row(
            children: [
              for (var index = 0; index < updates.length; index++) ...[
                Semantics(
                  label: '${updates[index].source} has an update',
                  child: ConnectorIcon(
                    connector: _compactConnector(updates[index]),
                    size: 22,
                  ),
                ),
                if (index != updates.length - 1)
                  const SizedBox(width: SydneySpacing.sm),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

Connector _compactConnector(_CompactBriefingUpdate update) {
  return Connector(
    id: update.connectorId,
    name: update.source,
    description: '',
    status: ConnectorStatus.connected,
    iconName: _compactConnectorIconName(update.connectorId),
  );
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
                  cleanDisplayTitle(section['title'], fallback: 'Update'),
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
          cleanDisplayTitle(item['title'], fallback: 'Update'),
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

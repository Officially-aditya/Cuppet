import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';
import 'digest_report_primitives.dart';
import 'template_utils.dart';

class GitHubActivityTemplate extends StatelessWidget {
  const GitHubActivityTemplate({
    required this.data,
    required this.timeline,
    super.key,
  });

  final Map<String, dynamic> data;
  final List<Map<String, dynamic>> timeline;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'GitHub activity';
    final intro = data['text']?.toString();
    final footer = data['footer']?.toString();
    final metrics = templateMaps(data['metrics']);
    final groups = groupGitHubTimeline(timeline);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_hasContent(intro)) ...[
          MarkdownText(
            text: intro!,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: SydneyColors.onSurface,
              height: 1.4,
            ),
          ),
          const SizedBox(height: SydneySpacing.md),
        ],
        Row(
          children: [
            const Icon(
              Icons.check_circle_rounded,
              color: SydneyColors.primary,
              size: 17,
            ),
            const SizedBox(width: SydneySpacing.xs),
            Text(
              'GITHUB ACTIVITY DIGEST',
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
          padding: const EdgeInsets.all(SydneySpacing.md),
          decoration: BoxDecoration(
            color: SydneyColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(SydneyRadius.md),
            border: Border.all(color: SydneyColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title.toUpperCase(),
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: SydneyColors.onSurface,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.account_tree_outlined,
                    color: SydneyColors.primary,
                    size: 22,
                  ),
                ],
              ),
              if (metrics.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.md),
                DigestMetricStrip(metrics: metrics),
              ],
              const SizedBox(height: SydneySpacing.md),
              const Divider(height: 1, color: SydneyColors.line),
              const SizedBox(height: SydneySpacing.md),
              for (var index = 0; index < groups.length; index++)
                if (groups[index].updates.length == 1)
                  _GitHubTimelineItem(
                    item: groups[index].updates.single,
                    isLast: index == groups.length - 1,
                  )
                else
                  _GitHubRepositoryGroup(
                    group: groups[index],
                    isLast: index == groups.length - 1,
                  ),
              if (_hasContent(footer)) ...[
                const SizedBox(height: SydneySpacing.sm),
                const Divider(height: 1, color: SydneyColors.line),
                const SizedBox(height: SydneySpacing.sm),
                Text(
                  footer!,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: SydneyColors.mutedInk,
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

class GitHubTimelineGroup {
  const GitHubTimelineGroup({required this.repository, required this.updates});

  final String? repository;
  final List<Map<String, dynamic>> updates;
}

List<GitHubTimelineGroup> groupGitHubTimeline(
  List<Map<String, dynamic>> timeline,
) {
  final groups = <GitHubTimelineGroup>[];
  final positions = <String, int>{};

  for (var index = 0; index < timeline.length; index++) {
    final item = timeline[index];
    final repository = item['repository']?.toString().trim();
    final key =
        _hasContent(repository)
            ? 'repository:${repository!.toLowerCase()}'
            : 'item:$index';
    final position = positions[key];

    if (position == null) {
      positions[key] = groups.length;
      groups.add(
        GitHubTimelineGroup(
          repository: _hasContent(repository) ? repository : null,
          updates: [item],
        ),
      );
      continue;
    }

    final existing = groups[position];
    groups[position] = GitHubTimelineGroup(
      repository: existing.repository,
      updates: [...existing.updates, item],
    );
  }

  return groups;
}

class _GitHubTimelineItem extends StatelessWidget {
  const _GitHubTimelineItem({required this.item, required this.isLast});

  final Map<String, dynamic> item;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final title = item['title']?.toString() ?? 'GitHub update';
    final repository = item['repository']?.toString();
    final timestamp = _githubTimestamp(item['timestamp']);
    final type = _githubActivityType(item['type']);
    final url = item['url']?.toString();

    return InkWell(
      onTap: !_hasContent(url) ? null : () => _openExternalUrl(url!),
      borderRadius: BorderRadius.circular(SydneyRadius.sm),
      child: _GitHubTimelineRail(
        isLast: isLast,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: SydneySpacing.xs,
              runSpacing: SydneySpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _githubTypeBadge(context, type),
                if (_hasContent(timestamp))
                  Text(
                    timestamp!,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: SydneyColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                if (_hasContent(repository))
                  _githubRepositoryChip(context, repository!),
              ],
            ),
            const SizedBox(height: SydneySpacing.xs),
            _githubUpdateTitle(context, title, hasUrl: _hasContent(url)),
          ],
        ),
      ),
    );
  }
}

class _GitHubRepositoryGroup extends StatelessWidget {
  const _GitHubRepositoryGroup({required this.group, required this.isLast});

  final GitHubTimelineGroup group;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final repository = group.repository;
    return _GitHubTimelineRail(
      isLast: isLast,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: SydneySpacing.xs,
            runSpacing: SydneySpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _githubTypeBadge(context, _githubActivityType('repository')),
              if (_hasContent(repository))
                _githubRepositoryChip(context, repository!),
              Text(
                '${group.updates.length} updates',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: SydneyColors.mutedInk,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.xs),
          for (var index = 0; index < group.updates.length; index++)
            _GitHubNestedUpdate(
              item: group.updates[index],
              isLast: index == group.updates.length - 1,
            ),
        ],
      ),
    );
  }
}

class _GitHubNestedUpdate extends StatelessWidget {
  const _GitHubNestedUpdate({required this.item, required this.isLast});

  final Map<String, dynamic> item;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final title = item['title']?.toString() ?? 'GitHub update';
    final timestamp = _githubTimestamp(item['timestamp']);
    final type = _githubActivityType(item['type']);
    final url = item['url']?.toString();

    return InkWell(
      onTap: !_hasContent(url) ? null : () => _openExternalUrl(url!),
      borderRadius: BorderRadius.circular(SydneyRadius.sm),
      child: Padding(
        padding: EdgeInsets.only(
          left: SydneySpacing.xs,
          bottom: isLast ? 0 : SydneySpacing.xs,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(type.icon, color: SydneyColors.primary, size: 13),
            const SizedBox(width: SydneySpacing.xs),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurface,
                      fontWeight: FontWeight.w700,
                      height: 1.3,
                    ),
                  ),
                  Wrap(
                    spacing: SydneySpacing.xs,
                    children: [
                      Text(
                        type.label,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: SydneyColors.primary,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (_hasContent(timestamp))
                        Text(
                          timestamp!,
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(color: SydneyColors.mutedInk),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            if (_hasContent(url))
              const Padding(
                padding: EdgeInsets.only(left: SydneySpacing.xs),
                child: Icon(
                  Icons.open_in_new_rounded,
                  color: SydneyColors.mutedInk,
                  size: 14,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _GitHubTimelineRail extends StatelessWidget {
  const _GitHubTimelineRail({required this.isLast, required this.child});

  final bool isLast;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: SydneySpacing.sm),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: 22,
              child: Column(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: const BoxDecoration(
                      color: SydneyColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  if (!isLast)
                    Expanded(
                      child: Container(
                        width: 2,
                        color: SydneyColors.primarySoft,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: SydneySpacing.sm),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: SydneySpacing.sm),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Widget _githubTypeBadge(
  BuildContext context,
  ({String label, IconData icon}) type,
) {
  return Container(
    padding: const EdgeInsets.symmetric(
      horizontal: SydneySpacing.xs,
      vertical: SydneySpacing.xxs,
    ),
    decoration: BoxDecoration(
      color: SydneyColors.primarySoft,
      borderRadius: BorderRadius.circular(SydneyRadius.full),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(type.icon, color: SydneyColors.primary, size: 11),
        const SizedBox(width: SydneySpacing.xxs),
        Text(
          type.label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: SydneyColors.primary,
            fontSize: 9,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.25,
          ),
        ),
      ],
    ),
  );
}

Widget _githubRepositoryChip(BuildContext context, String repository) {
  return Container(
    padding: const EdgeInsets.symmetric(
      horizontal: SydneySpacing.xs,
      vertical: SydneySpacing.xxs,
    ),
    decoration: BoxDecoration(
      color: SydneyColors.surfaceContainerHigh,
      borderRadius: BorderRadius.circular(SydneyRadius.full),
    ),
    child: Text(
      repository,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
        color: SydneyColors.onSurfaceVariant,
        fontSize: 9,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}

Widget _githubUpdateTitle(
  BuildContext context,
  String title, {
  required bool hasUrl,
}) {
  return Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: Text(
          title,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: SydneyColors.onSurface,
            fontWeight: FontWeight.w700,
            height: 1.3,
          ),
        ),
      ),
      if (hasUrl)
        const Padding(
          padding: EdgeInsets.only(left: SydneySpacing.xs),
          child: Icon(
            Icons.open_in_new_rounded,
            color: SydneyColors.mutedInk,
            size: 14,
          ),
        ),
    ],
  );
}

bool _hasContent(String? value) => value != null && value.trim().isNotEmpty;

String? _githubTimestamp(Object? raw) {
  final value = raw?.toString();
  if (!_hasContent(value)) return null;
  final parsed = DateTime.tryParse(value!);
  if (parsed == null) return value;
  final local = parsed.toLocal();
  final now = DateTime.now();
  final hour =
      local.hour == 0 ? 12 : (local.hour > 12 ? local.hour - 12 : local.hour);
  final minute = local.minute.toString().padLeft(2, '0');
  final period = local.hour >= 12 ? 'PM' : 'AM';
  final time = '$hour:$minute $period';
  final localDay = DateTime(local.year, local.month, local.day);
  final today = DateTime(now.year, now.month, now.day);
  final dayDifference = today.difference(localDay).inDays;
  if (dayDifference == 0) return 'Today • $time';
  if (dayDifference == 1) return 'Yesterday • $time';

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${months[local.month - 1]} ${local.day} • $time';
}

({String label, IconData icon}) _githubActivityType(Object? raw) {
  return switch (raw?.toString().trim().toLowerCase()) {
    'commit' => (label: 'COMMIT', icon: Icons.commit_rounded),
    'repository' => (label: 'REPOSITORY', icon: Icons.folder_outlined),
    'issue' => (label: 'ISSUE', icon: Icons.error_outline_rounded),
    'pull_request' ||
    'pull-request' => (label: 'PULL REQUEST', icon: Icons.call_merge_rounded),
    _ => (label: 'UPDATE', icon: Icons.bolt_outlined),
  };
}

Future<void> _openExternalUrl(String value) async {
  final uri = Uri.tryParse(value);
  if (uri != null && await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

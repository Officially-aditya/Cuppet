import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import 'template_utils.dart';

class ContentExtractorTemplate extends StatelessWidget {
  const ContentExtractorTemplate({
    required this.data,
    this.onAction,
    super.key,
  });

  final Map<String, dynamic> data;
  final ValueChanged<Map<String, dynamic>>? onAction;

  @override
  Widget build(BuildContext context) {
    final ideas = templateMaps(data['ideas']);

    if (ideas.isEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.post_add_rounded,
                color: SydneyColors.primary,
                size: 20,
              ),
              const SizedBox(width: SydneySpacing.sm),
              Text(
                'Content Extractor',
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.md),
          Text(
            data['text']?.toString() ??
                'No trending topics found yet. Please trigger a run or type to search.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              height: 1.4,
              color: SydneyColors.onSurface,
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(
              Icons.trending_up_rounded,
              color: SydneyColors.primary,
              size: 20,
            ),
            const SizedBox(width: SydneySpacing.sm),
            Expanded(
              child: Text(
                'Trending Content Ideas',
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.xs),
        Text(
          'Select an idea below to generate a formatted draft post.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
        ),
        const SizedBox(height: SydneySpacing.md),
        Column(
          children: [
            for (int i = 0; i < ideas.length; i++) ...[
              _IdeaCard(
                index: i + 1,
                title: ideas[i]['title']?.toString() ?? 'Content Idea',
                hook: ideas[i]['hook']?.toString() ?? 'No description hook.',
                angle: ideas[i]['angle']?.toString(),
                audienceValue: ideas[i]['audience_value']?.toString(),
                evidenceSummary: ideas[i]['evidence_summary']?.toString(),
                onTap: () {
                  if (onAction != null) {
                    onAction!({
                      'type': 'generate_draft',
                      'title': ideas[i]['title']?.toString() ?? '',
                    });
                  }
                },
              ),
              if (i < ideas.length - 1)
                const SizedBox(height: SydneySpacing.sm),
            ],
          ],
        ),
      ],
    );
  }
}

class _IdeaCard extends StatelessWidget {
  const _IdeaCard({
    required this.index,
    required this.title,
    required this.hook,
    this.angle,
    this.audienceValue,
    this.evidenceSummary,
    required this.onTap,
  });

  final int index;
  final String title;
  final String hook;
  final String? angle;
  final String? audienceValue;
  final String? evidenceSummary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF17201C).withValues(alpha: 0.05),
            offset: const Offset(4, 4),
            blurRadius: 8,
          ),
          const BoxShadow(
            color: Colors.white,
            offset: Offset(-4, -4),
            blurRadius: 8,
          ),
        ],
        border: Border.all(
          color: SydneyColors.line.withValues(alpha: 0.35),
          width: 0.8,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(SydneySpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      decoration: const BoxDecoration(
                        color: SydneyColors.primarySoft,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '$index',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: SydneyColors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: SydneySpacing.sm),
                    Expanded(
                      child: Text(
                        title,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: SydneyColors.ink,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SydneySpacing.xs),
                Padding(
                  padding: const EdgeInsets.only(left: 30),
                  child: Text(
                    hook,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurfaceVariant,
                      height: 1.35,
                    ),
                  ),
                ),
                if (angle != null && angle!.trim().isNotEmpty)
                  _IdeaDetail(label: 'Angle', value: angle!),
                if (audienceValue != null && audienceValue!.trim().isNotEmpty)
                  _IdeaDetail(label: 'Audience value', value: audienceValue!),
                if (evidenceSummary != null &&
                    evidenceSummary!.trim().isNotEmpty)
                  _IdeaDetail(label: 'Evidence', value: evidenceSummary!),
                const SizedBox(height: SydneySpacing.md),
                Padding(
                  padding: const EdgeInsets.only(left: 30),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.edit_note_rounded,
                        size: 16,
                        color: SydneyColors.primary,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Generate Post Draft',
                          style: Theme.of(
                            context,
                          ).textTheme.labelMedium?.copyWith(
                            color: SydneyColors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        size: 16,
                        color: SydneyColors.primary,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _IdeaDetail extends StatelessWidget {
  const _IdeaDetail({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 30, top: SydneySpacing.xs),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            TextSpan(text: value),
          ],
        ),
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: SydneyColors.mutedInk,
          height: 1.3,
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';
import 'template_utils.dart';

class DsaQuestionTemplate extends StatefulWidget {
  const DsaQuestionTemplate({required this.data, this.onAction, super.key});

  final Map<String, dynamic> data;
  final ValueChanged<Map<String, dynamic>>? onAction;

  @override
  State<DsaQuestionTemplate> createState() => _DsaQuestionTemplateState();
}

class _DsaQuestionTemplateState extends State<DsaQuestionTemplate> {
  bool _showHint = false;

  @override
  Widget build(BuildContext context) {
    final title = widget.data['title']?.toString() ?? 'DSA Question';
    final completed = widget.data['completed'] == true;
    final actionTaken = widget.data['action_taken']?.toString();
    final showActions = !completed && actionTaken == null;
    final difficulty = widget.data['difficulty']?.toString() ?? 'Medium';
    final problem = widget.data['problem']?.toString() ?? '';
    final inputFormat = widget.data['input_format']?.toString();
    final outputFormat = widget.data['output_format']?.toString();
    final constraints = widget.data['constraints']?.toString();
    final complexity = widget.data['complexity']?.toString();
    final timeComplexity = widget.data['time_complexity']?.toString();
    final spaceComplexity = widget.data['space_complexity']?.toString();
    final approach = widget.data['approach']?.toString();
    final examples = templateMaps(widget.data['examples']);
    final hint = widget.data['hint']?.toString();
    final references = templateMaps(widget.data['references']);
    final sourceLabel = _sourceLabel(widget.data, references);
    final actions = templateMaps(widget.data['actions']);

    Color diffColor;
    Color diffBg;
    switch (difficulty.toLowerCase()) {
      case 'easy':
        diffColor = SydneyColors.primary;
        diffBg = SydneyColors.primarySoft;
        break;
      case 'hard':
        diffColor = SydneyColors.danger;
        diffBg = SydneyColors.dangerSoft;
        break;
      case 'medium':
      default:
        diffColor = SydneyColors.warning;
        diffBg = SydneyColors.warningSoft;
        break;
    }

    final diffBadge = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.sm,
        vertical: SydneySpacing.xs,
      ),
      decoration: BoxDecoration(
        color: diffBg,
        borderRadius: BorderRadius.circular(SydneyRadius.full),
        border: Border.all(color: diffColor.withValues(alpha: 0.2)),
      ),
      child: Text(
        difficulty.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: diffColor,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.5,
        ),
      ),
    );

    return Column(
      key: const ValueKey('dsa-question-content'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            diffBadge,
            const SizedBox(width: SydneySpacing.sm),
            const Icon(
              Icons.code_rounded,
              color: SydneyColors.primary,
              size: 20,
            ),
            const SizedBox(width: SydneySpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: SydneyColors.onSurface,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                  if (_hasText(sourceLabel)) ...[
                    const SizedBox(height: SydneySpacing.xxs),
                    Text(
                      sourceLabel!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: SydneyColors.mutedInk,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (completed) ...[
              const SizedBox(width: SydneySpacing.xs),
              const Icon(
                Icons.check_circle_rounded,
                color: SydneyColors.primary,
                size: 18,
              ),
            ],
          ],
        ),
        const SizedBox(height: SydneySpacing.xl),
        const _SectionHeading(
          icon: Icons.description_outlined,
          label: 'Problem Description',
        ),
        const SizedBox(height: SydneySpacing.sm),
        MarkdownText(
          text: problem,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            height: 1.4,
            color: SydneyColors.onSurface,
          ),
        ),
        if (inputFormat != null && inputFormat.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          _FormatLine(label: 'Input format', value: inputFormat),
        ],
        if (outputFormat != null && outputFormat.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          _FormatLine(label: 'Output format', value: outputFormat),
        ],
        if (examples.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.lg),
          const _SectionHeading(
            icon: Icons.terminal_rounded,
            label: 'Structured Examples',
          ),
          const SizedBox(height: SydneySpacing.sm),
          for (var i = 0; i < examples.length; i++) ...[
            _DsaExampleBlock(index: i, example: examples[i]),
          ],
        ],
        if (constraints != null && constraints.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          const _SectionHeading(icon: Icons.tune_rounded, label: 'Constraints'),
          const SizedBox(height: SydneySpacing.sm),
          _DetailPanel(text: constraints),
        ],
        if (_hasText(complexity) ||
            _hasText(timeComplexity) ||
            _hasText(spaceComplexity) ||
            _hasText(approach)) ...[
          const SizedBox(height: SydneySpacing.md),
          const _SectionHeading(
            icon: Icons.query_stats_rounded,
            label: 'Complexity',
          ),
          const SizedBox(height: SydneySpacing.sm),
          _ComplexityPanel(
            complexity: complexity,
            time: timeComplexity,
            space: spaceComplexity,
            approach: approach,
          ),
        ],
        if (hint != null && hint.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          InkWell(
            onTap: () {
              setState(() {
                _showHint = !_showHint;
              });
            },
            borderRadius: BorderRadius.circular(SydneyRadius.sm),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(SydneySpacing.sm),
              decoration: BoxDecoration(
                color: SydneyColors.warningSoft.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(SydneyRadius.sm),
                border: Border.all(
                  color: SydneyColors.warning.withValues(alpha: 0.3),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.lightbulb_outline_rounded,
                        color: SydneyColors.warning,
                        size: 16,
                      ),
                      const SizedBox(width: SydneySpacing.xs),
                      Expanded(
                        child: Text(
                          _showHint ? 'Hint (Click to hide)' : 'Reveal Hint',
                          style: Theme.of(
                            context,
                          ).textTheme.labelMedium?.copyWith(
                            color: SydneyColors.warning,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Icon(
                        _showHint
                            ? Icons.keyboard_arrow_up_rounded
                            : Icons.keyboard_arrow_down_rounded,
                        color: SydneyColors.warning,
                        size: 16,
                      ),
                    ],
                  ),
                  if (_showHint) ...[
                    const SizedBox(height: SydneySpacing.xs),
                    const Divider(height: 1, color: SydneyColors.line),
                    const SizedBox(height: SydneySpacing.xs),
                    MarkdownText(
                      text: hint,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: SydneyColors.onSurfaceVariant,
                        height: 1.35,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
        if (references.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          const _SectionHeading(
            icon: Icons.menu_book_outlined,
            label: 'References & Discuss',
          ),
          const SizedBox(height: SydneySpacing.xs),
          Column(
            children: [
              for (final ref in references)
                _ReferenceItem(
                  title: ref['title']?.toString() ?? 'Learning Resource',
                  url: ref['url']?.toString() ?? '',
                ),
            ],
          ),
        ],
        if (showActions && actions.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          const Divider(height: 1, color: SydneyColors.line),
          const SizedBox(height: SydneySpacing.md),
          Wrap(
            spacing: SydneySpacing.sm,
            runSpacing: SydneySpacing.sm,
            children: [
              for (final action in actions)
                _ActionPill(
                  label: action['label']?.toString() ?? 'Action',
                  styleName: action['style']?.toString() ?? 'secondary',
                  onPressed:
                      widget.onAction == null
                          ? null
                          : () => widget.onAction!(action),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

bool _hasText(String? value) => value != null && value.trim().isNotEmpty;

String? _sourceLabel(
  Map<String, dynamic> data,
  List<Map<String, dynamic>> references,
) {
  final explicit = data['source_label']?.toString().trim();
  if (_hasText(explicit)) return explicit;
  if (references.isEmpty) return null;

  final referenceTitle = references.first['title']?.toString().trim() ?? '';
  final separator = referenceTitle.indexOf(':');
  if (separator > 0) return referenceTitle.substring(0, separator).trim();

  final uri = Uri.tryParse(references.first['url']?.toString() ?? '');
  final host = uri?.host.replaceFirst(RegExp(r'^www\.'), '') ?? '';
  if (host.contains('leetcode.com')) return 'LeetCode';
  if (host.contains('hackerrank.com')) return 'HackerRank';
  if (host.contains('codeforces.com')) return 'Codeforces';
  return null;
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: SydneyColors.primary, size: 19),
        const SizedBox(width: SydneySpacing.sm),
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: SydneyColors.onSurface,
              fontWeight: FontWeight.w800,
              letterSpacing: 0,
            ),
          ),
        ),
      ],
    );
  }
}

class _DsaExampleBlock extends StatelessWidget {
  const _DsaExampleBlock({required this.index, required this.example});

  final int index;
  final Map<String, dynamic> example;

  @override
  Widget build(BuildContext context) {
    final explanation = example['explanation']?.toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: SydneySpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Example ${index + 1}:',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: SydneyColors.onSurface,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: SydneySpacing.sm),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  key: ValueKey('dsa-example-rule-$index'),
                  width: 3,
                  color: SydneyColors.primary,
                ),
                const SizedBox(width: SydneySpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _ExampleLine(
                        label: 'Input',
                        value: example['input']?.toString() ?? '',
                      ),
                      const SizedBox(height: SydneySpacing.xs),
                      _ExampleLine(
                        label: 'Output',
                        value: example['output']?.toString() ?? '',
                      ),
                      if (_hasText(explanation)) ...[
                        const SizedBox(height: SydneySpacing.xs),
                        _ExampleLine(label: 'Explanation', value: explanation!),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ExampleLine extends StatelessWidget {
  const _ExampleLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 88,
          child: Text(
            '$label:',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurface,
              fontFamily: 'Courier',
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              fontFamily: 'Courier',
              height: 1.35,
            ),
          ),
        ),
      ],
    );
  }
}

class _FormatLine extends StatelessWidget {
  const _FormatLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: SydneyColors.onSurfaceVariant,
          height: 1.35,
        ),
        children: [
          TextSpan(
            text: '$label: ',
            style: const TextStyle(
              color: SydneyColors.onSurface,
              fontWeight: FontWeight.w800,
            ),
          ),
          TextSpan(text: value),
        ],
      ),
    );
  }
}

class _DetailPanel extends StatelessWidget {
  const _DetailPanel({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('dsa-constraints-panel'),
      width: double.infinity,
      padding: const EdgeInsets.all(SydneySpacing.sm),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerHigh,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
      ),
      child: MarkdownText(
        text: text,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: SydneyColors.onSurfaceVariant,
          height: 1.4,
        ),
      ),
    );
  }
}

class _ComplexityPanel extends StatelessWidget {
  const _ComplexityPanel({
    required this.complexity,
    required this.time,
    required this.space,
    required this.approach,
  });

  final String? complexity;
  final String? time;
  final String? space;
  final String? approach;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String)>[
      if (_hasText(time)) ('Time complexity', time!.trim()),
      if (_hasText(space)) ('Space complexity', space!.trim()),
    ];
    final hasPanelContent = _hasText(complexity) || rows.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (hasPanelContent)
          Container(
            key: const ValueKey('dsa-complexity-panel'),
            width: double.infinity,
            padding: const EdgeInsets.all(SydneySpacing.sm),
            decoration: BoxDecoration(
              color: SydneyColors.surfaceContainerHigh,
              borderRadius: BorderRadius.circular(SydneyRadius.sm),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_hasText(complexity))
                  Padding(
                    padding: EdgeInsets.only(
                      bottom: rows.isEmpty ? 0 : SydneySpacing.xs,
                    ),
                    child: MarkdownText(
                      text: complexity!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: SydneyColors.onSurface,
                        height: 1.35,
                      ),
                    ),
                  ),
                for (var index = 0; index < rows.length; index++) ...[
                  Text.rich(
                    TextSpan(
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: SydneyColors.onSurface,
                        height: 1.3,
                      ),
                      children: [
                        TextSpan(
                          text: '${rows[index].$1}: ',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        TextSpan(text: rows[index].$2),
                      ],
                    ),
                  ),
                  if (index < rows.length - 1)
                    const SizedBox(height: SydneySpacing.xxs),
                ],
              ],
            ),
          ),
        if (_hasText(approach)) ...[
          if (hasPanelContent) const SizedBox(height: SydneySpacing.xs),
          Text(
            approach!.trim(),
            key: const ValueKey('dsa-approach'),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              height: 1.35,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
  }
}

class _ReferenceItem extends StatelessWidget {
  const _ReferenceItem({required this.title, required this.url});

  final String title;
  final String url;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: SydneySpacing.xs),
      child: InkWell(
        onTap: () async {
          final uri = Uri.tryParse(url);
          if (uri != null && await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        },
        borderRadius: BorderRadius.circular(SydneyRadius.xs),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              const Icon(
                Icons.link_rounded,
                color: SydneyColors.primary,
                size: 14,
              ),
              const SizedBox(width: SydneySpacing.xs),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.primary,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActionPill extends StatelessWidget {
  const _ActionPill({
    required this.label,
    required this.styleName,
    required this.onPressed,
  });

  final String label;
  final String styleName;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final primary = styleName == 'primary';
    final ghost = styleName == 'ghost';

    final foreground =
        primary
            ? SydneyColors.onPrimary
            : ghost
            ? SydneyColors.mutedInk
            : SydneyColors.onSurface;

    final background =
        primary
            ? SydneyColors.primary
            : ghost
            ? SydneyColors.surface.withValues(alpha: 0)
            : SydneyColors.surfaceContainer;

    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: foreground,
        backgroundColor: background,
        disabledForegroundColor: foreground,
        disabledBackgroundColor: background,
        padding: const EdgeInsets.symmetric(
          horizontal: SydneySpacing.md,
          vertical: SydneySpacing.sm,
        ),
        minimumSize: const Size(0, 36),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.full),
          side:
              primary || ghost
                  ? BorderSide.none
                  : const BorderSide(color: SydneyColors.line),
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: foreground,
          fontWeight: FontWeight.w700,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

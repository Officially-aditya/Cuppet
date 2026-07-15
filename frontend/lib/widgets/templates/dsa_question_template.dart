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
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      title,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  if (completed) ...[
                    const SizedBox(width: SydneySpacing.xs),
                    const Icon(
                      Icons.check_circle_rounded,
                      color: SydneyColors.primary,
                      size: 16,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.lg),
        const _SectionHeading(
          icon: Icons.description_outlined,
          label: 'Problem description',
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
          Text(
            'INPUT FORMAT',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.mutedInk,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: SydneySpacing.xs),
          MarkdownText(
            text: inputFormat,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              height: 1.35,
            ),
          ),
        ],
        if (outputFormat != null && outputFormat.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          Text(
            'OUTPUT FORMAT',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.mutedInk,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: SydneySpacing.xs),
          MarkdownText(
            text: outputFormat,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              height: 1.35,
            ),
          ),
        ],
        if (examples.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.lg),
          const _SectionHeading(
            icon: Icons.terminal_rounded,
            label: 'Structured examples',
          ),
          const SizedBox(height: SydneySpacing.sm),
          for (var i = 0; i < examples.length; i++) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(SydneySpacing.md),
              margin: const EdgeInsets.only(bottom: SydneySpacing.sm),
              decoration: BoxDecoration(
                color: SydneyColors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(SydneyRadius.sm),
                border: Border.all(color: SydneyColors.line),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Example ${i + 1}',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: SydneyColors.primary,
                    ),
                  ),
                  const SizedBox(height: SydneySpacing.xs),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Input: ',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: SydneyColors.mutedInk,
                          fontFamily: 'Courier',
                        ),
                      ),
                      Expanded(
                        child: Text(
                          examples[i]['input']?.toString() ?? '',
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(
                            color: SydneyColors.onSurface,
                            fontFamily: 'Courier',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Output: ',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: SydneyColors.mutedInk,
                          fontFamily: 'Courier',
                        ),
                      ),
                      Expanded(
                        child: Text(
                          examples[i]['output']?.toString() ?? '',
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(
                            color: SydneyColors.onSurface,
                            fontFamily: 'Courier',
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (examples[i]['explanation'] != null &&
                      examples[i]['explanation'].toString().isNotEmpty) ...[
                    const SizedBox(height: SydneySpacing.xs),
                    const Divider(height: 1, color: SydneyColors.line),
                    const SizedBox(height: SydneySpacing.xs),
                    MarkdownText(
                      text: 'Explanation: ${examples[i]['explanation']}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: SydneyColors.onSurfaceVariant,
                        fontStyle: FontStyle.italic,
                        height: 1.3,
                      ),
                    ),
                  ],
                ],
              ),
            ),
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
            label: 'References & discuss',
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

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: SydneyColors.primary, size: 17),
        const SizedBox(width: SydneySpacing.sm),
        Expanded(
          child: Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.onSurface,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
        ),
      ],
    );
  }
}

class _DetailPanel extends StatelessWidget {
  const _DetailPanel({required this.text});

  final String text;

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
      if (_hasText(time)) ('Time', time!.trim()),
      if (_hasText(space)) ('Space', space!.trim()),
      if (_hasText(approach)) ('Approach', approach!.trim()),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SydneySpacing.md),
      decoration: BoxDecoration(
        color: SydneyColors.primarySoft,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(color: SydneyColors.primary.withValues(alpha: 0.16)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_hasText(complexity))
            Padding(
              padding: EdgeInsets.only(
                bottom: rows.isEmpty ? 0 : SydneySpacing.sm,
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
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 58,
                  child: Text(
                    rows[index].$1,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: SydneyColors.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    rows[index].$2,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurface,
                      height: 1.3,
                    ),
                  ),
                ),
              ],
            ),
            if (index < rows.length - 1)
              const SizedBox(height: SydneySpacing.xs),
          ],
        ],
      ),
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
            ? Colors.transparent
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

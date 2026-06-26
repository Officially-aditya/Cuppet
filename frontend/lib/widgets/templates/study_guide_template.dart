import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';

class StudyGuideTemplate extends StatefulWidget {
  const StudyGuideTemplate({required this.data, this.onAction, super.key});

  final Map<String, dynamic> data;
  final ValueChanged<Map<String, dynamic>>? onAction;

  @override
  State<StudyGuideTemplate> createState() => _StudyGuideTemplateState();
}

class _StudyGuideTemplateState extends State<StudyGuideTemplate> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final topic = widget.data['topic']?.toString() ?? 'Daily Topic';
    final definition = widget.data['definition']?.toString() ?? 'No description was provided.';
    final completed = widget.data['completed'] == true;
    final actionTaken = widget.data['action_taken']?.toString();
    final showActions = !completed && actionTaken == null;
    final references = _maps(widget.data['references']);
    final actions = _maps(widget.data['actions']);

    final initiallyCollapsed = widget.data['initially_collapsed'] == true;
    final shouldCollapse = initiallyCollapsed && !_isExpanded;

    // Truncate definition to first 180 characters if collapsed
    final displayText = shouldCollapse
        ? (definition.length > 180 ? '${definition.substring(0, 180)}...' : definition)
        : definition;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.school_rounded,
              color: SydneyColors.primary,
              size: 20,
            ),
            const SizedBox(width: SydneySpacing.sm),
            Expanded(
              child: Text(
                topic,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            if (completed)
              const Icon(
                Icons.check_circle_rounded,
                color: SydneyColors.primary,
                size: 18,
              ),
          ],
        ),
        const SizedBox(height: SydneySpacing.md),
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeInOut,
          alignment: Alignment.topCenter,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              MarkdownText(
                text: displayText,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  height: 1.4,
                  color: SydneyColors.onSurface,
                ),
              ),
              if (!shouldCollapse && references.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.md),
                Text(
                  'REFERENCES',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: SydneyColors.primary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                  ),
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
              if (!shouldCollapse && showActions && actions.isNotEmpty) ...[
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
                        onPressed: widget.onAction == null ? null : () => widget.onAction!(action),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
        if (initiallyCollapsed) ...[
          const SizedBox(height: SydneySpacing.md),
          Center(
            child: TextButton.icon(
              onPressed: () {
                setState(() {
                  _isExpanded = !_isExpanded;
                });
              },
              icon: Icon(
                _isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                color: SydneyColors.primary,
                size: 18,
              ),
              label: Text(
                _isExpanded ? 'Collapse lesson' : 'Read lesson',
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

    final foreground = primary
        ? SydneyColors.onPrimary
        : ghost
            ? SydneyColors.mutedInk
            : SydneyColors.onSurface;

    final background = primary
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
          side: primary || ghost
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

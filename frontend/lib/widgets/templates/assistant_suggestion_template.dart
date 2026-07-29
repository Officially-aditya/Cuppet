import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import 'template_utils.dart';

class AssistantSuggestionTemplate extends StatefulWidget {
  const AssistantSuggestionTemplate({
    required this.data,
    this.onAction,
    super.key,
  });

  final Map<String, dynamic> data;
  final ValueChanged<Map<String, dynamic>>? onAction;

  @override
  State<AssistantSuggestionTemplate> createState() =>
      _AssistantSuggestionTemplateState();
}

class _AssistantSuggestionTemplateState
    extends State<AssistantSuggestionTemplate> {
  bool _submitting = false;

  Map<String, dynamic> get data => widget.data;
  ValueChanged<Map<String, dynamic>>? get onAction => widget.onAction;

  @override
  void didUpdateWidget(covariant AssistantSuggestionTemplate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.data['suggestion_id'] != widget.data['suggestion_id']) {
      _submitting = false;
    }
  }

  void _dispatch(Map<String, dynamic> action) {
    final decision = action['decision']?.toString();
    if (decision != 'explain' && !_submitting) {
      setState(() => _submitting = true);
    }
    onAction?.call(action);
  }

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'A thought for you';
    final body = data['body']?.toString() ?? '';
    final resolved = data['resolved'] == true;
    final primary = _action(data['primary_action']);
    final secondary = templateMaps(data['secondary_actions']);
    final explanation =
        data['explanation'] is Map
            ? Map<String, dynamic>.from(data['explanation'] as Map)
            : const <String, dynamic>{};

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: SydneyColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(SydneyRadius.sm),
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                size: 17,
                color: SydneyColors.primary,
              ),
            ),
            const SizedBox(width: SydneySpacing.sm),
            Expanded(
              child: Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: SydneyColors.ink,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        if (body.trim().isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          Text(
            body,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.4),
          ),
        ],
        if (explanation.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          Container(
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
                Text(
                  'Why this appeared',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: SydneyColors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: SydneySpacing.xs),
                Text(
                  explanation['summary']?.toString() ?? '',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(height: 1.35),
                ),
                if (explanation['data_categories'] is List) ...[
                  const SizedBox(height: SydneySpacing.xs),
                  Text(
                    'Used: ${(explanation['data_categories'] as List).join(', ')}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: SydneyColors.mutedInk,
                    ),
                  ),
                ],
                if (explanation['data_categories_not_used'] is List) ...[
                  const SizedBox(height: SydneySpacing.xs),
                  Text(
                    'Not used: ${(explanation['data_categories_not_used'] as List).join(', ')}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: SydneyColors.mutedInk,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
        if (resolved) ...[
          const SizedBox(height: SydneySpacing.md),
          Text(
            _resolutionLabel(data['resolution']?.toString()),
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: SydneyColors.mutedInk,
              fontWeight: FontWeight.w700,
            ),
          ),
        ] else if (primary != null || secondary.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.md),
          if (primary != null)
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                key: const ValueKey('suggestion-primary-action'),
                onPressed:
                    onAction == null || _submitting
                        ? null
                        : () => _dispatch(primary),
                child: Text(primary['label']?.toString() ?? 'Continue'),
              ),
            ),
          if (secondary.isNotEmpty) ...[
            const SizedBox(height: SydneySpacing.xs),
            Wrap(
              spacing: SydneySpacing.xs,
              children: [
                for (final action in secondary)
                  TextButton(
                    onPressed:
                        onAction == null || _submitting
                            ? null
                            : () => _dispatch(action),
                    child: Text(action['label']?.toString() ?? 'Not now'),
                  ),
                if (data['suggestion_id'] != null)
                  TextButton(
                    onPressed:
                        onAction == null
                            ? null
                            : () => _dispatch({
                              'type': 'suggestion_decision',
                              'decision': 'explain',
                              'suggestion_id': data['suggestion_id'],
                            }),
                    child: const Text('Why this?'),
                  ),
              ],
            ),
          ],
        ],
      ],
    );
  }

  Map<String, dynamic>? _action(Object? value) {
    if (value is! Map) return null;
    return Map<String, dynamic>.from(value);
  }

  String _resolutionLabel(String? resolution) {
    return switch (resolution) {
      'accepted' =>
        'Accepted. Cuppet is waiting for your confirmation before creating anything.',
      'not_now' => 'Not now. I’ll leave this quiet for a while.',
      'dismiss' => 'Dismissed. I won’t repeat this suggestion.',
      'less_like_this' =>
        'Feedback saved. I’ll show fewer suggestions like this.',
      _ => 'Suggestion resolved.',
    };
  }
}

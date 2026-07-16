import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import 'template_utils.dart';

class ActionConfirmationTemplate extends StatelessWidget {
  const ActionConfirmationTemplate({
    required this.data,
    this.onAction,
    super.key,
  });

  final Map<String, dynamic> data;
  final ValueChanged<Map<String, dynamic>>? onAction;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Confirm this action';
    final question =
        data['question']?.toString() ?? 'Is this what you want me to do?';
    final actionLabel = data['action_label']?.toString() ?? 'Continue';
    final actionDetail = data['action_detail']?.toString();
    final contextText = data['context']?.toString();
    final actions = templateMaps(data['actions']);
    final confirmAction =
        actions.where((action) => action['decision'] == 'confirm').firstOrNull;
    final cancelAction =
        actions.where((action) => action['decision'] == 'cancel').firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(
              Icons.verified_user_outlined,
              color: SydneyColors.primary,
              size: 20,
            ),
            const SizedBox(width: SydneySpacing.sm),
            Expanded(
              child: Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.md),
        Text(
          question,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: SydneySpacing.sm),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(SydneySpacing.md),
          decoration: BoxDecoration(
            color: SydneyColors.primarySoft,
            borderRadius: BorderRadius.circular(SydneyRadius.md),
            border: Border.all(color: SydneyColors.primary),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: SydneyColors.primary,
                  borderRadius: BorderRadius.circular(SydneyRadius.sm),
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: Colors.white,
                  size: 18,
                ),
              ),
              const SizedBox(width: SydneySpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      actionLabel,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (actionDetail != null &&
                        actionDetail.trim().isNotEmpty) ...[
                      const SizedBox(height: SydneySpacing.xs),
                      Text(
                        actionDetail,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: SydneyColors.onSurfaceVariant,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
        if (contextText != null && contextText.trim().isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.sm),
          Text(
            contextText,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              height: 1.35,
            ),
          ),
        ],
        if (confirmAction != null || cancelAction != null) ...[
          const SizedBox(height: SydneySpacing.md),
          Row(
            children: [
              if (confirmAction != null)
                Expanded(
                  child: FilledButton(
                    key: const ValueKey('confirm-low-confidence-action'),
                    onPressed:
                        onAction == null
                            ? null
                            : () => onAction!(confirmAction),
                    child: Text(
                      confirmAction['label']?.toString() ?? 'Yes, continue',
                    ),
                  ),
                ),
              if (confirmAction != null && cancelAction != null)
                const SizedBox(width: SydneySpacing.sm),
              if (cancelAction != null)
                TextButton(
                  key: const ValueKey('cancel-low-confidence-action'),
                  onPressed:
                      onAction == null ? null : () => onAction!(cancelAction),
                  child: Text(cancelAction['label']?.toString() ?? 'Cancel'),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

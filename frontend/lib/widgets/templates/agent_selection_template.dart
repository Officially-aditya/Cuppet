import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import 'template_utils.dart';

class AgentSelectionTemplate extends StatefulWidget {
  const AgentSelectionTemplate({required this.data, this.onAction, super.key});

  final Map<String, dynamic> data;
  final ValueChanged<Map<String, dynamic>>? onAction;

  @override
  State<AgentSelectionTemplate> createState() => _AgentSelectionTemplateState();
}

class _AgentSelectionTemplateState extends State<AgentSelectionTemplate> {
  String? _selectedAgentId;
  String? _submittedAgentName;
  bool _submitted = false;
  bool _cancelled = false;

  @override
  void initState() {
    super.initState();
    _selectedAgentId = _initialSelection();
  }

  @override
  void didUpdateWidget(covariant AgentSelectionTemplate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.data['pending_action_id'] !=
        widget.data['pending_action_id']) {
      _selectedAgentId = _initialSelection();
      _submittedAgentName = null;
      _submitted = false;
      _cancelled = false;
    }
  }

  String? _initialSelection() {
    final suggested = widget.data['suggested_agent_id']?.toString();
    final options = templateMaps(widget.data['options']);
    return options.any((option) => option['id']?.toString() == suggested)
        ? suggested
        : null;
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.data['title']?.toString() ?? 'Confirm the agent';
    final question =
        widget.data['question']?.toString() ?? 'Which agent did you mean?';
    final contextText = widget.data['context']?.toString();
    final pendingActionId = widget.data['pending_action_id']?.toString();
    final options = templateMaps(widget.data['options']);
    final cancelAction = _map(widget.data['cancel_action']);
    final selectedName =
        options
            .where((option) => option['id']?.toString() == _selectedAgentId)
            .map((option) => option['name']?.toString())
            .firstOrNull;
    final resolved = widget.data['resolved'] == true || _submitted;
    final cancelled =
        widget.data['resolution']?.toString() == 'cancelled' || _cancelled;
    final resolvedAgentName =
        widget.data['selected_agent_name']?.toString() ??
        _submittedAgentName ??
        selectedName;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(
              Icons.account_tree_outlined,
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
        if (contextText != null && contextText.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.xs),
          Text(
            contextText,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              height: 1.35,
            ),
          ),
        ],
        const SizedBox(height: SydneySpacing.md),
        if (resolved)
          _ResolvedSelection(cancelled: cancelled, agentName: resolvedAgentName)
        else ...[
          for (var index = 0; index < options.length; index++) ...[
            _AgentOption(
              index: index + 1,
              option: options[index],
              selected: options[index]['id']?.toString() == _selectedAgentId,
              onTap:
                  widget.onAction == null
                      ? null
                      : () => setState(
                        () =>
                            _selectedAgentId = options[index]['id']?.toString(),
                      ),
            ),
            if (index < options.length - 1)
              const SizedBox(height: SydneySpacing.sm),
          ],
          if (widget.data['truncated'] == true) ...[
            const SizedBox(height: SydneySpacing.sm),
            Text(
              'More agents exist. You can cancel and reply with the exact name.',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: SydneyColors.onSurfaceVariant,
              ),
            ),
          ],
          const SizedBox(height: SydneySpacing.md),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  key: const ValueKey('confirm-agent-selection'),
                  onPressed:
                      widget.onAction == null ||
                              _selectedAgentId == null ||
                              pendingActionId == null
                          ? null
                          : () {
                            setState(() {
                              _submitted = true;
                              _submittedAgentName = selectedName;
                            });
                            widget.onAction!({
                              'id': 'assistant_select_agent',
                              'type': 'assistant_pending_action',
                              'decision': 'assistant_select_agent',
                              'pending_action_id': pendingActionId,
                              'selected_agent_id': _selectedAgentId,
                            });
                          },
                  child: Text(
                    selectedName == null
                        ? 'Choose an agent'
                        : 'Use $selectedName',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              if (cancelAction != null) ...[
                const SizedBox(width: SydneySpacing.sm),
                TextButton(
                  key: const ValueKey('cancel-agent-selection'),
                  onPressed:
                      widget.onAction == null
                          ? null
                          : () {
                            setState(() {
                              _submitted = true;
                              _cancelled = true;
                            });
                            widget.onAction!(cancelAction);
                          },
                  child: Text(cancelAction['label']?.toString() ?? 'Cancel'),
                ),
              ],
            ],
          ),
        ],
      ],
    );
  }
}

class _ResolvedSelection extends StatelessWidget {
  const _ResolvedSelection({required this.cancelled, this.agentName});

  final bool cancelled;
  final String? agentName;

  @override
  Widget build(BuildContext context) {
    final label =
        cancelled
            ? 'Selection cancelled'
            : agentName == null
            ? 'Agent selected'
            : 'Selected $agentName';
    return Container(
      key: const ValueKey('resolved-agent-selection'),
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.md,
        vertical: SydneySpacing.sm,
      ),
      decoration: BoxDecoration(
        color: SydneyColors.primarySoft,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Row(
        children: [
          Icon(
            cancelled ? Icons.close_rounded : Icons.check_circle_rounded,
            color:
                cancelled
                    ? SydneyColors.onSurfaceVariant
                    : SydneyColors.primary,
            size: 20,
          ),
          const SizedBox(width: SydneySpacing.sm),
          Expanded(
            child: Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _AgentOption extends StatelessWidget {
  const _AgentOption({
    required this.index,
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final int index;
  final Map<String, dynamic> option;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final name = option['name']?.toString() ?? 'Agent';
    final detail = option['detail']?.toString();
    return Material(
      color: selected ? SydneyColors.primarySoft : Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        side: BorderSide(
          color: selected ? SydneyColors.primary : SydneyColors.line,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: ValueKey('agent-selection-option-${option['id']}'),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(SydneySpacing.sm),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected ? SydneyColors.primary : SydneyColors.surface,
                  borderRadius: BorderRadius.circular(SydneyRadius.sm),
                  border: Border.all(
                    color:
                        selected ? SydneyColors.primary : SydneyColors.outline,
                  ),
                ),
                child: Text(
                  '$index',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: selected ? Colors.white : SydneyColors.ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: SydneySpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (detail != null && detail.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        detail,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: SydneyColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: SydneySpacing.sm),
              Icon(
                selected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_off_rounded,
                color: selected ? SydneyColors.primary : SydneyColors.outline,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Map<String, dynamic>? _map(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

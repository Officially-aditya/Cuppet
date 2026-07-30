import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';
import 'template_utils.dart';

class AllClearTemplate extends StatelessWidget {
  const AllClearTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final message = data['message']?.toString() ??
        data['summary']?.toString() ??
        'There’s nothing to show for this update.';
    final checkedAt = data['checkedAt']?.toString();
    final sourceSummary = data['sourceSummary']?.toString();
    final detailsMap = templateMap(data['details']);

    final source = detailsMap['source']?.toString();
    final itemsChecked = detailsMap['itemsChecked'];
    final readOnly = detailsMap['readOnly'] == true;
    final executionTime = detailsMap['executionTime']?.toString();

    final hasDetails = source != null ||
        itemsChecked != null ||
        readOnly ||
        executionTime != null ||
        sourceSummary != null;

    return Container(
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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(SydneySpacing.xs),
                decoration: const BoxDecoration(
                  color: SydneyColors.primarySoft,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: SydneyColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: SydneySpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      message,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: SydneyColors.onSurface,
                            fontWeight: FontWeight.w600,
                            height: 1.4,
                          ),
                    ),
                    if (checkedAt != null && checkedAt.isNotEmpty) ...[
                      const SizedBox(height: SydneySpacing.xs),
                      Text(
                        'Checked $checkedAt',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: SydneyColors.onSurfaceVariant,
                              fontSize: 12,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (hasDetails) ...[
            const SizedBox(height: SydneySpacing.sm),
            _SourcesAndAccessDrawer(
              source: source,
              itemsChecked: itemsChecked,
              readOnly: readOnly,
              executionTime: executionTime,
              sourceSummary: sourceSummary,
            ),
          ],
        ],
      ),
    );
  }
}

class _SourcesAndAccessDrawer extends StatefulWidget {
  const _SourcesAndAccessDrawer({
    required this.source,
    required this.itemsChecked,
    required this.readOnly,
    required this.executionTime,
    required this.sourceSummary,
  });

  final String? source;
  final Object? itemsChecked;
  final bool readOnly;
  final String? executionTime;
  final String? sourceSummary;

  @override
  State<_SourcesAndAccessDrawer> createState() =>
      _SourcesAndAccessDrawerState();
}

class _SourcesAndAccessDrawerState extends State<_SourcesAndAccessDrawer> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => setState(() => _expanded = !_expanded),
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: SydneySpacing.xs),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Sources and access',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: SydneyColors.onSurfaceVariant,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                      ),
                ),
                Icon(
                  _expanded
                      ? Icons.keyboard_arrow_up_rounded
                      : Icons.keyboard_arrow_down_rounded,
                  size: 18,
                  color: SydneyColors.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
        if (_expanded) ...[
          const SizedBox(height: SydneySpacing.xs),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(SydneySpacing.sm + 2),
            decoration: BoxDecoration(
              color: SydneyColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(SydneyRadius.sm),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (widget.source != null)
                  _DetailRow(label: 'Source', value: widget.source!),
                if (widget.itemsChecked != null)
                  _DetailRow(
                    label: 'Items checked',
                    value: widget.itemsChecked.toString(),
                  ),
                if (widget.readOnly)
                  const _DetailRow(
                    label: 'Access mode',
                    value: 'Read-only',
                  ),
                if (widget.executionTime != null)
                  _DetailRow(
                    label: 'Execution time',
                    value: widget.executionTime!,
                  ),
                if (widget.sourceSummary != null)
                  _DetailRow(
                    label: 'Summary',
                    value: widget.sourceSummary!,
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: SydneyColors.onSurfaceVariant,
                  fontSize: 12,
                ),
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: SydneyColors.onSurface,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
          ),
        ],
      ),
    );
  }
}

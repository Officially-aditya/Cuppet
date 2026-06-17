import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class SydneyHeatmap extends StatefulWidget {
  const SydneyHeatmap({required this.history, this.intent, super.key});

  final Map<String, dynamic> history;
  final String? intent;

  @override
  State<SydneyHeatmap> createState() => _SydneyHeatmapState();
}

class _SydneyHeatmapState extends State<SydneyHeatmap> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    // Go back 16 weeks (16 * 7 days) and align with Sunday
    final startDay = today.subtract(const Duration(days: 16 * 7));
    final alignOffset = startDay.weekday % 7; // Sunday = 0, Monday = 1...
    final sundayStart = startDay.subtract(Duration(days: alignOffset));

    final columns = <Widget>[];

    for (int week = 0; week < 16; week++) {
      final weekDays = <Widget>[];
      for (int day = 0; day < 7; day++) {
        final currentDate = sundayStart.add(Duration(days: week * 7 + day));
        final dateKey = '${currentDate.year}-${_pad(currentDate.month)}-${_pad(currentDate.day)}';
        final isCompleted = widget.history[dateKey] == true;
        final isFuture = currentDate.isAfter(today);

        Color cellColor;
        if (isFuture) {
          cellColor = Colors.transparent;
        } else if (isCompleted) {
          cellColor = SydneyColors.primary;
        } else {
          cellColor = SydneyColors.surfaceContainerHigh;
        }

        weekDays.add(
          Container(
            width: 10,
            height: 10,
            margin: const EdgeInsets.only(bottom: 2),
            decoration: BoxDecoration(
              color: cellColor,
              borderRadius: BorderRadius.circular(2),
              border: isFuture
                  ? null
                  : Border.all(color: SydneyColors.line.withValues(alpha: 0.3), width: 0.5),
            ),
          ),
        );
      }

      columns.add(
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 1),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: weekDays,
          ),
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.page,
        vertical: SydneySpacing.sm,
      ),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(color: SydneyColors.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _isExpanded = !_isExpanded),
            borderRadius: BorderRadius.circular(SydneyRadius.md),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(
                    _getIcon(widget.intent),
                    color: SydneyColors.primary,
                    size: 16,
                  ),
                  const SizedBox(width: SydneySpacing.sm),
                  Text(
                    _getTitle(widget.intent),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: SydneyColors.primary,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${widget.history.values.where((v) => v == true).length} ${_getSuffix(widget.intent)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurfaceVariant,
                      fontSize: 10,
                    ),
                  ),
                  const SizedBox(width: SydneySpacing.xs),
                  Icon(
                    _isExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: SydneyColors.onSurfaceVariant,
                    size: 16,
                  ),
                ],
              ),
            ),
          ),
          if (_isExpanded) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Day of week labels
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _dayLabel('M'),
                      const SizedBox(height: 10),
                      _dayLabel('W'),
                      const SizedBox(height: 10),
                      _dayLabel('F'),
                    ],
                  ),
                  const SizedBox(width: SydneySpacing.sm),
                  // Heatmap Grid
                  Expanded(
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      reverse: true,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: columns,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _dayLabel(String label) {
    return SizedBox(
      height: 10,
      child: Center(
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 8,
            color: SydneyColors.mutedInk,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  IconData _getIcon(String? intent) {
    return switch (intent) {
      'study_plan' => Icons.school_rounded,
      'interview_prep' => Icons.work_outline_rounded,
      'language_word' => Icons.translate_rounded,
      'coding_tip' => Icons.code_rounded,
      'book_companion' => Icons.menu_book_rounded,
      _ => Icons.trending_up_rounded,
    };
  }

  String _getTitle(String? intent) {
    return switch (intent) {
      'study_plan' => 'STUDY PROGRESS',
      'interview_prep' => 'INTERVIEW PREP PROGRESS',
      'language_word' => 'VOCABULARY PROGRESS',
      'coding_tip' => 'CODING PROGRESS',
      'book_companion' => 'READING PROGRESS',
      _ => 'ACTIVITY HISTORY',
    };
  }

  String _getSuffix(String? intent) {
    return switch (intent) {
      'study_plan' => 'days learned',
      'interview_prep' => 'days prepared',
      'language_word' => 'words learned',
      'coding_tip' => 'days coded',
      'book_companion' => 'days read',
      _ => 'days active',
    };
  }

  String _pad(int val) {
    return val.toString().padLeft(2, '0');
  }
}

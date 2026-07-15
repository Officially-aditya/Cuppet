import 'package:flutter/material.dart';

import '../../design/tokens.dart';

const _heatmapWeeks = 16;
const _cellSize = 12.0;
const _cellGap = 3.0;
const _rowHeight = _cellSize + _cellGap;

class SydneyHeatmap extends StatefulWidget {
  const SydneyHeatmap({
    required this.history,
    this.intent,
    this.now,
    super.key,
  });

  final Map<String, dynamic> history;
  final String? intent;
  final DateTime? now;

  @override
  State<SydneyHeatmap> createState() => _SydneyHeatmapState();
}

class _SydneyHeatmapState extends State<SydneyHeatmap> {
  bool _isExpanded = true;

  @override
  Widget build(BuildContext context) {
    final data = _HeatmapData.from(
      widget.history,
      widget.now ?? DateTime.now(),
    );
    final copy = _copyForIntent(widget.intent);

    return Container(
      key: const ValueKey('heatmap-inline'),
      margin: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.page,
        vertical: SydneySpacing.sm,
      ),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(color: SydneyColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            key: const ValueKey('heatmap-inline-toggle'),
            onTap: () => setState(() => _isExpanded = !_isExpanded),
            child: Padding(
              padding: const EdgeInsets.all(SydneySpacing.lg),
              child: Row(
                children: [
                  Icon(copy.icon, color: SydneyColors.primary, size: 20),
                  const SizedBox(width: SydneySpacing.md),
                  Expanded(
                    child: Text(
                      copy.title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: SydneyColors.ink,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Text(
                    '${data.totalCompleted} ${copy.totalLabel.toLowerCase()}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.mutedInk,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: SydneySpacing.sm),
                  Icon(
                    _isExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: SydneyColors.mutedInk,
                    size: 18,
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 180),
            alignment: Alignment.topCenter,
            child:
                _isExpanded
                    ? Padding(
                      padding: const EdgeInsets.fromLTRB(
                        SydneySpacing.lg,
                        0,
                        SydneySpacing.lg,
                        SydneySpacing.lg,
                      ),
                      child: Column(
                        children: [
                          const Divider(height: 1, color: SydneyColors.line),
                          const SizedBox(height: SydneySpacing.lg),
                          _ActivityPanel(data: data, showHeading: false),
                        ],
                      ),
                    )
                    : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

class SydneyHeatmapSheet extends StatelessWidget {
  const SydneyHeatmapSheet({
    required this.agentName,
    required this.history,
    this.intent,
    this.now,
    super.key,
  });

  final String agentName;
  final Map<String, dynamic> history;
  final String? intent;
  final DateTime? now;

  @override
  Widget build(BuildContext context) {
    final data = _HeatmapData.from(history, now ?? DateTime.now());
    final copy = _copyForIntent(intent);

    return Container(
      key: const ValueKey('heatmap-sheet'),
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.82,
      ),
      decoration: const BoxDecoration(
        color: SydneyColors.surfaceContainerLowest,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(SydneyRadius.xl),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.md,
            SydneySpacing.page,
            SydneySpacing.xl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: SydneyColors.outlineVariant,
                    borderRadius: BorderRadius.circular(SydneyRadius.full),
                  ),
                ),
              ),
              const SizedBox(height: SydneySpacing.xl),
              Row(
                children: [
                  Icon(copy.icon, color: SydneyColors.primary, size: 24),
                  const SizedBox(width: SydneySpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          agentName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(
                            context,
                          ).textTheme.titleMedium?.copyWith(
                            color: SydneyColors.ink,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: SydneySpacing.xxs),
                        Text(
                          copy.title,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: SydneyColors.mutedInk),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: SydneySpacing.xl),
              _SummaryStrip(
                total: data.totalCompleted,
                totalLabel: copy.totalLabel,
                streak: data.currentStreak,
              ),
              const SizedBox(height: SydneySpacing.lg),
              _ActivityPanel(data: data),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({
    required this.total,
    required this.totalLabel,
    required this.streak,
  });

  final int total;
  final String totalLabel;
  final int streak;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('heatmap-summary'),
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.lg,
        vertical: SydneySpacing.md,
      ),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: _SummaryMetric(id: 'total', value: total, label: totalLabel),
          ),
          const SizedBox(
            height: 40,
            child: VerticalDivider(width: 1, color: SydneyColors.line),
          ),
          Expanded(
            child: _SummaryMetric(
              id: 'streak',
              value: streak,
              label: 'Day streak',
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({
    required this.id,
    required this.value,
    required this.label,
  });

  final String id;
  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$value',
          key: ValueKey('heatmap-metric-$id'),
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: value > 0 ? SydneyColors.primary : SydneyColors.ink,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: SydneySpacing.xxs),
        Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: SydneyColors.mutedInk,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _ActivityPanel extends StatelessWidget {
  const _ActivityPanel({required this.data, this.showHeading = true});

  final _HeatmapData data;
  final bool showHeading;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('heatmap-activity-panel'),
      padding: const EdgeInsets.all(SydneySpacing.lg),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showHeading) ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Activity',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: SydneyColors.ink,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Text(
                  'Last 16 weeks',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
                ),
              ],
            ),
            const SizedBox(height: SydneySpacing.lg),
          ],
          _ActivityGrid(data: data),
          const SizedBox(height: SydneySpacing.md),
          const _BinaryLegend(),
          if (data.totalCompleted == 0) ...[
            const SizedBox(height: SydneySpacing.sm),
            Text(
              'Completed days will appear here.',
              key: const ValueKey('heatmap-empty-copy'),
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
            ),
          ],
        ],
      ),
    );
  }
}

class _ActivityGrid extends StatelessWidget {
  const _ActivityGrid({required this.data});

  final _HeatmapData data;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      key: const ValueKey('heatmap-grid'),
      height: _rowHeight * 7,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(
            width: 20,
            child: Column(
              children: [
                _WeekdayLabel('M'),
                _WeekdayLabel(''),
                _WeekdayLabel('W'),
                _WeekdayLabel(''),
                _WeekdayLabel('F'),
                _WeekdayLabel(''),
                _WeekdayLabel(''),
              ],
            ),
          ),
          const SizedBox(width: SydneySpacing.sm),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              reverse: true,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var week = 0; week < _heatmapWeeks; week++) ...[
                    Column(
                      children: [
                        for (var day = 0; day < 7; day++) ...[
                          _HeatmapCell(
                            date: data.gridStart.add(
                              Duration(days: (week * 7) + day),
                            ),
                            data: data,
                          ),
                          if (day < 6) const SizedBox(height: _cellGap),
                        ],
                      ],
                    ),
                    if (week < _heatmapWeeks - 1)
                      const SizedBox(width: _cellGap),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _WeekdayLabel extends StatelessWidget {
  const _WeekdayLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: _rowHeight,
      child: Align(
        alignment: Alignment.topLeft,
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: SydneyColors.subtleInk,
            fontSize: 9,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _HeatmapCell extends StatelessWidget {
  const _HeatmapCell({required this.date, required this.data});

  final DateTime date;
  final _HeatmapData data;

  @override
  Widget build(BuildContext context) {
    final dateKey = _dateKey(date);
    final isFuture = date.isAfter(data.today);
    final isCompleted = !isFuture && data.isCompleted(date);
    final isToday = date == data.today;
    final color =
        isFuture
            ? SydneyColors.surface.withValues(alpha: 0)
            : isCompleted
            ? SydneyColors.primary
            : SydneyColors.surfaceContainerHigh;

    return Semantics(
      label:
          '$dateKey, ${isFuture
              ? 'future'
              : isCompleted
              ? 'completed'
              : 'no activity'}',
      child: Container(
        key: ValueKey('heatmap-day-$dateKey'),
        width: _cellSize,
        height: _cellSize,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(SydneyRadius.xxs),
          border:
              isToday && !isFuture
                  ? Border.all(color: SydneyColors.primaryDark, width: 1)
                  : null,
        ),
      ),
    );
  }
}

class _BinaryLegend extends StatelessWidget {
  const _BinaryLegend();

  @override
  Widget build(BuildContext context) {
    return const Wrap(
      key: ValueKey('heatmap-legend'),
      alignment: WrapAlignment.end,
      spacing: SydneySpacing.md,
      runSpacing: SydneySpacing.sm,
      children: [
        _LegendItem(
          label: 'No activity',
          color: SydneyColors.surfaceContainerHigh,
        ),
        _LegendItem(label: 'Completed', color: SydneyColors.primary),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(SydneyRadius.xxs),
          ),
        ),
        const SizedBox(width: SydneySpacing.xs),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: SydneyColors.mutedInk,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _HeatmapData {
  const _HeatmapData({
    required this.history,
    required this.today,
    required this.gridStart,
    required this.totalCompleted,
    required this.currentStreak,
  });

  factory _HeatmapData.from(Map<String, dynamic> history, DateTime now) {
    final today = DateTime(now.year, now.month, now.day);
    final currentWeekStart = today.subtract(
      Duration(days: today.weekday - DateTime.monday),
    );
    final gridStart = currentWeekStart.subtract(
      const Duration(days: (_heatmapWeeks - 1) * 7),
    );

    var totalCompleted = 0;
    for (final entry in history.entries) {
      if (entry.value != true) continue;
      final date = _parseDateKey(entry.key);
      if (date != null && !date.isAfter(today)) totalCompleted++;
    }

    var streakDate = today;
    if (history[_dateKey(streakDate)] != true) {
      streakDate = streakDate.subtract(const Duration(days: 1));
    }
    var currentStreak = 0;
    while (history[_dateKey(streakDate)] == true) {
      currentStreak++;
      streakDate = streakDate.subtract(const Duration(days: 1));
    }

    return _HeatmapData(
      history: history,
      today: today,
      gridStart: gridStart,
      totalCompleted: totalCompleted,
      currentStreak: currentStreak,
    );
  }

  final Map<String, dynamic> history;
  final DateTime today;
  final DateTime gridStart;
  final int totalCompleted;
  final int currentStreak;

  bool isCompleted(DateTime date) => history[_dateKey(date)] == true;
}

class _HeatmapCopy {
  const _HeatmapCopy({
    required this.title,
    required this.totalLabel,
    required this.icon,
  });

  final String title;
  final String totalLabel;
  final IconData icon;
}

_HeatmapCopy _copyForIntent(String? intent) {
  return switch (intent) {
    'study_plan' => const _HeatmapCopy(
      title: 'Study progress',
      totalLabel: 'Days learned',
      icon: Icons.school_outlined,
    ),
    'interview_prep' => const _HeatmapCopy(
      title: 'Interview preparation',
      totalLabel: 'Days prepared',
      icon: Icons.work_outline_rounded,
    ),
    'language_word' => const _HeatmapCopy(
      title: 'Vocabulary progress',
      totalLabel: 'Words learned',
      icon: Icons.translate_rounded,
    ),
    'coding_tip' => const _HeatmapCopy(
      title: 'Coding practice',
      totalLabel: 'Days coded',
      icon: Icons.code_rounded,
    ),
    'book_companion' => const _HeatmapCopy(
      title: 'Reading progress',
      totalLabel: 'Days read',
      icon: Icons.menu_book_outlined,
    ),
    'dsa_question' => const _HeatmapCopy(
      title: 'DSA practice',
      totalLabel: 'Problems solved',
      icon: Icons.code_rounded,
    ),
    'habit_tracker' => const _HeatmapCopy(
      title: 'Habit progress',
      totalLabel: 'Days active',
      icon: Icons.track_changes_rounded,
    ),
    _ => const _HeatmapCopy(
      title: 'Activity history',
      totalLabel: 'Days active',
      icon: Icons.calendar_view_month_outlined,
    ),
  };
}

DateTime? _parseDateKey(String key) {
  final parts = key.split('-');
  if (parts.length != 3) return null;
  final year = int.tryParse(parts[0]);
  final month = int.tryParse(parts[1]);
  final day = int.tryParse(parts[2]);
  if (year == null || month == null || day == null) return null;
  final date = DateTime(year, month, day);
  if (date.year != year || date.month != month || date.day != day) return null;
  return date;
}

String _dateKey(DateTime date) {
  final month = date.month.toString().padLeft(2, '0');
  final day = date.day.toString().padLeft(2, '0');
  return '${date.year}-$month-$day';
}

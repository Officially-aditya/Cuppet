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
  bool _isExpanded = true;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final startWeekday = _getStartWeekday(widget.history);
    final alignOffset = (today.weekday - startWeekday + 7) % 7;
    final startOfWeek = today.subtract(Duration(days: alignOffset));
    final gridStart = startOfWeek.subtract(const Duration(days: 15 * 7));

    final columns = <Widget>[];

    const double cellSize = 12.0;
    const double cellSpacing = 3.0;
    const double totalHeight = cellSize + cellSpacing; // 15.0

    for (int week = 0; week < 16; week++) {
      final weekDays = <Widget>[];
      for (int day = 0; day < 7; day++) {
        final currentDate = DateTime(
          gridStart.year,
          gridStart.month,
          gridStart.day + (week * 7 + day),
        );
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
            width: cellSize,
            height: cellSize,
            margin: const EdgeInsets.only(bottom: cellSpacing),
            decoration: BoxDecoration(
              color: cellColor,
              borderRadius: BorderRadius.circular(3),
              border: isFuture
                  ? null
                  : Border.all(
                      color: isCompleted
                          ? SydneyColors.primaryDark.withValues(alpha: 0.15)
                          : SydneyColors.line.withValues(alpha: 0.4),
                      width: 0.5,
                    ),
            ),
          ),
        );
      }

      columns.add(
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 1.25),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: weekDays,
          ),
        ),
      );
    }

    final totalCompleted = widget.history.values.where((v) => v == true).length;

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
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: SydneyColors.primarySoft,
                      borderRadius: BorderRadius.circular(SydneyRadius.sm),
                    ),
                    child: Icon(
                      _getIcon(widget.intent),
                      color: SydneyColors.primary,
                      size: 14,
                    ),
                  ),
                  const SizedBox(width: SydneySpacing.md),
                  Text(
                    _getTitle(widget.intent),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: SydneyColors.primary,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.8,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '$totalCompleted ${_getSuffix(widget.intent)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.mutedInk,
                      fontWeight: FontWeight.w600,
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(width: SydneySpacing.sm),
                  Icon(
                    _isExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: SydneyColors.subtleInk,
                    size: 18,
                  ),
                ],
              ),
            ),
          ),
          AnimatedCrossFade(
            firstChild: const SizedBox.shrink(),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Divider(color: SydneyColors.line, height: 16),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Day of week labels
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (int i = 0; i < 7; i++)
                            _buildDynamicDayLabel(startWeekday, i, totalHeight),
                        ],
                      ),
                      const SizedBox(width: SydneySpacing.md),
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
                  const SizedBox(height: SydneySpacing.md),
                  // Legend
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        'Less',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: SydneyColors.subtleInk,
                              fontSize: 9,
                            ),
                      ),
                      const SizedBox(width: 4),
                      _legendBox(SydneyColors.surfaceContainerHigh),
                      const SizedBox(width: 2.5),
                      _legendBox(SydneyColors.primary),
                      const SizedBox(width: 4),
                      Text(
                        'More',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: SydneyColors.subtleInk,
                              fontSize: 9,
                            ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            crossFadeState: _isExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 200),
          ),
        ],
      ),
    );
  }

  Widget _legendBox(Color color) {
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(2.5),
        border: Border.all(
          color: SydneyColors.line.withValues(alpha: 0.4),
          width: 0.5,
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
      'dsa_question' => Icons.code_rounded,
      'habit_tracker' => Icons.local_fire_department_rounded,
      _ => Icons.trending_up_rounded,
    };
  }

  String _getTitle(String? intent) {
    return switch (intent) {
      'study_plan' => 'STUDY PROGRESS',
      'interview_prep' => 'INTERVIEW PREP',
      'language_word' => 'VOCABULARY BUILDER',
      'coding_tip' => 'CODING PRACTICE',
      'book_companion' => 'READING LOG',
      'dsa_question' => 'DSA PRACTICE',
      'habit_tracker' => 'HABIT TRACKER',
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
      'dsa_question' => 'problems solved',
      'habit_tracker' => 'days active',
      _ => 'days active',
    };
  }

  String _pad(int val) {
    return val.toString().padLeft(2, '0');
  }
}

class SydneyHeatmapSheet extends StatelessWidget {
  const SydneyHeatmapSheet({
    required this.agentName,
    required this.history,
    this.intent,
    super.key,
  });

  final String agentName;
  final Map<String, dynamic> history;
  final String? intent;

  @override
  Widget build(BuildContext context) {
    // 1. Calculate statistics
    final totalCompleted = history.values.where((v) => v == true).length;

    // Calculate current streak
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    int currentStreak = 0;
    DateTime checkDate = today;
    while (true) {
      final dateKey = '${checkDate.year}-${checkDate.month.toString().padLeft(2, '0')}-${checkDate.day.toString().padLeft(2, '0')}';
      if (history[dateKey] == true) {
        currentStreak++;
        checkDate = checkDate.subtract(const Duration(days: 1));
      } else {
        // If today is not completed, check if yesterday was completed to preserve a yesterday-based streak
        if (checkDate == today) {
          checkDate = checkDate.subtract(const Duration(days: 1));
          continue;
        }
        break;
      }
    }

    // 2. Generate columns for the 16-week grid
    final startWeekday = _getStartWeekday(history);
    final alignOffset = (today.weekday - startWeekday + 7) % 7;
    final startOfWeek = today.subtract(Duration(days: alignOffset));
    final gridStart = startOfWeek.subtract(const Duration(days: 15 * 7));

    const double cellSize = 12.0;
    const double cellSpacing = 3.0;
    const double totalHeight = cellSize + cellSpacing; // 15.0

    final columns = <Widget>[];
    for (int week = 0; week < 16; week++) {
      final weekDays = <Widget>[];
      for (int day = 0; day < 7; day++) {
        final currentDate = DateTime(
          gridStart.year,
          gridStart.month,
          gridStart.day + (week * 7 + day),
        );
        final dateKey = '${currentDate.year}-${currentDate.month.toString().padLeft(2, '0')}-${currentDate.day.toString().padLeft(2, '0')}';
        final isCompleted = history[dateKey] == true;
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
            width: cellSize,
            height: cellSize,
            margin: const EdgeInsets.only(bottom: cellSpacing),
            decoration: BoxDecoration(
              color: cellColor,
              borderRadius: BorderRadius.circular(3),
              border: isFuture
                  ? null
                  : Border.all(
                      color: isCompleted
                          ? SydneyColors.primaryDark.withValues(alpha: 0.15)
                          : SydneyColors.line.withValues(alpha: 0.4),
                      width: 0.5,
                    ),
            ),
          ),
        );
      }

      columns.add(
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 1.25),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: weekDays,
          ),
        ),
      );
    }

    // Modal bottom sheet container with rounded corners and modern background
    return Container(
      decoration: const BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(SydneyRadius.lg),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        SydneySpacing.md,
        SydneySpacing.page,
        SydneySpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: SydneyColors.outlineVariant.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: SydneySpacing.lg),

          // Header Row with Icon and Title
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(SydneySpacing.sm),
                decoration: BoxDecoration(
                  color: SydneyColors.primarySoft,
                  borderRadius: BorderRadius.circular(SydneyRadius.md),
                ),
                child: Icon(
                  _getIcon(intent),
                  color: SydneyColors.primary,
                  size: 24,
                ),
              ),
              const SizedBox(width: SydneySpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _getTitle(intent),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: SydneyColors.primary,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                          ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      agentName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.lg),

          // Statistics Cards
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  label: _getSuffix(intent),
                  value: '$totalCompleted',
                  icon: Icons.check_circle_outline_rounded,
                  color: totalCompleted > 0 ? SydneyColors.primary : SydneyColors.subtleInk,
                  backgroundColor: totalCompleted > 0 ? SydneyColors.primarySoft : SydneyColors.surfaceContainerLow,
                ),
              ),
              const SizedBox(width: SydneySpacing.md),
              Expanded(
                child: _StatCard(
                  label: 'Current Streak',
                  value: '$currentStreak days',
                  icon: Icons.local_fire_department_rounded,
                  color: currentStreak > 0 ? const Color(0xFFE25822) : SydneyColors.subtleInk,
                  backgroundColor: currentStreak > 0 ? const Color(0xFFFFF5F0) : SydneyColors.surfaceContainerLow,
                ),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.xl),

          // Heatmap Calendar Grid
          Text(
            'LAST 16 WEEKS',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: SydneyColors.subtleInk,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.6,
                ),
          ),
          const SizedBox(height: SydneySpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Day of week labels
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (int i = 0; i < 7; i++)
                    _buildDynamicDayLabel(startWeekday, i, totalHeight),
                ],
              ),
              const SizedBox(width: SydneySpacing.md),
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
          const SizedBox(height: SydneySpacing.md),

          // Legend and Motivational footer
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Motivational hint
              Expanded(
                child: Text(
                  _getMotivationalMessage(totalCompleted),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: SydneyColors.mutedInk,
                        fontStyle: FontStyle.italic,
                        fontSize: 11,
                      ),
                ),
              ),
              // Legend
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Less',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: SydneyColors.subtleInk,
                          fontSize: 9,
                        ),
                  ),
                  const SizedBox(width: 4),
                  _legendBox(SydneyColors.surfaceContainerHigh),
                  const SizedBox(width: 2.5),
                  _legendBox(SydneyColors.primary),
                  const SizedBox(width: 4),
                  Text(
                    'More',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: SydneyColors.subtleInk,
                          fontSize: 9,
                        ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _legendBox(Color color) {
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(2.5),
        border: Border.all(
          color: SydneyColors.line.withValues(alpha: 0.4),
          width: 0.5,
        ),
      ),
    );
  }

  String _getMotivationalMessage(int total) {
    if (total == 0) return 'Start your journey today!';
    if (total <= 5) return 'Great start! Keep it up.';
    if (total <= 15) return 'Awesome consistency!';
    return 'Incredible dedication!';
  }

  IconData _getIcon(String? intent) {
    return switch (intent) {
      'study_plan' => Icons.school_rounded,
      'interview_prep' => Icons.work_outline_rounded,
      'language_word' => Icons.translate_rounded,
      'coding_tip' => Icons.code_rounded,
      'book_companion' => Icons.menu_book_rounded,
      'dsa_question' => Icons.code_rounded,
      'habit_tracker' => Icons.local_fire_department_rounded,
      _ => Icons.trending_up_rounded,
    };
  }

  String _getTitle(String? intent) {
    return switch (intent) {
      'study_plan' => 'STUDY PROGRESS',
      'interview_prep' => 'INTERVIEW PREP',
      'language_word' => 'VOCABULARY BUILDER',
      'coding_tip' => 'CODING PRACTICE',
      'book_companion' => 'READING LOG',
      'dsa_question' => 'DSA PRACTICE',
      'habit_tracker' => 'HABIT TRACKER',
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
      'dsa_question' => 'problems solved',
      'habit_tracker' => 'days active',
      _ => 'days active',
    };
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    this.color,
    this.backgroundColor,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color? color;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final themeColor = color ?? SydneyColors.primary;
    final bg = backgroundColor ?? SydneyColors.surfaceContainerLow;
    return Container(
      padding: const EdgeInsets.all(SydneySpacing.md),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(
          color: bg == SydneyColors.surfaceContainerLow
              ? SydneyColors.line
              : themeColor.withValues(alpha: 0.15),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                icon,
                color: themeColor,
                size: 16,
              ),
              const SizedBox(width: SydneySpacing.sm),
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: SydneyColors.mutedInk,
                        fontSize: 9,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.sm),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: SydneyColors.ink,
                ),
          ),
        ],
      ),
    );
  }
}

int _getStartWeekday(Map<String, dynamic> history) {
  if (history.isEmpty) {
    return DateTime.now().weekday;
  }
  DateTime? earliest;
  for (final key in history.keys) {
    final parts = key.split('-');
    if (parts.length == 3) {
      final y = int.tryParse(parts[0]);
      final m = int.tryParse(parts[1]);
      final d = int.tryParse(parts[2]);
      if (y != null && m != null && d != null) {
        final dt = DateTime(y, m, d);
        if (earliest == null || dt.isBefore(earliest)) {
          earliest = dt;
        }
      }
    }
  }
  return earliest?.weekday ?? DateTime.now().weekday;
}

Widget _buildDynamicDayLabel(int startWeekday, int row, double height) {
  String text = '';
  if (row == 1) {
    text = 'M';
  } else if (row == 3) {
    text = 'W';
  } else if (row == 5) {
    text = 'F';
  }

  return Container(
    height: height,
    alignment: Alignment.centerLeft,
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 8,
        color: SydneyColors.subtleInk,
        fontWeight: FontWeight.bold,
      ),
    ),
  );
}

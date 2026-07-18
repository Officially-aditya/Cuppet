String readableAgentSchedule(
  String? cron, {
  String? timeZone,
  bool includeTimeZone = true,
}) {
  if (cron == null || cron.trim().isEmpty) {
    return 'Whenever you message it';
  }

  final description = _scheduleDescription(cron);
  if (!includeTimeZone) return description;
  return '$description · ${timeZone ?? 'your local time'}';
}

String humanizeScheduleText(String text) {
  final onSchedulePattern = RegExp(
    r'\bon schedule\s+(\d{1,2}\s+\d{1,2}\s+(?:\*|\d{1,2})\s+\*\s+(?:\*|1-5|[0-7]))',
    caseSensitive: false,
  );
  var result = text.replaceAllMapped(onSchedulePattern, (match) {
    return _lowercaseFirst(_scheduleDescription(match.group(1)!));
  });

  final cronPattern = RegExp(
    r'\b(\d{1,2}\s+\d{1,2}\s+(?:\*|\d{1,2})\s+\*\s+(?:\*|1-5|[0-7]))(?=\s|[.,;:!?)]|$)',
  );
  result = result.replaceAllMapped(cronPattern, (match) {
    return _lowercaseFirst(_scheduleDescription(match.group(1)!));
  });
  return result;
}

String _scheduleDescription(String cron) {
  final parts = cron.trim().split(RegExp(r'\s+'));
  if (parts.length != 5) return 'Runs on a custom schedule';

  final minute = int.tryParse(parts[0]);
  final hour = int.tryParse(parts[1]);
  final dayOfMonth = parts[2];
  final month = parts[3];
  final dayOfWeek = parts[4];
  if (minute == null ||
      hour == null ||
      minute < 0 ||
      minute > 59 ||
      hour < 0 ||
      hour > 23 ||
      month != '*') {
    return 'Runs on a custom schedule';
  }

  final time = _formatTime(hour, minute);
  if (dayOfMonth == '*' && dayOfWeek == '*') {
    return 'Daily at $time';
  }
  if (dayOfMonth == '*' && dayOfWeek == '1-5') {
    return 'Weekdays at $time';
  }
  final weekday = int.tryParse(dayOfWeek);
  if (dayOfMonth == '*' && weekday != null && weekday >= 0 && weekday <= 7) {
    return 'Weekly on ${_weekdayName(weekday)} at $time';
  }
  final monthDay = int.tryParse(dayOfMonth);
  if (monthDay != null && monthDay >= 1 && monthDay <= 31 && dayOfWeek == '*') {
    return 'Monthly on the ${_ordinal(monthDay)} at $time';
  }
  return 'Runs on a custom schedule';
}

String _formatTime(int hour, int minute) {
  final hour12 = hour == 0 || hour == 12 ? 12 : hour % 12;
  final suffix = hour < 12 ? 'AM' : 'PM';
  return '$hour12:${minute.toString().padLeft(2, '0')} $suffix';
}

String _weekdayName(int day) {
  return const [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ][day];
}

String _ordinal(int day) {
  if (day >= 11 && day <= 13) return '${day}th';
  return switch (day % 10) {
    1 => '${day}st',
    2 => '${day}nd',
    3 => '${day}rd',
    _ => '${day}th',
  };
}

String _lowercaseFirst(String value) {
  if (value.isEmpty) return value;
  return '${value[0].toLowerCase()}${value.substring(1)}';
}

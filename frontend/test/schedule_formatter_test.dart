import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/agent_schedule.dart';

void main() {
  test('all template schedule shapes are readable', () {
    expect(readableAgentSchedule('0 6 * * *'), contains('Daily at 6:00 AM'));
    expect(
      readableAgentSchedule('0 16 * * 1-5'),
      contains('Weekdays at 4:00 PM'),
    );
    expect(
      readableAgentSchedule('0 17 * * 5'),
      contains('Weekly on Friday at 5:00 PM'),
    );
    expect(
      readableAgentSchedule('0 9 1 * *'),
      contains('Monthly on the 1st at 9:00 AM'),
    );
  });

  test('template prompts and unsupported schedules never expose cron', () {
    expect(
      humanizeScheduleText(
        'Create an Email agent. Run it on schedule 0 18 * * *.',
      ),
      'Create an Email agent. Run it daily at 6:00 PM.',
    );
    expect(
      readableAgentSchedule('*/5 * * * *'),
      'Runs on a custom schedule · your local time',
    );
    expect(readableAgentSchedule('*/5 * * * *'), isNot(contains('*')));
  });
}

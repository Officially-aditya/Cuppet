import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/widgets/templates/data_summary_template.dart';

void main() {
  testWidgets('new agent introduction shows its job, timing, and controls', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: SizedBox(
              width: 390,
              child: DataSummaryTemplate(
                data: {
                  'kind': 'agent_introduction',
                  'title': 'Calendar Agenda',
                  'text':
                      'Hi, I’m Calendar Agenda. I’m set up and ready to help.',
                  'summary': '''
What I do:
Reads upcoming calendar events and prepares a concise agenda.

When I run:
I’ll run every day at 7:00 AM.

Access and safety:
- Google Calendar event read access
- I only read data and prepare updates.

Controls:
You can ask me to run now, or ask the Assistant to pause, update, rename, or delete me.
''',
                },
              ),
            ),
          ),
        ),
      ),
    );

    expect(find.textContaining('Hi, I’m Calendar Agenda'), findsOneWidget);
    expect(find.text('What I do'), findsOneWidget);
    expect(find.textContaining('Reads upcoming calendar'), findsOneWidget);
    expect(find.text('When I run'), findsOneWidget);
    expect(find.textContaining('every day at 7:00 AM'), findsOneWidget);
    expect(find.text('Access and safety'), findsOneWidget);
    expect(find.text('Controls'), findsOneWidget);
  });
}

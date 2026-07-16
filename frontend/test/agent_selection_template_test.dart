import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/widgets/templates/agent_selection_template.dart';

void main() {
  testWidgets(
    'agent selection preselects the model match but lets user change it',
    (tester) async {
      Map<String, dynamic>? submitted;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 390,
              child: AgentSelectionTemplate(
                data: {
                  'title': 'Confirm the agent',
                  'question': 'Which agent should I delete?',
                  'context':
                      'I matched your request to Calendar Agent. Confirm it or choose another agent.',
                  'pending_action_id': 'pending-1',
                  'suggested_agent_id': 'agent-2',
                  'options': [
                    {
                      'id': 'agent-1',
                      'name': 'News Agent',
                      'detail': 'active · every day at 9:00 AM',
                    },
                    {
                      'id': 'agent-2',
                      'name': 'Calendar Agent',
                      'detail': 'paused · manual runs',
                    },
                  ],
                  'cancel_action': {
                    'type': 'assistant_pending_action',
                    'decision': 'cancel',
                    'pending_action_id': 'pending-1',
                    'label': 'Cancel',
                  },
                },
                onAction: (action) => submitted = action,
              ),
            ),
          ),
        ),
      );

      expect(find.text('Which agent should I delete?'), findsOneWidget);
      expect(find.text('Use Calendar Agent'), findsOneWidget);

      await tester.tap(
        find.byKey(const ValueKey('agent-selection-option-agent-1')),
      );
      await tester.pump();
      expect(find.text('Use News Agent'), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('confirm-agent-selection')));
      await tester.pump();
      expect(submitted, {
        'id': 'assistant_select_agent',
        'type': 'assistant_pending_action',
        'decision': 'assistant_select_agent',
        'pending_action_id': 'pending-1',
        'selected_agent_id': 'agent-1',
      });
      expect(
        find.byKey(const ValueKey('confirm-agent-selection')),
        findsNothing,
      );
      expect(
        find.byKey(const ValueKey('cancel-agent-selection')),
        findsNothing,
      );
      expect(find.text('Selected News Agent'), findsOneWidget);
    },
  );

  testWidgets('agent selection forwards its durable cancel action', (
    tester,
  ) async {
    Map<String, dynamic>? submitted;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AgentSelectionTemplate(
            data: {
              'question': 'Which agent should I pause?',
              'pending_action_id': 'pending-2',
              'options': const [],
              'cancel_action': {
                'type': 'assistant_pending_action',
                'decision': 'cancel',
                'pending_action_id': 'pending-2',
                'label': 'Skip',
              },
            },
            onAction: (action) => submitted = action,
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const ValueKey('cancel-agent-selection')));
    await tester.pump();
    expect(submitted?['decision'], 'cancel');
    expect(submitted?['pending_action_id'], 'pending-2');
    expect(find.byKey(const ValueKey('confirm-agent-selection')), findsNothing);
    expect(find.byKey(const ValueKey('cancel-agent-selection')), findsNothing);
    expect(find.text('Selection cancelled'), findsOneWidget);
  });

  testWidgets('resolved agent selections stay collapsed after refresh', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AgentSelectionTemplate(
            data: {
              'question': 'Which agent output should I use?',
              'pending_action_id': 'pending-3',
              'resolved': true,
              'resolution': 'selected',
              'selected_agent_name': 'DSA Practice Agent',
              'options': [],
            },
          ),
        ),
      ),
    );

    expect(find.text('Selected DSA Practice Agent'), findsOneWidget);
    expect(find.byKey(const ValueKey('confirm-agent-selection')), findsNothing);
    expect(find.byKey(const ValueKey('cancel-agent-selection')), findsNothing);
  });
}

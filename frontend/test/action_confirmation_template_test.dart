import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/widgets/templates/action_confirmation_template.dart';

void main() {
  testWidgets('low-confidence action stays blocked until the user confirms', (
    tester,
  ) async {
    Map<String, dynamic>? submitted;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 390,
            child: ActionConfirmationTemplate(
              data: const {
                'title': 'Confirm this action',
                'question': 'Is this what you want me to do?',
                'action_label': 'Read connected Gmail data',
                'action_detail':
                    'Use only that connected service to answer your request.',
                'context':
                    'I’m less than 80% confident, so nothing has run yet.',
                'actions': [
                  {
                    'id': 'assistant_confirm',
                    'type': 'assistant_pending_action',
                    'decision': 'confirm',
                    'pending_action_id': 'pending-1',
                    'label': 'Yes, continue',
                  },
                  {
                    'id': 'assistant_cancel',
                    'type': 'assistant_pending_action',
                    'decision': 'cancel',
                    'pending_action_id': 'pending-1',
                    'label': 'Cancel',
                  },
                ],
              },
              onAction: (action) => submitted = action,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Read connected Gmail data'), findsOneWidget);
    expect(find.textContaining('less than 80% confident'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey('confirm-low-confidence-action')),
    );
    expect(submitted?['decision'], 'confirm');
    expect(submitted?['pending_action_id'], 'pending-1');
  });

  testWidgets('low-confidence action can be cancelled without execution', (
    tester,
  ) async {
    Map<String, dynamic>? submitted;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ActionConfirmationTemplate(
            data: const {
              'action_label': 'Create a specialist agent',
              'actions': [
                {
                  'decision': 'cancel',
                  'pending_action_id': 'pending-2',
                  'label': 'Cancel',
                },
              ],
            },
            onAction: (action) => submitted = action,
          ),
        ),
      ),
    );

    await tester.tap(
      find.byKey(const ValueKey('cancel-low-confidence-action')),
    );
    expect(submitted?['decision'], 'cancel');
    expect(submitted?['pending_action_id'], 'pending-2');
  });
}

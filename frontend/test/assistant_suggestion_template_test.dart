import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/widgets/templates/assistant_suggestion_template.dart';

void main() {
  testWidgets('suggestion card exposes decisions and its explanation', (
    tester,
  ) async {
    Map<String, dynamic>? submitted;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AssistantSuggestionTemplate(
            data: const {
              'suggestion_id': 'suggestion-1',
              'title': 'Make this automatic?',
              'body': 'You made a similar request three times recently.',
              'primary_action': {
                'type': 'suggestion_decision',
                'decision': 'accept',
                'suggestion_id': 'suggestion-1',
                'label': 'Review and continue',
              },
              'secondary_actions': [
                {
                  'type': 'suggestion_decision',
                  'decision': 'not_now',
                  'suggestion_id': 'suggestion-1',
                  'label': 'Not now',
                },
                {
                  'type': 'suggestion_decision',
                  'decision': 'dismiss',
                  'suggestion_id': 'suggestion-1',
                  'label': 'Do not suggest this',
                },
              ],
              'explanation': {
                'summary': 'You requested this three times.',
                'data_categories': ['Activity inside Cuppet'],
              },
            },
            onAction: (action) => submitted = action,
          ),
        ),
      ),
    );

    expect(find.text('Make this automatic?'), findsOneWidget);
    expect(find.text('Why this appeared'), findsOneWidget);
    expect(find.textContaining('Activity inside Cuppet'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('suggestion-primary-action')));
    expect(submitted?['decision'], 'accept');
    expect(submitted?['suggestion_id'], 'suggestion-1');
  });

  testWidgets('resolved suggestion cards do not expose repeatable actions', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: AssistantSuggestionTemplate(
            data: {
              'suggestion_id': 'suggestion-2',
              'title': 'A resolved suggestion',
              'body': 'This is already resolved.',
              'resolved': true,
              'resolution': 'dismiss',
              'primary_action': {'label': 'Review and continue'},
              'secondary_actions': [
                {'label': 'Not now'},
              ],
            },
          ),
        ),
      ),
    );

    expect(
      find.byKey(const ValueKey('suggestion-primary-action')),
      findsNothing,
    );
    expect(
      find.text('Dismissed. I won’t repeat this suggestion.'),
      findsOneWidget,
    );
  });
}

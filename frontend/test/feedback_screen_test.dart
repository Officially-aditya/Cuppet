import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/design/app_theme.dart';
import 'package:sydney/screens/feedback/feedback_screen.dart';
import 'package:sydney/widgets/feedback_header_button.dart';

void main() {
  testWidgets('feedback form follows the Cuppet submission flow', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(theme: SydneyTheme.light, home: const FeedbackScreen()),
    );

    expect(find.text('Help shape Cuppet'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('feedback-message-field')),
      findsOneWidget,
    );
    expect(
      tester
          .widget<FilledButton>(
            find.byKey(const ValueKey('feedback-submit-button')),
          )
          .onPressed,
      isNull,
    );

    await tester.tap(
      find.byKey(const ValueKey('feedback-topic-General feedback')),
    );
    await tester.enterText(
      find.byKey(const ValueKey('feedback-message-field')),
      'The inbox is easy to scan.',
    );
    await tester.pump();

    expect(
      tester
          .widget<FilledButton>(
            find.byKey(const ValueKey('feedback-submit-button')),
          )
          .onPressed,
      isNotNull,
    );

    await tester.tap(find.byKey(const ValueKey('feedback-submit-button')));
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('feedback-confirmation')), findsOneWidget);
    expect(find.text('Thanks for helping Cuppet grow.'), findsOneWidget);
  });

  testWidgets('glass feedback header button invokes its action', (
    tester,
  ) async {
    var tapped = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: SydneyTheme.light,
        home: Scaffold(
          appBar: AppBar(
            actions: [
              FeedbackHeaderButton(
                key: const ValueKey('feedback-header-test-button'),
                onPressed: () => tapped = true,
              ),
            ],
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const ValueKey('feedback-header-test-button')));

    expect(tapped, isTrue);
    expect(find.text('Feedback'), findsOneWidget);
  });
}

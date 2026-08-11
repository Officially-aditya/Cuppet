import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/design/app_theme.dart';
import 'package:sydney/providers/feedback_provider.dart';
import 'package:sydney/screens/feedback/feedback_screen.dart';
import 'package:sydney/services/api.dart';
import 'package:sydney/services/feedback_service.dart';
import 'package:sydney/widgets/feedback_header_button.dart';

class _FakeFeedbackService extends FeedbackService {
  _FakeFeedbackService()
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  String? submittedTopic;
  String? submittedMessage;

  @override
  Future<void> submitFeedback({
    required String topic,
    required String message,
  }) async {
    submittedTopic = topic;
    submittedMessage = message;
  }
}

void main() {
  testWidgets('feedback form follows the Cuppet submission flow', (
    tester,
  ) async {
    final service = _FakeFeedbackService();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [feedbackServiceProvider.overrideWithValue(service)],
        child: MaterialApp(
          theme: SydneyTheme.light,
          home: const FeedbackScreen(),
        ),
      ),
    );

    expect(find.text('Help shape Cuppet'), findsOneWidget);
    expect(find.text('Feedback'), findsNothing);
    expect(find.text('A thoughtful note goes a long way'), findsNothing);
    expect(find.byKey(const ValueKey('feedback-back-button')), findsOneWidget);
    expect(find.byIcon(Icons.arrow_back_rounded), findsNothing);
    expect(find.byIcon(Icons.send_rounded), findsNothing);
    expect(find.byIcon(Icons.check_rounded), findsNothing);
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
    expect(find.byIcon(Icons.check_rounded), findsNothing);
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
    expect(service.submittedTopic, 'general_feedback');
    expect(service.submittedMessage, 'The inbox is easy to scan.');
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
    expect(find.byIcon(Icons.rate_review_outlined), findsNothing);
  });
}

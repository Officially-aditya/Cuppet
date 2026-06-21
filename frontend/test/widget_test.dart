import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sydney/widgets/templates/plain_text_template.dart';
import 'package:sydney/widgets/templates/news_brief_template.dart';
import 'package:sydney/widgets/sydney_primitives.dart';
import 'package:sydney/screens/create/create_screen.dart';

void main() {
  testWidgets('plain text template renders message text', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PlainTextTemplate(data: {'text': 'Sydney is ready.'}),
        ),
      ),
    );

    expect(find.text('Sydney is ready.'), findsOneWidget);
  });

  testWidgets('markdown text renders bold markers without leaking asterisks', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: MarkdownText(
            text: '**Action Required**: Review this **today** please **',
          ),
        ),
      ),
    );

    final richText = tester.widget<RichText>(find.byType(RichText));
    final plainText = richText.text.toPlainText();

    expect(plainText, 'Action Required: Review this today please');
    expect(plainText.contains('**'), isFalse);
  });

  testWidgets('news brief merges an empty detail label with its value', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: NewsBriefTemplate(
            data: {
              'title': 'Daily LeetCode Practice',
              'items': [
                {'headline': 'Focus', 'summary': '**'},
                {
                  'headline': 'Using a Hash Set to',
                  'summary': 'track seen elements.',
                },
                {
                  'headline': 'Problem 2 (Medium)',
                  'summary': 'Longest Substring Without Repeating Characters',
                },
              ],
            },
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.expand_more_rounded), findsNWidgets(2));
    expect(find.text('Focus'), findsOneWidget);

    await tester.tap(find.text('Focus'));
    await tester.pumpAndSettle();

    final visibleText = tester
        .widgetList<RichText>(find.byType(RichText))
        .map((widget) => widget.text.toPlainText())
        .join('\n');
    expect(visibleText, contains('Using a Hash Set to track seen elements.'));
  });

  testWidgets('email template remains Gmail-only', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: CreateScreen()));

    await tester.ensureVisible(find.text('Email agent'));
    await tester.tap(find.text('Email agent'));
    await tester.pump();

    await tester.fling(find.byType(ListView), const Offset(0, 1000), 1000);
    await tester.pumpAndSettle();

    final editor = tester.widget<TextField>(find.byType(TextField).first);
    final prompt = editor.controller!.text;
    expect(prompt, contains('Use only Gmail data'));
    expect(prompt.toLowerCase(), isNot(contains('calendar')));
  });

  testWidgets('GitHub template is read-only and GitHub-specific', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: CreateScreen()));

    await tester.scrollUntilVisible(
      find.text('GitHub agent'),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('GitHub agent'));
    await tester.pump();

    await tester.fling(find.byType(ListView), const Offset(0, 1000), 1000);
    await tester.pumpAndSettle();

    final editor = tester.widget<TextField>(find.byType(TextField).first);
    final prompt = editor.controller!.text.toLowerCase();
    expect(prompt, contains('use only github data'));
    expect(prompt, contains('do not create, edit, merge, or close anything'));
  });
}

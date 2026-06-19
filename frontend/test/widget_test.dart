import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sydney/widgets/templates/plain_text_template.dart';
import 'package:sydney/widgets/sydney_primitives.dart';

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
}

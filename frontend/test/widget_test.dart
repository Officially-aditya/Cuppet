import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sydney/widgets/templates/plain_text_template.dart';

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
}

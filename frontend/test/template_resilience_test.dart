import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/screens/auth/sign_in_screen.dart';
import 'package:sydney/screens/auth/sign_up_screen.dart';
import 'package:sydney/widgets/templates/checklist_template.dart';
import 'package:sydney/widgets/templates/comparison_template.dart';
import 'package:sydney/widgets/templates/data_summary_template.dart';
import 'package:sydney/widgets/templates/news_brief_template.dart';
import 'package:sydney/widgets/templates/progress_tracker_template.dart';

Widget templateHost(Widget child) {
  return MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));
}

void main() {
  group('template payload resilience', () {
    testWidgets('empty payloads render useful fallback content', (
      tester,
    ) async {
      final cases = <(Widget, String)>[
        (const ChecklistTemplate(data: {}), 'Checklist'),
        (const ComparisonTemplate(data: {}), 'Comparison'),
        (const DataSummaryTemplate(data: {}), 'SUMMARY'),
        (const NewsBriefTemplate(data: {}), 'Update'),
      ];

      for (final (template, fallback) in cases) {
        await tester.pumpWidget(templateHost(template));
        await tester.pump();
        expect(find.text(fallback), findsOneWidget);
      }
    });

    testWidgets('non-list collection fields are ignored instead of throwing', (
      tester,
    ) async {
      await tester.pumpWidget(
        templateHost(
          const DataSummaryTemplate(
            data: {
              'title': 'Malformed summary',
              'items': 'not-a-list',
              'metrics': 42,
            },
          ),
        ),
      );
      expect(find.text('MALFORMED SUMMARY'), findsOneWidget);

      await tester.pumpWidget(
        templateHost(
          const ComparisonTemplate(
            data: {'title': 'Malformed comparison', 'rows': 'not-a-list'},
          ),
        ),
      );
      expect(find.text('No comparison rows yet.'), findsOneWidget);
    });

    testWidgets('mixed JSON lists retain only map-shaped template entries', (
      tester,
    ) async {
      await tester.pumpWidget(
        templateHost(
          const ComparisonTemplate(
            data: {
              'rows': [
                'invalid',
                17,
                {
                  'label': 'Acme',
                  'changes': ['Launched a feature'],
                },
              ],
            },
          ),
        ),
      );

      expect(find.text('Acme'), findsOneWidget);
      expect(find.text('Launched a feature'), findsOneWidget);
      expect(find.text('invalid'), findsNothing);
    });

    testWidgets('news brief expansion reveals and hides additional items', (
      tester,
    ) async {
      await tester.pumpWidget(
        templateHost(
          const NewsBriefTemplate(
            data: {
              'initial_item_count': 1,
              'items': [
                {'summary': 'First item'},
                {'summary': 'Second item'},
              ],
            },
          ),
        ),
      );

      expect(find.text('First item'), findsOneWidget);
      expect(find.text('Second item'), findsNothing);
      await tester.tap(find.text('Show more (1 remaining)'));
      await tester.pumpAndSettle();
      expect(find.text('Second item'), findsOneWidget);
      await tester.tap(find.text('Show less'));
      await tester.pumpAndSettle();
      expect(find.text('Second item'), findsNothing);
    });

    testWidgets('progress tracker tolerates malformed steps', (tester) async {
      await tester.pumpWidget(
        templateHost(
          const ProgressTrackerTemplate(
            data: {
              'title': 'Progress',
              'total': 2,
              'current': 0,
              'steps': ['invalid', 2],
            },
          ),
        ),
      );

      expect(find.text('Progress'), findsWidgets);
    });
  });

  group('authentication defaults', () {
    testWidgets('sign-in fields never ship with preset credentials', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(1200, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        const ProviderScope(child: MaterialApp(home: SignInScreen())),
      );
      await tester.tap(find.text('Sign in with Email'));
      await tester.pumpAndSettle();

      final fields = tester.widgetList<TextFormField>(
        find.byType(TextFormField),
      );
      expect(fields, hasLength(2));
      expect(
        fields.every((field) => field.controller?.text.isEmpty ?? true),
        isTrue,
      );
    });

    testWidgets(
      'sign-up fields never ship with preset identity or credentials',
      (tester) async {
        tester.view.physicalSize = const Size(1200, 1600);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          const ProviderScope(child: MaterialApp(home: SignUpScreen())),
        );
        await tester.pumpAndSettle();

        final fields = tester.widgetList<TextFormField>(
          find.byType(TextFormField),
        );
        expect(fields, hasLength(4));
        expect(
          fields.every((field) => field.controller?.text.isEmpty ?? true),
          isTrue,
        );
      },
    );
  });
}

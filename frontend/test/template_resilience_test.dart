import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/screens/auth/sign_in_screen.dart';
import 'package:sydney/screens/auth/sign_up_screen.dart';
import 'package:sydney/widgets/templates/checklist_template.dart';
import 'package:sydney/widgets/templates/comparison_template.dart';
import 'package:sydney/widgets/templates/data_summary_template.dart';
import 'package:sydney/widgets/templates/dsa_question_template.dart';
import 'package:sydney/widgets/templates/news_brief_template.dart';
import 'package:sydney/widgets/templates/progress_tracker_template.dart';
import 'package:sydney/widgets/templates/briefing_card_template.dart';

Widget templateHost(Widget child) {
  return MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));
}

void main() {
  group('template payload resilience', () {
    testWidgets('briefing card opens from its full tappable surface', (
      tester,
    ) async {
      var opened = false;
      await tester.pumpWidget(
        templateHost(
          BriefingCardTemplate(
            data: const {
              'eyebrow': 'PROJECT PULSE',
              'title': 'What moved',
              'summary': '2 sources checked',
              'sections': [
                {
                  'id': 'github',
                  'title': 'GitHub',
                  'source': 'GitHub',
                  'tone': 'positive',
                  'items': [
                    {'title': 'Sydney received a new commit'},
                  ],
                },
              ],
            },
            onOpen: () => opened = true,
          ),
        ),
      );

      expect(find.text('PROJECT PULSE'), findsOneWidget);
      expect(find.text('GitHub'), findsOneWidget);
      expect(find.text('Sydney received a new commit'), findsOneWidget);
      expect(find.text('Open in Assistant'), findsOneWidget);
      await tester.tap(
        find.byKey(const ValueKey('open_briefing_in_assistant')),
      );
      expect(opened, isTrue);
      expect(tester.takeException(), isNull);
    });

    testWidgets('compact briefing shows at most three highlights', (
      tester,
    ) async {
      var opened = false;
      await tester.pumpWidget(
        templateHost(
          BriefingCardTemplate(
            compact: true,
            data: const {
              'eyebrow': 'DAILY BRIEFING',
              'title': 'Your morning overview',
              'summary': 'Calendar and inbox checked',
              'sections': [
                {
                  'title': 'Calendar',
                  'items': [
                    {'title': 'Design review at 10:00'},
                    {'title': 'Customer call at 14:00'},
                  ],
                },
                {
                  'title': 'Gmail',
                  'items': [
                    {'title': 'Contract needs approval'},
                    {'title': 'Fourth detail stays in the full report'},
                  ],
                },
              ],
            },
            onOpen: () => opened = true,
          ),
        ),
      );

      expect(find.text('Design review at 10:00'), findsOneWidget);
      expect(find.text('Customer call at 14:00'), findsOneWidget);
      expect(find.text('Contract needs approval'), findsOneWidget);
      expect(find.text('Fourth detail stays in the full report'), findsNothing);
      expect(find.text('Open in Assistant'), findsNothing);
      await tester.tap(
        find.byKey(const ValueKey('open_briefing_in_assistant')),
      );
      expect(opened, isTrue);
      expect(tester.takeException(), isNull);
    });

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
              'initialItemCount': 1,
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

    testWidgets(
      'DSA question presents generated practice details in sections',
      (tester) async {
        await tester.pumpWidget(
          templateHost(
            const DsaQuestionTemplate(
              data: {
                'title': 'Longest Palindromic Subsequence',
                'difficulty': 'Medium',
                'problem': 'Find the longest palindromic subsequence.',
                'constraints': '1 <= s.length <= 1000',
                'time_complexity': 'O(n^2)',
                'space_complexity': 'O(n^2)',
                'approach': 'Dynamic programming',
                'examples': [
                  {
                    'input': 's = "bbbab"',
                    'output': '4',
                    'explanation': 'The subsequence is "bbbb".',
                  },
                ],
              },
            ),
          ),
        );

        expect(find.text('PROBLEM DESCRIPTION'), findsOneWidget);
        expect(find.text('STRUCTURED EXAMPLES'), findsOneWidget);
        expect(find.text('CONSTRAINTS'), findsOneWidget);
        expect(find.text('COMPLEXITY'), findsOneWidget);
        expect(find.text('O(n^2)'), findsNWidgets(2));
        expect(find.text('Dynamic programming'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'news brief emphasizes a lead story and labels compact updates',
      (tester) async {
        await tester.pumpWidget(
          templateHost(
            const NewsBriefTemplate(
              data: {
                'title': 'Morning news',
                'items': [
                  {'summary': 'Here is your morning briefing.'},
                  {
                    'headline': 'New AI safety standards proposed',
                    'summary': 'Industry leaders proposed shared benchmarks.',
                  },
                  {
                    'headline': 'Government publishes policy blueprint',
                    'summary': 'The proposal enters public consultation.',
                  },
                ],
              },
            ),
          ),
        );

        expect(
          find.byKey(const ValueKey('news-featured-story')),
          findsOneWidget,
        );
        expect(find.text('TOP STORY'), findsOneWidget);
        expect(find.text('AI'), findsOneWidget);
        expect(find.text('POLICY'), findsOneWidget);
        expect(
          find.text('Industry leaders proposed shared benchmarks.'),
          findsOneWidget,
        );
        expect(
          find.text('The proposal enters public consultation.').hitTestable(),
          findsNothing,
        );

        await tester.tap(find.text('Government publishes policy blueprint'));
        await tester.pumpAndSettle();
        expect(
          find.text('The proposal enters public consultation.').hitTestable(),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'GitHub activity uses a connected timeline for multiple updates',
      (tester) async {
        await tester.pumpWidget(
          templateHost(
            const DataSummaryTemplate(
              data: {
                'kind': 'github_activity',
                'title': 'Daily GitHub digest',
                'metrics': [
                  {'label': 'Commits', 'value': '2'},
                  {'label': 'Open PRs', 'value': '1'},
                ],
                'timeline': [
                  {
                    'title': 'Improve news presentation',
                    'repository': 'Officially-aditya/Sydney',
                    'timestamp': '2026-07-15T09:30:00Z',
                    'type': 'commit',
                  },
                  {
                    'title': 'Fix account cache isolation',
                    'repository': 'Officially-aditya/Sydney',
                    'timestamp': '2026-07-15T08:30:00Z',
                    'type': 'commit',
                  },
                ],
                'footer': 'Read-only GitHub digest.',
              },
            ),
          ),
        );

        expect(find.text('GITHUB ACTIVITY DIGEST'), findsOneWidget);
        expect(find.text('Improve news presentation'), findsOneWidget);
        expect(find.text('Fix account cache isolation'), findsOneWidget);
        expect(find.text('Officially-aditya/Sydney'), findsNWidgets(2));
        expect(find.text('Read-only GitHub digest.'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

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

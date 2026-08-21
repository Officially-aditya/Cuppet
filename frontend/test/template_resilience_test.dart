import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/design/tokens.dart';
import 'package:sydney/models/message.dart';
import 'package:sydney/models/template_payload_recovery.dart';
import 'package:sydney/screens/auth/email_sign_in_screen.dart';
import 'package:sydney/screens/auth/sign_up_screen.dart';
import 'package:sydney/widgets/templates/checklist_template.dart';
import 'package:sydney/widgets/templates/comparison_template.dart';
import 'package:sydney/widgets/templates/data_summary_template.dart';
import 'package:sydney/widgets/templates/dsa_question_template.dart';
import 'package:sydney/widgets/templates/github_activity_template.dart';
import 'package:sydney/widgets/templates/news_brief_template.dart';
import 'package:sydney/widgets/templates/progress_tracker_template.dart';
import 'package:sydney/widgets/templates/briefing_card_template.dart';
import 'package:sydney/widgets/connectors/connector_list_item.dart';
import 'package:sydney/widgets/thread/message_card.dart';

Widget templateHost(Widget child) {
  return MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));
}

void main() {
  group('template payload resilience', () {
    test('top-level raw JSON values remain visible as plain text', () {
      final listMessage = Message.fromJson({
        'id': 'raw-list',
        'agent_id': 'agent',
        'role': 'agent',
        'content': [
          {'title': 'Raw result'},
        ],
      });
      final scalarMessage = Message.fromJson({
        'id': 'raw-scalar',
        'agent_id': 'agent',
        'role': 'agent',
        'content': 17,
      });

      expect(listMessage.template, 'plain_text');
      expect(listMessage.data['text'], '[{"title":"Raw result"}]');
      expect(scalarMessage.template, 'plain_text');
      expect(scalarMessage.data['text'], '17');
    });

    test(
      'raw payload recovery keeps presentation metadata and rejects actions',
      () {
        const presentation = {
          'group_id': 'raw-output-group',
          'part_index': 0,
          'part_count': 2,
        };
        final actionPayload = Message.fromJson({
          'id': 'raw-action',
          'agent_id': 'agent',
          'role': 'agent',
          'content':
              '{"template":"daily_task","data":{"title":"Take action","task":"Do this","actions":[]}}',
        });
        final recoveredPayload = Message.fromJson({
          'id': 'raw-content-extractor',
          'agent_id': 'agent',
          'role': 'agent',
          'content': {
            'template': 'plain_text',
            'presentation': presentation,
            'data': {
              'body':
                  '{"template":"content_extractor","data":{"ideas":[{"title":"Recovered idea","hook":"A useful hook"}]}}',
            },
          },
        });

        expect(actionPayload.template, 'plain_text');
        expect(actionPayload.isRecoveredRawPayload, isFalse);
        expect(actionPayload.data['text'], contains('daily_task'));

        expect(recoveredPayload.template, 'content_extractor');
        expect(recoveredPayload.isRecoveredRawPayload, isTrue);
        expect(recoveredPayload.isMultipart, isTrue);
        expect(recoveredPayload.presentation['group_id'], 'raw-output-group');
      },
    );

    testWidgets('recovered raw payloads cannot invoke message actions', (
      tester,
    ) async {
      final message = Message.fromJson({
        'id': 'display-only-recovery',
        'agent_id': 'agent',
        'role': 'agent',
        'content':
            '{"template":"content_extractor","presentation":{"group_id":"stringified-group","part_index":0,"part_count":2},"data":{"ideas":[{"title":"Recovered idea","hook":"A useful hook"}]}}',
      });
      var actionInvoked = false;

      expect(message.isMultipart, isTrue);

      await tester.pumpWidget(
        templateHost(
          MessageCard(message: message, onAction: (_) => actionInvoked = true),
        ),
      );

      expect(tester.widget<InkWell>(find.byType(InkWell)).onTap, isNull);
      await tester.tap(find.text('Recovered idea'));
      await tester.pump();

      expect(actionInvoked, isFalse);
    });

    testWidgets('news JSON embedded in a summary is restored before rendering', (
      tester,
    ) async {
      const rawJson =
          '{"tldr":["First signal","Second signal","Third signal"],'
          '"items":[{"headline":"AI model released",'
          '"summary":"A grounded account of the release.",'
          '"source":"Example"}],'
          '"why_it_matters":"The release changes the competitive landscape."}';
      final message = Message(
        id: 'malformed-news',
        threadId: 'news-thread',
        sender: MessageSender.agent,
        createdAt: DateTime(2026, 7, 18),
        content: const {
          'template': 'news_brief',
          'data': {
            'title': "Here's the news you requested.",
            'items': [
              {'summary': rawJson},
            ],
          },
        },
      );

      await tester.pumpWidget(
        templateHost(NewsBriefTemplate(data: message.data)),
      );

      expect(find.text('TL;DR'), findsOneWidget);
      expect(find.text('AI model released'), findsOneWidget);
      expect(find.textContaining('{"tldr"'), findsNothing);
      expect(
        find.text('The release changes the competitive landscape.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    });

    test('truncated news JSON retains complete stories', () {
      const rawJson =
          '{"tldr":["One","Two","Three"],"items":['
          '{"headline":"Complete story","summary":"Complete summary"},'
          '{"headline":"Cut off","summary":"unfinished';
      final recovered = recoverTemplatePayload('news_brief', {
        'title': 'News',
        'items': [
          {'summary': rawJson},
        ],
      });

      expect(recovered['tldr'], ['One', 'Two', 'Three']);
      expect(recovered['items'], [
        {'headline': 'Complete story', 'summary': 'Complete summary'},
      ]);
    });

    test('wholly truncated news JSON becomes a readable retry message', () {
      const rawJson =
          '{"tldr":["unfinished"],"items":['
          '{"headline":"Cut off","summary":"';
      final recovered = recoverTemplatePayload('news_brief', {
        'title': 'News',
        'items': [
          {'summary': rawJson},
        ],
      });

      final summary = (recovered['items'] as List).first['summary'].toString();
      expect(summary, contains('couldn’t assemble a complete'));
      expect(summary, isNot(contains('{"tldr"')));
    });

    test(
      'other model-backed renderer payloads use the same recovery boundary',
      () {
        final content = recoverTemplatePayload('content_extractor', {
          'ideas': [
            {
              'title': 'raw',
              'hook':
                  '{"ideas":[{"title":"Recovered idea","hook":"Useful hook"}]}',
            },
          ],
        });
        final briefing = recoverTemplatePayload('briefing_card', {
          'title': 'Briefing',
          'sections': [
            {
              'title': 'raw',
              'items': [
                {
                  'title':
                      '{"title":"Recovered briefing","sections":['
                      '{"title":"Inbox","items":[{"title":"Reply today"}]}]}',
                },
              ],
            },
          ],
        });

        expect((content['ideas'] as List).first['title'], 'Recovered idea');
        expect((briefing['sections'] as List).first['title'], 'Inbox');
      },
    );

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

    testWidgets('briefing titles hide markdown bold markers', (tester) async {
      await tester.pumpWidget(
        templateHost(
          const BriefingCardTemplate(
            data: {
              'title': '**Your day, distilled**',
              'sections': [
                {
                  'title': '**Calendar**',
                  'items': [
                    {'title': '**Design review at 10:00**'},
                  ],
                },
              ],
            },
          ),
        ),
      );

      expect(find.text('Your day, distilled'), findsOneWidget);
      expect(find.text('Calendar'), findsOneWidget);
      expect(find.text('Design review at 10:00'), findsOneWidget);
      expect(find.text('**Your day, distilled**'), findsNothing);
      expect(find.text('**Calendar**'), findsNothing);
      expect(find.text('**Design review at 10:00**'), findsNothing);
    });

    testWidgets('compact briefing shows concise updates with source logos', (
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
                    {'title': 'Design review at 10:00', 'detail': 'Room 4B'},
                    {'title': 'Customer call at 14:00'},
                  ],
                },
                {
                  'title': 'Gmail',
                  'items': [
                    {
                      'title': 'Contract needs approval',
                      'detail': 'From Legal · due today',
                    },
                    {'title': 'Fourth detail stays in the full report'},
                  ],
                },
                {
                  'title': 'Slack',
                  'items': [
                    {'title': 'No notable updates found.'},
                  ],
                },
              ],
            },
            onOpen: () => opened = true,
          ),
        ),
      );

      expect(find.text('Calendar and inbox checked'), findsNothing);
      expect(
        find.textContaining('Calendar: Design review at 10:00'),
        findsOneWidget,
      );
      expect(find.text('Customer call at 14:00'), findsNothing);
      expect(find.textContaining('Room 4B'), findsOneWidget);
      expect(
        find.textContaining('Gmail: Contract needs approval'),
        findsOneWidget,
      );
      expect(find.textContaining('From Legal · due today'), findsOneWidget);
      expect(find.text('Fourth detail stays in the full report'), findsNothing);
      expect(find.byType(ConnectorIcon), findsNWidgets(2));
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

    testWidgets('news brief renders every item without a show-more control', (
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
      expect(find.text('Second item'), findsOneWidget);
      expect(find.textContaining('Show more'), findsNothing);
      expect(find.text('Show less'), findsNothing);
    });

    testWidgets('DSA question presents generated practice details in sections', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
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
              'references': [
                {
                  'title': 'LeetCode: Longest Palindromic Subsequence',
                  'url':
                      'https://leetcode.com/problems/longest-palindromic-subsequence/',
                },
              ],
            },
          ),
        ),
      );

      expect(
        find.byKey(const ValueKey('dsa-question-content')),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('dsa-example-rule-0')), findsOneWidget);
      expect(find.text('Problem Description'), findsOneWidget);
      expect(find.text('Structured Examples'), findsOneWidget);
      expect(find.text('Constraints'), findsOneWidget);
      expect(find.text('Complexity'), findsOneWidget);
      expect(find.text('LeetCode'), findsOneWidget);
      expect(find.text('Example 1:'), findsOneWidget);
      expect(
        find.textContaining('O(n^2)', findRichText: true),
        findsNWidgets(2),
      );
      expect(find.text('Dynamic programming'), findsOneWidget);

      final constraintsPanel = tester.widget<Container>(
        find.byKey(const ValueKey('dsa-constraints-panel')),
      );
      final constraintsDecoration =
          constraintsPanel.decoration! as BoxDecoration;
      expect(constraintsDecoration.color, SydneyColors.surfaceContainerHigh);
      expect(constraintsDecoration.border, isNull);

      final complexityPanel = tester.widget<Container>(
        find.byKey(const ValueKey('dsa-complexity-panel')),
      );
      final complexityDecoration = complexityPanel.decoration! as BoxDecoration;
      expect(complexityDecoration.color, SydneyColors.surfaceContainerHigh);
      expect(complexityDecoration.border, isNull);
      expect(
        tester.getTopLeft(find.byKey(const ValueKey('dsa-approach'))).dy,
        greaterThan(
          tester
              .getBottomLeft(find.byKey(const ValueKey('dsa-complexity-panel')))
              .dy,
        ),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('DSA uses a normal message bubble and example-only rules', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: MessageCard(
              message: Message(
                id: 'dsa-message',
                threadId: 'dsa-thread',
                sender: MessageSender.agent,
                createdAt: DateTime(2026, 7, 15),
                content: const {
                  'template': 'dsa_question',
                  'data': {
                    'title': 'Add Two Numbers',
                    'difficulty': 'Medium',
                    'problem': 'Add the represented numbers.',
                    'examples': [
                      {
                        'input': 'l1 = [2,4,3], l2 = [5,6,4]',
                        'output': '[7,0,8]',
                        'explanation': '342 + 465 = 807.',
                      },
                    ],
                  },
                },
              ),
            ),
          ),
        ),
      );

      final surface = tester.widget<Container>(
        find.byKey(const ValueKey('message-surface-dsa-message')),
      );
      final surfaceDecoration = surface.decoration! as BoxDecoration;
      expect(surfaceDecoration.color, SydneyColors.agentBubble);
      expect(surfaceDecoration.border, isNotNull);
      expect(surface.padding, const EdgeInsets.all(SydneySpacing.lg));

      final exampleRule = tester.widget<Container>(
        find.byKey(const ValueKey('dsa-example-rule-0')),
      );
      expect(exampleRule.color, SydneyColors.primary);
      final ruleSize = tester.getSize(
        find.byKey(const ValueKey('dsa-example-rule-0')),
      );
      expect(ruleSize.width, 3);
      expect(ruleSize.height, greaterThan(40));
      expect(
        tester.getTopLeft(find.text('Example 1:')).dy,
        lessThan(
          tester
              .getTopLeft(find.byKey(const ValueKey('dsa-example-rule-0')))
              .dy,
        ),
      );
      expect(tester.takeException(), isNull);
    });

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
        tester.view.physicalSize = const Size(360, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          templateHost(
            const DataSummaryTemplate(
              data: {
                'kind': 'github_activity',
                'title': 'Daily GitHub digest',
                'metrics': [
                  {'label': 'Repositories', 'value': '8'},
                  {'label': 'Commits', 'value': '2'},
                  {'label': 'Open PRs', 'value': '1'},
                  {'label': 'Open issues', 'value': '0'},
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
        expect(find.text('COMMIT'), findsNWidgets(2));
        expect(find.text('Officially-aditya/Sydney'), findsOneWidget);
        expect(find.text('2 updates'), findsOneWidget);
        expect(find.text('Read-only GitHub digest.'), findsOneWidget);
        final metricTops =
            [
              '8',
              '2',
              '1',
              '0',
            ].map((value) => tester.getTopLeft(find.text(value)).dy).toList();
        expect(metricTops.toSet(), hasLength(1));
        expect(tester.takeException(), isNull);
      },
    );

    test('GitHub timeline groups only updates from the same repository', () {
      final groups = groupGitHubTimeline(<Map<String, dynamic>>[
        {'title': 'First update', 'repository': 'Officially-aditya/Sydney'},
        {'title': 'Second update', 'repository': 'officially-aditya/sydney'},
        {
          'title': 'Other repository update',
          'repository': 'Officially-aditya/Other',
        },
      ]);

      expect(groups, hasLength(2));
      expect(groups.first.repository, 'Officially-aditya/Sydney');
      expect(groups.first.updates, hasLength(2));
      expect(groups.last.repository, 'Officially-aditya/Other');
      expect(groups.last.updates, hasLength(1));
    });

    testWidgets(
      'GitHub activity identifies update types and keeps dates visible',
      (tester) async {
        tester.view.physicalSize = const Size(360, 1000);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day, 9, 30);
        final yesterday = today.subtract(const Duration(days: 1));
        final older = today.subtract(const Duration(days: 4));
        const monthLabels = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];

        await tester.pumpWidget(
          templateHost(
            DataSummaryTemplate(
              data: {
                'kind': 'github_activity',
                'title': 'Repository activity',
                'timeline': [
                  {
                    'title': 'Ship the latest change',
                    'timestamp': today.toUtc().toIso8601String(),
                    'type': 'commit',
                  },
                  {
                    'title': 'Review the open fix',
                    'timestamp': yesterday.toUtc().toIso8601String(),
                    'type': 'pull_request',
                  },
                  {
                    'title': 'Repository metadata changed',
                    'timestamp': older.toUtc().toIso8601String(),
                    'type': 'repository',
                  },
                  {
                    'title': 'Investigate regression',
                    'timestamp': older.toUtc().toIso8601String(),
                    'type': 'issue',
                  },
                ],
              },
            ),
          ),
        );

        expect(find.text('COMMIT'), findsOneWidget);
        expect(find.text('PULL REQUEST'), findsOneWidget);
        expect(find.text('REPOSITORY'), findsOneWidget);
        expect(find.text('ISSUE'), findsOneWidget);
        expect(find.textContaining('Today •'), findsOneWidget);
        expect(find.textContaining('Yesterday •'), findsOneWidget);
        expect(
          find.textContaining('${monthLabels[older.month - 1]} ${older.day} •'),
          findsNWidgets(2),
        );
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'Gmail digest keeps four metrics on one row and expands message previews',
      (tester) async {
        tester.view.physicalSize = const Size(360, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          templateHost(
            const DataSummaryTemplate(
              data: {
                'kind': 'gmail_digest',
                'title': 'Daily inbox digest',
                'metrics': [
                  {'label': 'Messages', 'value': '8'},
                  {'label': 'Needs review', 'value': '2'},
                  {'label': 'Replies', 'value': '1'},
                  {'label': 'Finance', 'value': '1'},
                ],
                'messages': [
                  {
                    'id': 'mail-1',
                    'subject':
                        'A long security notice that still fits a narrow phone',
                    'sender': 'Cuppet Security',
                    'preview': 'Please verify this sign-in immediately.',
                    'timestamp': '2026-07-15T09:30:00Z',
                    'category': 'attention',
                  },
                  {
                    'id': 'mail-2',
                    'subject': 'Can you review the launch copy?',
                    'sender': 'Product team',
                    'preview': 'The draft is ready for your comments.',
                    'timestamp': '2026-07-15T08:30:00Z',
                    'category': 'reply',
                  },
                ],
                'footer': 'Read-only Gmail digest.',
              },
            ),
          ),
        );

        expect(find.text('GMAIL DIGEST'), findsOneWidget);
        expect(find.text('Cuppet Security'), findsOneWidget);
        expect(find.text('ATTENTION'), findsOneWidget);
        expect(find.text('REPLY'), findsOneWidget);
        expect(
          find.text('Please verify this sign-in immediately.'),
          findsNothing,
        );
        final metricTops = [
          tester.getTopLeft(find.text('8')).dy,
          tester.getTopLeft(find.text('2')).dy,
          tester.getTopLeft(find.text('1').at(0)).dy,
          tester.getTopLeft(find.text('1').at(1)).dy,
        ];
        expect(metricTops.toSet(), hasLength(1));

        await tester.tap(find.byKey(const ValueKey('gmail-message-mail-1')));
        await tester.pumpAndSettle();
        expect(
          find.text('Please verify this sign-in immediately.'),
          findsOneWidget,
        );
        expect(find.text('Read-only Gmail digest.'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('Gmail digest tolerates malformed message collections', (
      tester,
    ) async {
      await tester.pumpWidget(
        templateHost(
          const DataSummaryTemplate(
            data: {
              'kind': 'gmail_digest',
              'title': 'Mailbox highlights',
              'messages': 'not-a-list',
            },
          ),
        ),
      );

      expect(
        find.text('There’s nothing to show for this update.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
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
        const ProviderScope(child: MaterialApp(home: EmailSignInScreen())),
      );
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

    testWidgets('AllClearTemplate renders reassuring outcome message and expandable details', (tester) async {
      await tester.pumpWidget(
        templateHost(
          MessageCard(
            message: Message(
              id: 'all-clear-1',
              threadId: 'thread-1',
              sender: MessageSender.agent,
              createdAt: DateTime.now(),
              content: {
                'template': 'all_clear',
                'data': {
                  'message': 'Nothing in your inbox needs your attention right now.',
                  'details': {
                    'source': 'Gmail',
                    'itemsChecked': 0,
                    'readOnly': true,
                  },
                },
              },
            ),
          ),
        ),
      );

      expect(
        find.text('Nothing in your inbox needs your attention right now.'),
        findsOneWidget,
      );
      expect(find.text('Sources and access'), findsOneWidget);
    });
  });
}

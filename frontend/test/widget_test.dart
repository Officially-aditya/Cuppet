import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sydney/models/agent_recipe.dart';
import 'package:sydney/providers/agents_provider.dart';
import 'package:sydney/services/agent_service.dart';
import 'package:sydney/services/api.dart';
import 'package:sydney/widgets/templates/plain_text_template.dart';
import 'package:sydney/widgets/templates/news_brief_template.dart';
import 'package:sydney/widgets/templates/daily_task_template.dart';
import 'package:sydney/widgets/templates/study_guide_template.dart';
import 'package:sydney/widgets/templates/dsa_question_template.dart';
import 'package:sydney/widgets/sydney_primitives.dart';
import 'package:sydney/screens/create/create_screen.dart';
import 'package:sydney/models/connector.dart';
import 'package:sydney/widgets/connectors/connector_list_item.dart';

class _CreationRecipeAgentService extends AgentService {
  _CreationRecipeAgentService()
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  @override
  Future<List<AgentRecipe>> listRecipes() async => const [
    AgentRecipe(
      id: 'email_digest',
      version: 1,
      promptProfileVersion: 1,
      name: 'Email agent',
      description: 'Summarizes Gmail.',
      icon: 'mail',
      examplePrompt:
          'Create a Gmail digest. Use only Gmail data and prioritize replies.',
      requiredConnectors: ['gmail'],
      fields: [],
    ),
    AgentRecipe(
      id: 'github_activity_digest',
      version: 1,
      promptProfileVersion: 1,
      name: 'GitHub agent',
      description: 'Summarizes GitHub activity.',
      icon: 'github',
      examplePrompt:
          'Create a GitHub digest. Use only GitHub data. Do not create, edit, merge, or close anything.',
      requiredConnectors: ['github'],
      fields: [],
    ),
  ];
}

Widget _createScreenUnderTest() {
  return ProviderScope(
    overrides: [
      agentServiceProvider.overrideWithValue(_CreationRecipeAgentService()),
    ],
    child: const MaterialApp(home: CreateScreen()),
  );
}

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
    expect(find.byKey(const ValueKey('news-featured-story')), findsOneWidget);
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
    await tester.pumpWidget(_createScreenUnderTest());
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Email agent'),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
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
    await tester.pumpWidget(_createScreenUnderTest());
    await tester.pumpAndSettle();

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

  testWidgets('GitHub setup message exposes the connector action', (
    tester,
  ) async {
    Map<String, dynamic>? selectedAction;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DailyTaskTemplate(
            data: const {
              'title': 'Connect GitHub to run this agent',
              'task': 'To run this agent, you need to connect GitHub.',
              'actions': [
                {
                  'id': 'connect_github',
                  'type': 'connector_connect',
                  'connector_id': 'github',
                  'label': 'Connect GitHub',
                  'style': 'primary',
                },
              ],
            },
            onAction: (action) => selectedAction = action,
          ),
        ),
      ),
    );

    expect(
      find.text('To run this agent, you need to connect GitHub.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Connect GitHub'));
    await tester.pump();

    expect(selectedAction?['connector_id'], 'github');
    expect(selectedAction?['type'], 'connector_connect');
  });

  testWidgets('connector switch is disabled while OAuth is opening', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ConnectorListItem(
            connector: const Connector(
              id: 'github',
              name: 'GitHub',
              description: 'Repository activity',
              status: ConnectorStatus.linking,
            ),
            onConnectedChanged: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('CONNECTING'), findsOneWidget);
    final toggle = tester.widget<Switch>(find.byType(Switch));
    expect(toggle.onChanged, isNull);
  });

  testWidgets('StudyGuideTemplate shows/hides action buttons based on status', (
    tester,
  ) async {
    // 1. Not completed, action_taken is null -> should show actions
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StudyGuideTemplate(
            data: const {
              'topic': 'Recursion',
              'definition': 'Recursion is self-reference.',
              'completed': false,
              'action_taken': null,
              'actions': [
                {'id': 'done', 'label': 'Done', 'style': 'primary'},
                {'id': 'snooze', 'label': 'Snooze 30min', 'style': 'secondary'},
                {'id': 'skip', 'label': 'Skip today', 'style': 'ghost'},
              ],
            },
            onAction: (_) {},
          ),
        ),
      ),
    );
    expect(find.text('Done'), findsOneWidget);
    expect(find.text('Snooze 30min'), findsOneWidget);
    expect(find.text('Skip today'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_rounded), findsNothing);

    // 2. Completed is true -> should hide actions and show completed checkmark
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StudyGuideTemplate(
            data: const {
              'topic': 'Recursion',
              'definition': 'Recursion is self-reference.',
              'completed': true,
              'action_taken': null,
              'actions': [
                {'id': 'done', 'label': 'Done', 'style': 'primary'},
                {'id': 'snooze', 'label': 'Snooze 30min', 'style': 'secondary'},
                {'id': 'skip', 'label': 'Skip today', 'style': 'ghost'},
              ],
            },
            onAction: (_) {},
          ),
        ),
      ),
    );
    expect(find.text('Done'), findsNothing);
    expect(find.text('Snooze 30min'), findsNothing);
    expect(find.text('Skip today'), findsNothing);
    expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);

    // 3. Action taken is set -> should hide actions
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StudyGuideTemplate(
            data: const {
              'topic': 'Recursion',
              'definition': 'Recursion is self-reference.',
              'completed': false,
              'action_taken': 'skip',
              'actions': [
                {'id': 'done', 'label': 'Done', 'style': 'primary'},
                {'id': 'snooze', 'label': 'Snooze 30min', 'style': 'secondary'},
                {'id': 'skip', 'label': 'Skip today', 'style': 'ghost'},
              ],
            },
            onAction: (_) {},
          ),
        ),
      ),
    );
    expect(find.text('Done'), findsNothing);
    expect(find.text('Snooze 30min'), findsNothing);
    expect(find.text('Skip today'), findsNothing);
    expect(find.byIcon(Icons.check_circle_rounded), findsNothing);
  });

  testWidgets(
    'DsaQuestionTemplate shows/hides action buttons based on status',
    (tester) async {
      // 1. Not completed, action_taken is null -> should show actions
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DsaQuestionTemplate(
              data: const {
                'title': 'Two Sum',
                'difficulty': 'Easy',
                'problem': 'Find two numbers that add up to target.',
                'completed': false,
                'action_taken': null,
                'actions': [
                  {'id': 'done', 'label': 'Done', 'style': 'primary'},
                  {
                    'id': 'snooze',
                    'label': 'Snooze 30min',
                    'style': 'secondary',
                  },
                  {'id': 'skip', 'label': 'Skip today', 'style': 'ghost'},
                ],
              },
              onAction: (_) {},
            ),
          ),
        ),
      );
      expect(find.text('Done'), findsOneWidget);
      expect(find.text('Snooze 30min'), findsOneWidget);
      expect(find.text('Skip today'), findsOneWidget);

      // 2. Completed is true -> should hide actions
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DsaQuestionTemplate(
              data: const {
                'title': 'Two Sum',
                'difficulty': 'Easy',
                'problem': 'Find two numbers that add up to target.',
                'completed': true,
                'action_taken': null,
                'actions': [
                  {'id': 'done', 'label': 'Done', 'style': 'primary'},
                  {
                    'id': 'snooze',
                    'label': 'Snooze 30min',
                    'style': 'secondary',
                  },
                  {'id': 'skip', 'label': 'Skip today', 'style': 'ghost'},
                ],
              },
              onAction: (_) {},
            ),
          ),
        ),
      );
      expect(find.text('Done'), findsNothing);
      expect(find.text('Snooze 30min'), findsNothing);
      expect(find.text('Skip today'), findsNothing);

      // 3. Action taken is set -> should hide actions
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DsaQuestionTemplate(
              data: const {
                'title': 'Two Sum',
                'difficulty': 'Easy',
                'problem': 'Find two numbers that add up to target.',
                'completed': false,
                'action_taken': 'snooze',
                'actions': [
                  {'id': 'done', 'label': 'Done', 'style': 'primary'},
                  {
                    'id': 'snooze',
                    'label': 'Snooze 30min',
                    'style': 'secondary',
                  },
                  {'id': 'skip', 'label': 'Skip today', 'style': 'ghost'},
                ],
              },
              onAction: (_) {},
            ),
          ),
        ),
      );
      expect(find.text('Done'), findsNothing);
      expect(find.text('Snooze 30min'), findsNothing);
      expect(find.text('Skip today'), findsNothing);
    },
  );
}

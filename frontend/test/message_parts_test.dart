import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/message.dart';
import 'package:sydney/widgets/thread/message_card.dart';

void main() {
  test('message presentation metadata is optional and backward compatible', () {
    final legacy = Message.fromJson({
      'id': 'legacy',
      'agent_id': 'agent',
      'role': 'agent',
      'created_at': '2026-07-19T10:00:00Z',
      'content': {
        'template': 'plain_text',
        'data': {'body': 'Legacy message'},
      },
    });
    final part = Message.fromJson({
      'id': 'part-2',
      'agent_id': 'agent',
      'role': 'agent',
      'created_at': '2026-07-19T10:00:00Z',
      'content': {
        'template': 'plain_text',
        'presentation': {
          'group_id': 'run-1',
          'part_index': 1,
          'part_count': 3,
          'item_offset': 2,
        },
        'data': {'body': 'Second part'},
      },
    });

    expect(legacy.isMultipart, isFalse);
    expect(legacy.isFirstPart, isTrue);
    expect(legacy.isLastPart, isTrue);
    expect(part.isMultipart, isTrue);
    expect(part.groupId, 'run-1');
    expect(part.partIndex, 1);
    expect(part.partCount, 3);
    expect(part.itemOffset, 2);
    expect(part.isFirstPart, isFalse);
    expect(part.isLastPart, isFalse);
  });

  testWidgets('feedback buttons are limited to unsolicited agent messages', (
    tester,
  ) async {
    final requested = Message.plainText(
      id: 'requested-agent-message',
      threadId: 'thread',
      sender: MessageSender.agent,
      text: 'Here is the answer you asked for.',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: MessageCard(message: requested, onAction: (_) {})),
      ),
    );

    expect(find.text('Useful'), findsNothing);
    expect(find.text('Not useful'), findsNothing);
    expect(find.byIcon(Icons.more_horiz_rounded), findsNothing);

    Map<String, dynamic>? submitted;
    final proactive = Message.fromJson({
      'id': 'proactive-agent-message',
      'agent_id': 'agent',
      'role': 'agent',
      'created_at': '2026-07-19T10:00:00Z',
      'content': {
        'template': 'plain_text',
        'presentation': {'feedback_eligible': true},
        'data': {'body': 'A story matched your interests.'},
      },
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MessageCard(
            message: proactive,
            onAction: (action) => submitted = action,
          ),
        ),
      ),
    );

    expect(find.text('Useful'), findsOneWidget);
    expect(find.text('Not useful'), findsOneWidget);
    await tester.tap(
      find.byKey(
        const ValueKey('message-feedback-useful-proactive-agent-message'),
      ),
    );
    expect(submitted?['type'], 'message_feedback');
    expect(submitted?['feedback_type'], 'useful');
    expect(submitted?['messageId'], 'proactive-agent-message');
    expect(submitted?['subject_type'], isNull);
  });

  testWidgets(
    'unknown templates render common fields without unknown actions',
    (tester) async {
      final message = Message.fromJson({
        'id': 'future-template',
        'agent_id': 'agent',
        'role': 'agent',
        'created_at': '2026-07-19T10:00:00Z',
        'content': {
          'template': 'future_template',
          'data': {
            'title': 'A future update',
            'summary': 'The app can still show the useful context.',
            'status': 'Ready',
            'items': [
              {
                'headline': 'First item',
                'description': 'Read-only details remain visible.',
              },
            ],
            'actions': [
              {'label': 'Run unknown action'},
            ],
          },
        },
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(child: MessageCard(message: message)),
          ),
        ),
      );

      expect(find.text('A future update'), findsOneWidget);
      expect(
        find.text('The app can still show the useful context.'),
        findsOneWidget,
      );
      expect(find.text('First item'), findsOneWidget);
      expect(find.text('Status: Ready'), findsOneWidget);
      expect(find.text('Run unknown action'), findsNothing);
      expect(find.byType(ElevatedButton), findsNothing);
      expect(find.byType(OutlinedButton), findsNothing);
    },
  );

  testWidgets('multipart news overview omits the empty-result warning', (
    tester,
  ) async {
    final message = Message.fromJson({
      'id': 'news-overview',
      'agent_id': 'agent',
      'role': 'agent',
      'created_at': '2026-07-19T10:00:00Z',
      'content': {
        'template': 'news_brief',
        'presentation': {
          'group_id': 'run-news',
          'part_index': 0,
          'part_count': 2,
        },
        'data': {
          'title': 'AI news',
          'items': <Object>[],
          'tldr': ['Models became cheaper to serve.'],
          'why_it_matters': 'Teams can ship smaller products.',
        },
      },
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: MessageCard(message: message)),
        ),
      ),
    );

    expect(find.text('PART 1 OF 2'), findsNothing);
    expect(find.text('TL;DR'), findsOneWidget);
    expect(find.text('No content for this run.'), findsNothing);
  });

  testWidgets('third news message renders context without an empty warning', (
    tester,
  ) async {
    final message = Message.fromJson({
      'id': 'news-context',
      'agent_id': 'agent',
      'role': 'agent',
      'created_at': '2026-07-19T10:00:00Z',
      'content': {
        'template': 'news_brief',
        'presentation': {
          'group_id': 'run-news',
          'part_index': 2,
          'part_count': 3,
        },
        'data': {
          'title': 'AI news - Context and timeline',
          'items': <Object>[],
          'perspectives': [
            {
              'label': 'Industry',
              'summary': 'Builders welcomed lower serving costs.',
            },
          ],
          'why_it_matters': 'The release changes product economics.',
          'timeline': [
            {'date': '2026-07-18', 'event': 'The lead model was announced.'},
          ],
        },
      },
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: MessageCard(message: message)),
        ),
      ),
    );

    expect(find.text('Perspectives'), findsOneWidget);
    expect(find.text('Why it matters'), findsOneWidget);
    expect(find.text('Lead-story timeline'), findsOneWidget);
    expect(find.text('No content for this run.'), findsNothing);
    expect(find.text('PART 3 OF 3'), findsNothing);
  });

  testWidgets('content ideas retain numbering across message parts', (
    tester,
  ) async {
    final message = Message.fromJson({
      'id': 'idea-part',
      'agent_id': 'agent',
      'role': 'agent',
      'created_at': '2026-07-19T10:00:00Z',
      'content': {
        'template': 'content_extractor',
        'presentation': {
          'group_id': 'run-content',
          'part_index': 1,
          'part_count': 2,
          'item_offset': 2,
        },
        'data': {
          'ideas': [
            {'title': 'Third idea', 'hook': 'A useful hook'},
          ],
        },
      },
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(child: MessageCard(message: message)),
        ),
      ),
    );

    expect(find.text('PART 2 OF 2'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('Third idea'), findsOneWidget);
  });
}

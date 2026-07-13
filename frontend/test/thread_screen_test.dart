import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/agent.dart';
import 'package:sydney/models/message.dart';
import 'package:sydney/providers/agents_provider.dart';
import 'package:sydney/providers/messages_provider.dart';
import 'package:sydney/screens/thread/thread_screen.dart';
import 'package:sydney/screens/thread/agent_preferences_screen.dart';
import 'package:sydney/widgets/app_bottom_nav.dart';

final testAgent = Agent(
  id: 'agent-layout',
  threadId: 'thread-layout',
  name: 'A Very Long Research Agent Name That Must Fit',
  avatarInitials: 'RA',
  description: 'Research assistant',
  lastMessagePreview: 'Latest update',
  latestMessageAt: _testDate,
);

final _testDate = DateTime(2026, 7, 12, 9);

class _TestAgentsController extends AgentsController {
  _TestAgentsController(this.agent);

  final Agent agent;

  @override
  Future<List<Agent>> build() async => [agent];
}

Widget threadHost({
  required Future<List<Message>> Function() loadMessages,
  Agent? agent,
}) {
  final activeAgent = agent ?? testAgent;
  return ProviderScope(
    retry: (retryCount, error) => null,
    overrides: [
      agentsProvider.overrideWith(() => _TestAgentsController(activeAgent)),
      messagesProvider(
        activeAgent.threadId,
      ).overrideWith((ref) => loadMessages()),
    ],
    child: MaterialApp(home: ThreadScreen(agent: activeAgent)),
  );
}

void setMobileViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void main() {
  testWidgets('thread layout fits a narrow mobile viewport', (tester) async {
    setMobileViewport(tester);
    final messages = [
      Message.plainText(
        id: 'agent-message',
        threadId: testAgent.threadId,
        sender: MessageSender.agent,
        text:
            'Here is a deliberately long agent response that should wrap inside the message card without overflowing the mobile screen.',
        createdAt: _testDate,
      ),
      Message.plainText(
        id: 'user-message',
        threadId: testAgent.threadId,
        sender: MessageSender.user,
        text: 'Thanks. Please continue with the next part.',
        createdAt: _testDate,
      ),
    ];

    await tester.pumpWidget(threadHost(loadMessages: () async => messages));
    await tester.pumpAndSettle();

    expect(find.text('TODAY'), findsOneWidget);
    expect(find.text('ACTIVE'), findsOneWidget);
    expect(find.text('Message agent'), findsOneWidget);
    expect(find.byIcon(Icons.send_rounded), findsOneWidget);
    expect(find.byType(AppBottomNav), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('thread renders mixed user and agent messages', (tester) async {
    setMobileViewport(tester);
    final messages = [
      Message.plainText(
        id: 'agent-message',
        threadId: testAgent.threadId,
        sender: MessageSender.agent,
        text: 'Agent response',
        createdAt: _testDate,
      ),
      Message.plainText(
        id: 'user-message',
        threadId: testAgent.threadId,
        sender: MessageSender.user,
        text: 'User reply',
        createdAt: _testDate,
      ),
    ];

    await tester.pumpWidget(threadHost(loadMessages: () async => messages));
    await tester.pumpAndSettle();

    expect(find.text('Agent response'), findsOneWidget);
    expect(find.text('User reply'), findsOneWidget);
    expect(find.text(testAgent.name), findsOneWidget);
  });

  testWidgets('agent menu exposes the focused action set in order', (
    tester,
  ) async {
    setMobileViewport(tester);
    final menuAgent = testAgent.copyWith(
      parsedIntent: const {'intent': 'habit_tracker'},
    );
    await tester.pumpWidget(
      threadHost(agent: menuAgent, loadMessages: () async => []),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('More options'));
    await tester.pumpAndSettle();

    const labels = [
      'Run agent now',
      'Agent preferences',
      'View progress heatmap',
      'Clear chat',
      'Mute agent',
    ];
    for (final label in labels) {
      expect(find.text(label), findsOneWidget);
    }
    expect(find.text('Pause agent'), findsNothing);
    expect(find.text('Delete agent'), findsNothing);

    final positions = labels.map(
      (label) => tester.getTopLeft(find.text(label)).dy,
    );
    expect(positions, orderedEquals(positions.toList()..sort()));
  });

  testWidgets('pause preference updates to resume below description', (
    tester,
  ) async {
    setMobileViewport(tester);
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(home: AgentPreferencesScreen(agent: testAgent)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Agent active'), findsNothing);
    expect(find.text('Pause agent'), findsOneWidget);
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
      isFalse,
    );
    expect(
      tester.getTopLeft(find.text('Agent Description')).dy,
      lessThan(tester.getTopLeft(find.text('Pause agent')).dy),
    );

    await tester.tap(find.byType(SwitchListTile));
    await tester.pump();
    expect(find.text('Resume agent'), findsOneWidget);
    expect(find.text('Pause agent'), findsNothing);
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
      isTrue,
    );
  });

  testWidgets('thread keeps its composer visible while messages load', (
    tester,
  ) async {
    setMobileViewport(tester);
    final pending = Completer<List<Message>>();

    await tester.pumpWidget(threadHost(loadMessages: () => pending.future));
    await tester.pump();

    expect(find.text('Message agent'), findsOneWidget);
    expect(find.byIcon(Icons.send_rounded), findsOneWidget);
    expect(find.byType(ListView), findsOneWidget);

    pending.complete([]);
    await tester.pumpAndSettle();
    expect(find.text('TODAY'), findsOneWidget);
  });

  testWidgets('thread displays a recoverable message-load error', (
    tester,
  ) async {
    setMobileViewport(tester);

    await tester.pumpWidget(
      threadHost(loadMessages: () async => throw Exception('offline')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Conversation could not load'), findsOneWidget);
    expect(find.textContaining('offline'), findsOneWidget);
    expect(find.text('Message agent'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

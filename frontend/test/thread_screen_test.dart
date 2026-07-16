import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/agent.dart';
import 'package:sydney/models/message.dart';
import 'package:sydney/models/message_archive.dart';
import 'package:sydney/design/tokens.dart';
import 'package:sydney/providers/agents_provider.dart';
import 'package:sydney/providers/messages_provider.dart';
import 'package:sydney/providers/message_archive_provider.dart';
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

class _ThreadArchiveController extends MessageArchiveController {
  @override
  Future<MessageArchiveState> build() async => const MessageArchiveState(
    enabled: true,
    status: 'active',
    actionRequired: false,
  );
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

void setMobileViewport(
  WidgetTester tester, {
  Size size = const Size(390, 844),
}) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void main() {
  testWidgets('thread layout fits a narrow mobile viewport', (tester) async {
    setMobileViewport(tester, size: const Size(320, 700));
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

    final scaffold = tester.widget<Scaffold>(
      find.byKey(const ValueKey('thread-scaffold')),
    );
    expect(scaffold.backgroundColor, CuppetWorkspaceColors.background);

    final appBar = tester.widget<AppBar>(
      find.byKey(const ValueKey('thread-app-bar')),
    );
    expect(appBar.backgroundColor, CuppetWorkspaceColors.background);

    final composer = tester.widget<DecoratedBox>(
      find.byKey(const ValueKey('thread-composer')),
    );
    final composerDecoration = composer.decoration as BoxDecoration;
    expect(composerDecoration.color, CuppetWorkspaceColors.background);

    final agentSurface = tester.widget<Container>(
      find.byKey(const ValueKey('message-surface-agent-message')),
    );
    final agentDecoration = agentSurface.decoration! as BoxDecoration;
    expect(agentDecoration.color, CuppetWorkspaceColors.card);

    final userSurface = tester.widget<Container>(
      find.byKey(const ValueKey('message-surface-user-message')),
    );
    final userDecoration = userSurface.decoration! as BoxDecoration;
    expect(userDecoration.color, CuppetWorkspaceColors.softSage);
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

  testWidgets('thread exposes Drive history only behind an explicit boundary', (
    tester,
  ) async {
    setMobileViewport(tester);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          agentsProvider.overrideWith(() => _TestAgentsController(testAgent)),
          messagesProvider(
            testAgent.threadId,
          ).overrideWith((ref) async => const []),
          messageArchiveProvider.overrideWith(_ThreadArchiveController.new),
        ],
        child: MaterialApp(home: ThreadScreen(agent: testAgent)),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Messages older than 30 days are archived in Google Drive.'),
      findsOneWidget,
    );
    expect(find.text('View older history'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('thread-archive-boundary')),
      findsOneWidget,
    );
  });

  testWidgets('message selection and reply remain available after refresh', (
    tester,
  ) async {
    setMobileViewport(tester, size: const Size(360, 800));
    final message = Message.plainText(
      id: 'selectable-agent-message',
      threadId: testAgent.threadId,
      sender: MessageSender.agent,
      text: 'Reply to this update',
      createdAt: _testDate,
    );

    await tester.pumpWidget(threadHost(loadMessages: () async => [message]));
    await tester.pumpAndSettle();

    await tester.longPress(
      find.byKey(const ValueKey('message-surface-selectable-agent-message')),
    );
    await tester.pumpAndSettle();

    expect(find.text('1 message selected'), findsOneWidget);
    expect(find.byTooltip('Copy text'), findsOneWidget);
    expect(find.byTooltip('Reply to message'), findsOneWidget);

    await tester.tap(find.byTooltip('Reply to message'));
    await tester.pumpAndSettle();

    expect(find.text('Replying to agent'), findsOneWidget);
    expect(find.text('Reply to this update'), findsNWidgets(2));
    expect(tester.takeException(), isNull);
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
    final resumeSwitch = tester.widget<SwitchListTile>(
      find.byType(SwitchListTile),
    );
    expect(resumeSwitch.activeThumbColor, Colors.white);
    expect(resumeSwitch.activeTrackColor, SydneyColors.primary);
  });

  testWidgets('description changes require functionality confirmation', (
    tester,
  ) async {
    setMobileViewport(tester);
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(home: AgentPreferencesScreen(agent: testAgent)),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const ValueKey('agent_description_field')),
      'Deliver a focused AI research briefing every weekday.',
    );
    await tester.tap(find.text('Save Preferences'));
    await tester.pumpAndSettle();

    expect(find.text('Update agent functionality?'), findsOneWidget);
    expect(
      find.text(
        'Changing the agent description will update its functionality.',
      ),
      findsOneWidget,
    );
    expect(find.text('Cancel'), findsOneWidget);
    expect(find.text('Confirm'), findsOneWidget);

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.text('Update agent functionality?'), findsNothing);
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

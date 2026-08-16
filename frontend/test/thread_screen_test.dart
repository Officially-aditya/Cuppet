import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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
import 'package:sydney/services/agent_service.dart';
import 'package:sydney/services/api.dart';
import 'package:sydney/services/message_service.dart';
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

class _RecordingMessageService extends MessageService {
  _RecordingMessageService()
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  String? sentText;
  String? sentSourceMessageId;

  @override
  Future<SendReplyResult> sendReply({
    required String threadId,
    required String text,
    List<String> attachmentIds = const [],
    String? sourceMessageId,
  }) async {
    sentText = text;
    sentSourceMessageId = sourceMessageId;
    return SendReplyResult(
      message: Message.plainText(
        id: 'sent-message',
        threadId: threadId,
        sender: MessageSender.user,
        text: text,
        createdAt: _testDate,
      ),
    );
  }
}

class _RecordingAgentService extends AgentService {
  _RecordingAgentService()
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  Map<String, dynamic>? lastPatch;

  @override
  Future<void> patchAgent(String agentId, Map<String, dynamic> patch) async {
    lastPatch = Map<String, dynamic>.from(patch);
  }
}

Widget threadHost({
  required Future<List<Message>> Function() loadMessages,
  Agent? agent,
  MessageService? messageService,
}) {
  final activeAgent = agent ?? testAgent;
  return ProviderScope(
    retry: (retryCount, error) => null,
    overrides: [
      agentsProvider.overrideWith(() => _TestAgentsController(activeAgent)),
      messagesProvider(
        activeAgent.threadId,
      ).overrideWith((ref) => loadMessages()),
      if (messageService != null)
        messageServiceProvider.overrideWithValue(messageService),
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
    final createdAt = DateTime.now();
    final messages = [
      Message.plainText(
        id: 'agent-message',
        threadId: testAgent.threadId,
        sender: MessageSender.agent,
        text:
            'Here is a deliberately long agent response that should wrap inside the message card without overflowing the mobile screen.',
        createdAt: createdAt,
      ),
      Message.plainText(
        id: 'user-message',
        threadId: testAgent.threadId,
        sender: MessageSender.user,
        text: 'Thanks. Please continue with the next part.',
        createdAt: createdAt,
      ),
    ];

    await tester.pumpWidget(threadHost(loadMessages: () async => messages));
    await tester.pumpAndSettle();

    expect(find.text('TODAY'), findsOneWidget);
    expect(find.text('ON DEMAND'), findsOneWidget);
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
    expect(
      tester.getTopLeft(find.byKey(const ValueKey('thread-agent-avatar'))).dx,
      closeTo(SydneySpacing.page + 2, 0.1),
    );
    final threadAvatar = tester.widget<Container>(
      find.byKey(const ValueKey('thread-agent-avatar')),
    );
    final avatarDecoration = threadAvatar.decoration! as BoxDecoration;
    expect(
      avatarDecoration.color?.a,
      closeTo(CuppetWorkspaceColors.agentAvatarOpacity, 0.01),
    );
    expect(avatarDecoration.border, isNull);

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

  testWidgets('composer continuously transitions its Run Now suggestion', (
    tester,
  ) async {
    setMobileViewport(tester);

    await tester.pumpWidget(threadHost(loadMessages: () async => []));
    await tester.pumpAndSettle();

    expect(find.text('Message agent'), findsOneWidget);
    expect(find.text("Try 'Run Now'"), findsNothing);
    final originalHintLeft = tester.getTopLeft(find.text('Message agent')).dx;

    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text("Try 'Run Now'"), findsOneWidget);
    expect(
      tester.getTopLeft(find.text("Try 'Run Now'")).dx,
      closeTo(originalHintLeft, 0.1),
    );

    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Message agent'), findsOneWidget);
  });

  testWidgets('Assistant thread uses the Cuppet Courier avatar', (
    tester,
  ) async {
    setMobileViewport(tester);
    final assistant = testAgent.copyWith(
      id: 'assistant-id',
      threadId: 'assistant-id',
      name: 'Assistant',
      avatarInitials: 'CU',
      isAssistant: true,
    );

    await tester.pumpWidget(
      threadHost(agent: assistant, loadMessages: () async => []),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey('assistant-thread-avatar')),
      findsOneWidget,
    );
    expect(
      tester
          .getTopLeft(find.byKey(const ValueKey('assistant-thread-avatar')))
          .dx,
      closeTo(SydneySpacing.page + 2, 0.1),
    );
  });

  testWidgets('Assistant thread uses the updated welcome message', (
    tester,
  ) async {
    setMobileViewport(tester);
    final assistant = testAgent.copyWith(
      id: 'assistant-id',
      threadId: 'assistant-id',
      name: 'Assistant',
      isAssistant: true,
    );
    final oldWelcome = Message.plainText(
      id: 'assistant-welcome',
      threadId: assistant.threadId,
      sender: MessageSender.agent,
      text: 'Old welcome message',
      createdAt: _testDate,
    );

    await tester.pumpWidget(
      threadHost(agent: assistant, loadMessages: () async => [oldWelcome]),
    );
    await tester.pumpAndSettle();

    expect(
      find.text(
        "I'm here for everyday conversation, just like the AI chatbots you already know and love. But stick around for the magic - tell me what you want, and I'll create a contact that messages you, like clockwork, exactly when you need it.",
      ),
      findsOneWidget,
    );
    expect(find.text('Old welcome message'), findsNothing);
  });

  testWidgets('Assistant thread does not show the Run Now suggestion', (
    tester,
  ) async {
    setMobileViewport(tester);
    final assistant = testAgent.copyWith(
      id: 'assistant-id',
      threadId: 'assistant-id',
      name: 'Assistant',
      isAssistant: true,
    );

    await tester.pumpWidget(
      threadHost(agent: assistant, loadMessages: () async => []),
    );
    await tester.pumpAndSettle();

    expect(find.text('Message agent'), findsOneWidget);
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text("Try 'Run Now'"), findsNothing);
    expect(find.text('Message agent'), findsOneWidget);
  });

  testWidgets('thread labels today, yesterday, and older calendar days', (
    tester,
  ) async {
    setMobileViewport(tester, size: const Size(390, 1400));
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day, 12);
    final yesterday = DateTime(now.year, now.month, now.day - 1, 12);
    final messages = [
      Message.plainText(
        id: 'older-message',
        threadId: testAgent.threadId,
        sender: MessageSender.agent,
        text: 'Older update',
        createdAt: DateTime(2000, 1, 3, 12),
      ),
      Message.plainText(
        id: 'yesterday-message',
        threadId: testAgent.threadId,
        sender: MessageSender.agent,
        text: 'Yesterday update',
        createdAt: yesterday,
      ),
      Message.plainText(
        id: 'today-message',
        threadId: testAgent.threadId,
        sender: MessageSender.agent,
        text: 'Today update',
        createdAt: today,
      ),
    ];

    await tester.pumpWidget(threadHost(loadMessages: () async => messages));
    await tester.pumpAndSettle();

    expect(find.text('MONDAY, JANUARY 3, 2000'), findsOneWidget);
    expect(find.text('YESTERDAY'), findsOneWidget);
    expect(find.text('TODAY'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('multipart messages stay beneath one calendar-day label', (
    tester,
  ) async {
    setMobileViewport(tester);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final firstPartAt = today.subtract(const Duration(milliseconds: 1));
    const groupId = 'run-across-midnight';
    final messages = [
      Message(
        id: 'part-one',
        threadId: testAgent.threadId,
        sender: MessageSender.agent,
        createdAt: firstPartAt,
        content: const {
          'template': 'plain_text',
          'presentation': {
            'group_id': groupId,
            'part_index': 0,
            'part_count': 2,
          },
          'data': {'body': 'First part'},
        },
      ),
      Message(
        id: 'part-two',
        threadId: testAgent.threadId,
        sender: MessageSender.agent,
        createdAt: today,
        content: const {
          'template': 'plain_text',
          'presentation': {
            'group_id': groupId,
            'part_index': 1,
            'part_count': 2,
          },
          'data': {'body': 'Second part'},
        },
      ),
    ];

    await tester.pumpWidget(threadHost(loadMessages: () async => messages));
    await tester.pumpAndSettle();

    expect(find.text('YESTERDAY'), findsOneWidget);
    expect(find.text('TODAY'), findsNothing);
    expect(find.text('First part'), findsOneWidget);
    expect(find.text('Second part'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('content idea draft keeps the selected output as its source', (
    tester,
  ) async {
    setMobileViewport(tester);
    const sourceMessageId = '72698af9-213d-4be8-b34a-b5ee990a5fc6';
    final messageService = _RecordingMessageService();
    final messages = [
      Message(
        id: sourceMessageId,
        threadId: testAgent.threadId,
        sender: MessageSender.agent,
        createdAt: _testDate,
        content: const {
          'template': 'content_extractor',
          'data': {
            'title': 'Content ideas',
            'ideas': [
              {
                'title': 'Smaller models get faster',
                'hook': 'Explain why latency wins matter.',
              },
            ],
          },
        },
      ),
    ];

    await tester.pumpWidget(
      threadHost(
        loadMessages: () async => messages,
        messageService: messageService,
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Smaller models get faster'));
    await tester.pump();

    expect(
      messageService.sentText,
      'Generate a draft from this selected idea in your previous output: '
      '"Smaller models get faster"',
    );
    expect(messageService.sentSourceMessageId, sourceMessageId);
    expect(tester.takeException(), isNull);
    await tester.pump(const Duration(seconds: 21));
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });

  testWidgets('news Explore more sends a self-contained web research request', (
    tester,
  ) async {
    setMobileViewport(tester);
    const sourceMessageId = '6e8bc625-abb8-43d7-aaf1-7986d9479f6a';
    final messageService = _RecordingMessageService();
    final messages = [
      Message(
        id: sourceMessageId,
        threadId: testAgent.threadId,
        sender: MessageSender.agent,
        createdAt: _testDate,
        content: const {
          'template': 'news_brief',
          'data': {
            'title': 'AI news - Detailed coverage',
            'items': [
              {
                'headline': 'A new efficient AI model launched',
                'summary':
                    'The model reduces serving costs while keeping benchmark quality.',
                'category': 'AI',
                'source': 'Example News',
                'url': 'https://example.com/model',
              },
            ],
          },
        },
      ),
    ];

    await tester.pumpWidget(
      threadHost(
        loadMessages: () async => messages,
        messageService: messageService,
      ),
    );
    await tester.pumpAndSettle();

    final story = find.byKey(const ValueKey('news-featured-story'));
    final storyDetails = find.descendant(
      of: story,
      matching: find.byType(AnimatedCrossFade),
    );
    expect(
      tester.widget<AnimatedCrossFade>(storyDetails).crossFadeState,
      CrossFadeState.showFirst,
    );
    await tester.tap(find.text('A new efficient AI model launched'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<AnimatedCrossFade>(storyDetails).crossFadeState,
      CrossFadeState.showSecond,
    );
    expect(find.text('Explore more'), findsOneWidget);

    await tester.tap(find.text('Explore more'));
    await tester.pump();

    expect(
      messageService.sentText,
      'Search the web for "A new efficient AI model launched" and explain in '
      'detail what happened, the verified timeline, why it matters, and the '
      'latest developments. Include source links.',
    );
    expect(messageService.sentSourceMessageId, sourceMessageId);
    expect(tester.takeException(), isNull);
    await tester.pump(const Duration(seconds: 21));
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
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

    final selectionSurface = find.ancestor(
      of: find.byKey(
        const ValueKey('message-surface-selectable-agent-message'),
      ),
      matching: find.byType(AnimatedContainer),
    );
    expect(selectionSurface, findsOneWidget);
    final selectionDecoration =
        tester.widget<AnimatedContainer>(selectionSurface).decoration!
            as BoxDecoration;
    expect(selectionDecoration.color?.a, closeTo(0.16, 0.01));
    final selectedMessageSurface = tester.widget<Container>(
      find.byKey(const ValueKey('message-surface-selectable-agent-message')),
    );
    final selectedMessageDecoration =
        selectedMessageSurface.decoration! as BoxDecoration;
    expect(selectedMessageDecoration.color, CuppetWorkspaceColors.card);
    expect(selectedMessageDecoration.border, isNull);
    final selectedForeground =
        selectedMessageSurface.foregroundDecoration! as BoxDecoration;
    expect(selectedForeground.color?.a, closeTo(0.12, 0.01));
    expect(selectedForeground.border, isNull);
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
      tester.getTopLeft(find.text('AGENT DESCRIPTION')).dy,
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

  testWidgets('schedule-only agent preferences omit realtime controls', (
    tester,
  ) async {
    setMobileViewport(tester);
    final service = _RecordingAgentService();
    final staticAgent = testAgent.copyWith(
      parsedIntent: const {
        'intent': 'news_brief',
        'schedule_cron': '0 7 * * *',
        'supports_realtime': false,
      },
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [agentServiceProvider.overrideWithValue(service)],
        child: MaterialApp(home: AgentPreferencesScreen(agent: staticAgent)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('response-timing-card')), findsNothing);
    expect(find.text('Real-time'), findsNothing);
    expect(find.text('Daily Summary'), findsNothing);

    await tester.scrollUntilVisible(
      find.text('Save Preferences'),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Save Preferences'));
    await tester.pumpAndSettle();

    expect(service.lastPatch, isNotNull);
    expect(service.lastPatch!.containsKey('realtime_enabled'), isFalse);
  });

  testWidgets('event-backed agent preferences retain realtime controls', (
    tester,
  ) async {
    setMobileViewport(tester);
    final realtimeAgent = testAgent.copyWith(
      parsedIntent: const {
        'intent': 'github_activity_digest',
        'realtime_enabled': true,
        'supports_realtime': true,
      },
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(home: AgentPreferencesScreen(agent: realtimeAgent)),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('response-timing-card')), findsOneWidget);
    expect(find.text('Real-time'), findsOneWidget);
    expect(find.text('Daily Summary'), findsOneWidget);
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
    await tester.scrollUntilVisible(
      find.text('Save Preferences'),
      180,
      scrollable: find.byType(Scrollable).first,
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
    expect(find.textContaining('couldn’t be loaded'), findsOneWidget);
    expect(find.textContaining('offline'), findsNothing);
    expect(find.text('Try again'), findsOneWidget);
    expect(find.text('Message agent'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

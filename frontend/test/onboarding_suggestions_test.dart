import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/config/routes.dart';
import 'package:sydney/design/workspace_palette.dart';
import 'package:sydney/models/agent.dart';
import 'package:sydney/models/message.dart';
import 'package:sydney/models/personalization_consent.dart';
import 'package:sydney/models/personalization_settings.dart';
import 'package:sydney/models/preference_profile.dart';
import 'package:sydney/models/thread_launch_request.dart';
import 'package:sydney/providers/agents_provider.dart';
import 'package:sydney/providers/messages_provider.dart';
import 'package:sydney/providers/personalization_provider.dart';
import 'package:sydney/screens/auth/personalization_onboarding_screen.dart';
import 'package:sydney/screens/inbox/inbox_screen.dart';
import 'package:sydney/services/agent_service.dart';
import 'package:sydney/services/api.dart';
import 'package:sydney/services/message_service.dart';
import 'package:sydney/services/personalization_service.dart';
import 'package:sydney/widgets/workspace_primitives.dart';

final _assistant = Agent(
  id: 'assistant-id',
  threadId: 'assistant-id',
  name: 'Assistant',
  avatarInitials: 'CU',
  description: 'Your home base for delegation.',
  lastMessagePreview: 'What should we create?',
  latestMessageAt: DateTime(2026, 7, 14),
  isAssistant: true,
);

final _createdAgent = Agent(
  id: 'news-agent',
  threadId: 'news-agent',
  name: 'Tech News',
  avatarInitials: 'TN',
  description: 'Daily technology news.',
  lastMessagePreview: 'Ready.',
  latestMessageAt: DateTime(2026, 7, 14),
);

class _OnboardingAgentsController extends AgentsController {
  _OnboardingAgentsController(this.items);

  final List<Agent> items;

  @override
  Future<List<Agent>> build() async => items;
}

class _PendingMessageService extends MessageService {
  _PendingMessageService(this.result)
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  final Completer<String> result;
  String? handedOffAgentId;
  String? handedOffMessageId;

  @override
  Future<String> handoffToAssistant({
    required String agentId,
    required String messageId,
  }) {
    handedOffAgentId = agentId;
    handedOffMessageId = messageId;
    return result.future;
  }
}

class _FixedAgentService extends AgentService {
  _FixedAgentService(this.agents)
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  final List<Agent> agents;

  @override
  Future<List<Agent>> listAgents() async => agents;
}

class _FailingAgentService extends AgentService {
  _FailingAgentService()
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  @override
  Future<List<Agent>> listAgents() {
    throw const ApiException(
      'Assistant could not load.',
      statusCode: 503,
      retryable: true,
    );
  }
}

class _RecordingPersonalizationService extends PersonalizationService {
  _RecordingPersonalizationService()
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  final List<String> grantedPurposes = [];
  PersonalizationSettings? updatedSettings;

  @override
  Future<PreferenceProfile> loadProfile() async => const PreferenceProfile(
    settings: PersonalizationSettings.defaults(),
    consents: [],
    items: [],
  );

  @override
  Future<PersonalizationConsent> grantConsent(
    String purpose, {
    String source = 'settings',
  }) async {
    grantedPurposes.add('$purpose:$source');
    return PersonalizationConsent(
      id: purpose,
      purpose: purpose,
      status: 'granted',
      policyVersion: 'test',
      createdAt: DateTime(2026, 7, 29),
      grantedAt: DateTime(2026, 7, 29),
      source: source,
    );
  }

  @override
  Future<PersonalizationSettings> updateSettings(
    PersonalizationSettings settings,
  ) async {
    updatedSettings = settings;
    return settings;
  }
}

Widget _host({
  required List<Agent> agents,
  List<Message> briefings = const [],
  MessageService? messageService,
  AgentService? agentService,
  ValueChanged<Object?>? onRoute,
}) {
  return ProviderScope(
    overrides: [
      agentsProvider.overrideWith(() => _OnboardingAgentsController(agents)),
      briefingsProvider.overrideWith((ref) async => briefings),
      if (messageService != null)
        messageServiceProvider.overrideWithValue(messageService),
      if (agentService != null)
        agentServiceProvider.overrideWithValue(agentService),
    ],
    child: MaterialApp(
      home: const InboxScreen(),
      onGenerateRoute: (settings) {
        if (settings.name == AppRoutes.thread) {
          onRoute?.call(settings.arguments);
          return MaterialPageRoute<void>(
            settings: settings,
            builder: (_) => const Scaffold(body: Text('Assistant opened')),
          );
        }
        if (settings.name == AppRoutes.create) {
          return MaterialPageRoute<void>(
            settings: settings,
            builder: (_) => const Scaffold(body: Text('Create opened')),
          );
        }
        return null;
      },
    ),
  );
}

void main() {
  testWidgets('asks for personalization permission during account setup', (
    tester,
  ) async {
    final personalization = _RecordingPersonalizationService();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          personalizationServiceProvider.overrideWithValue(personalization),
        ],
        child: MaterialApp(
          home: const PersonalizationOnboardingScreen(),
          onGenerateRoute:
              (settings) => MaterialPageRoute<void>(
                settings: settings,
                builder: (_) => const Scaffold(body: Text('Inbox opened')),
              ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(PersonalizationOnboardingScreen), findsOneWidget);
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('personalization-onboarding-allow')),
      200,
    );
    expect(find.text('Allow suggestions'), findsOneWidget);
    expect(find.text('Not now'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey('personalization-onboarding-allow')),
    );
    await tester.pumpAndSettle();

    expect(
      personalization.grantedPurposes,
      containsAll(<String>[
        'cuppet_activity:onboarding',
        'explicit_feedback:onboarding',
      ]),
    );
    expect(personalization.updatedSettings?.enabled, isTrue);
    expect(personalization.updatedSettings?.inChat, isTrue);
    expect(personalization.updatedSettings?.proactive, isFalse);
    expect(personalization.updatedSettings?.push, isFalse);
    expect(find.text('Inbox opened'), findsOneWidget);
  });

  testWidgets('onboarding card opens Assistant with a creation request', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    Object? routeArguments;
    await tester.pumpWidget(
      _host(
        agents: [_assistant],
        onRoute: (arguments) => routeArguments = arguments,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('TRY CUPPET'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('assistant-avatar-assistant-id')),
      findsOneWidget,
    );
    expect(find.text('Want AI to deliver news every morning?'), findsOneWidget);
    expect(
      find.text('Want to sharpen your coding skills daily?'),
      findsOneWidget,
    );

    final newsCard = find.byKey(const ValueKey('onboarding_daily_news'));
    final codingCard = find.byKey(const ValueKey('onboarding_daily_coding'));
    final newsSize = tester.getSize(newsCard);
    final codingSize = tester.getSize(codingCard);
    expect(newsSize.width, closeTo(newsSize.height, 0.1));
    expect(codingSize.width, closeTo(codingSize.height, 0.1));
    expect(
      tester.getTopLeft(newsCard).dy,
      closeTo(tester.getTopLeft(codingCard).dy, 0.1),
    );
    expect(
      tester.getBottomLeft(newsCard).dy,
      lessThan(
        tester
            .getTopLeft(
              find.text(
                'Assistant is pinned so you always have a place to start.',
              ),
            )
            .dy,
      ),
    );
    expect(
      tester
          .getTopLeft(
            find.text(
              'Assistant is pinned so you always have a place to start.',
            ),
          )
          .dy,
      lessThan(tester.getTopLeft(find.text('Assistant')).dy),
    );

    await tester.tap(newsCard);
    await tester.pumpAndSettle();

    expect(find.text('Assistant opened'), findsOneWidget);
    expect(routeArguments, isA<ThreadLaunchRequest>());
    final request = routeArguments! as ThreadLaunchRequest;
    expect(request.agent.id, _assistant.id);
    expect(request.initialMessage, contains('technology news briefing'));
    expect(request.initialMessage, contains('8 AM'));
  });

  testWidgets('onboarding cards disappear after an agent exists', (
    tester,
  ) async {
    await tester.pumpWidget(_host(agents: [_assistant, _createdAgent]));
    await tester.pumpAndSettle();

    expect(find.text('TRY CUPPET'), findsNothing);
    expect(find.byKey(const ValueKey('onboarding_daily_news')), findsNothing);
    expect(find.byKey(const ValueKey('onboarding_daily_coding')), findsNothing);
  });

  testWidgets('daily briefing disappears as soon as it is tapped', (
    tester,
  ) async {
    final handoff = Completer<String>();
    final messageService = _PendingMessageService(handoff);
    final briefing = Message(
      id: 'briefing-id',
      threadId: 'briefing-agent-id',
      sender: MessageSender.agent,
      createdAt: DateTime(2026, 7, 17),
      content: const {
        'template': 'briefing_card',
        'data': {
          'eyebrow': 'DAILY BRIEFING',
          'title': 'Your morning plan',
          'summary': 'Three things need your attention.',
        },
      },
    );

    await tester.pumpWidget(
      _host(
        agents: [_assistant],
        briefings: [briefing],
        messageService: messageService,
        agentService: _FixedAgentService([_assistant]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Your morning plan'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('open_briefing_in_assistant')));
    await tester.pump();

    expect(find.text('Your morning plan'), findsNothing);
    expect(find.text('Briefings'), findsNothing);
    expect(messageService.handedOffAgentId, briefing.threadId);
    expect(messageService.handedOffMessageId, briefing.id);

    handoff.complete(_assistant.id);
    await tester.pumpAndSettle();

    expect(find.text('Assistant opened'), findsOneWidget);
  });

  testWidgets('dismissing one briefing keeps newer cards from that agent', (
    tester,
  ) async {
    final handoff = Completer<String>();
    final firstBriefing = Message(
      id: 'first-briefing-id',
      threadId: 'briefing-agent-id',
      sender: MessageSender.agent,
      createdAt: DateTime(2026, 7, 17, 7),
      content: const {
        'template': 'briefing_card',
        'data': {'title': 'First briefing'},
      },
    );
    final newerBriefing = Message(
      id: 'newer-briefing-id',
      threadId: 'briefing-agent-id',
      sender: MessageSender.agent,
      createdAt: DateTime(2026, 7, 18, 7),
      content: const {
        'template': 'briefing_card',
        'data': {'title': 'Newer briefing'},
      },
    );

    await tester.pumpWidget(
      _host(
        agents: [_assistant],
        briefings: [firstBriefing, newerBriefing],
        messageService: _PendingMessageService(handoff),
        agentService: _FixedAgentService([_assistant]),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const ValueKey('home_briefing_first-briefing-id')),
    );
    await tester.pump();

    expect(find.text('First briefing'), findsNothing);
    expect(find.text('Newer briefing'), findsOneWidget);

    handoff.complete(_assistant.id);
    await tester.pumpAndSettle();
  });

  testWidgets('failed briefing handoff restores the card for retry', (
    tester,
  ) async {
    final handoff = Completer<String>();
    final briefing = Message(
      id: 'retry-briefing-id',
      threadId: 'briefing-agent-id',
      sender: MessageSender.agent,
      createdAt: DateTime(2026, 7, 17),
      content: const {
        'template': 'briefing_card',
        'data': {'title': 'Retry this briefing'},
      },
    );

    await tester.pumpWidget(
      _host(
        agents: [_assistant],
        briefings: [briefing],
        messageService: _PendingMessageService(handoff),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const ValueKey('home_briefing_retry-briefing-id')),
    );
    await tester.pump();
    expect(find.text('Retry this briefing'), findsNothing);

    handoff.completeError(
      const ApiException(
        'The briefing handoff failed.',
        statusCode: 503,
        retryable: true,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Retry this briefing'), findsOneWidget);
    expect(find.textContaining('briefing handoff failed'), findsOneWidget);
  });

  testWidgets('completed handoff stays dismissed if Assistant loading fails', (
    tester,
  ) async {
    final handoff = Completer<String>()..complete(_assistant.id);
    final briefing = Message(
      id: 'completed-briefing-id',
      threadId: 'briefing-agent-id',
      sender: MessageSender.agent,
      createdAt: DateTime(2026, 7, 17),
      content: const {
        'template': 'briefing_card',
        'data': {'title': 'Completed briefing'},
      },
    );

    await tester.pumpWidget(
      _host(
        agents: [_assistant],
        briefings: [briefing],
        messageService: _PendingMessageService(handoff),
        agentService: _FailingAgentService(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const ValueKey('home_briefing_completed-briefing-id')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Completed briefing'), findsNothing);
    expect(find.textContaining('Assistant could not load'), findsOneWidget);
  });

  testWidgets('workspace layout preserves agent thread navigation', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    Object? routeArguments;
    await tester.pumpWidget(
      _host(
        agents: [_assistant, _createdAgent],
        onRoute: (arguments) => routeArguments = arguments,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(WorkspaceAppBar), findsOneWidget);
    expect(find.text('Your workspace'), findsOneWidget);
    expect(find.text('Cuppet'), findsOneWidget);
    expect(find.text('Your delegation agents'), findsOneWidget);
    expect(
      tester.widget<Scaffold>(find.byType(Scaffold)).backgroundColor,
      CuppetWorkspaceColors.background,
    );
    expect(tester.takeException(), isNull);

    final agentCard = find.byKey(const ValueKey('agent_news-agent'));
    expect(agentCard, findsOneWidget);
    expect(tester.widget(agentCard), isA<WorkspaceCard>());

    final agentAvatar = tester.widget<Container>(
      find.byKey(const ValueKey('agent-avatar-news-agent')),
    );
    final avatarDecoration = agentAvatar.decoration! as BoxDecoration;
    expect(
      avatarDecoration.color,
      isIn(CuppetWorkspaceColors.agentAvatarBackgrounds),
    );
    expect(avatarDecoration.gradient, isNull);

    await tester.tap(agentCard);
    await tester.pumpAndSettle();

    expect(find.text('Assistant opened'), findsOneWidget);
    expect(routeArguments, same(_createdAgent));
  });

  testWidgets('create action expands, collapses, and keeps navigation', (
    tester,
  ) async {
    await tester.pumpWidget(_host(agents: [_assistant, _createdAgent]));
    await tester.pumpAndSettle();

    final createAction = find.byKey(const ValueKey('create_agent_fab'));
    expect(createAction, findsOneWidget);
    expect(tester.getSize(createAction).width, 132);
    expect(find.bySemanticsLabel('Create new agent'), findsOneWidget);

    final decoration =
        tester.widget<AnimatedContainer>(createAction).decoration
            as BoxDecoration;
    expect(decoration.color, CuppetWorkspaceColors.primary);
    expect(decoration.boxShadow, isNull);

    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.getSize(createAction).width, 48);

    await tester.tap(createAction);
    await tester.pumpAndSettle();
    expect(find.text('Create opened'), findsOneWidget);
  });
}

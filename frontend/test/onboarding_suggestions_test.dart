import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/config/routes.dart';
import 'package:sydney/design/workspace_palette.dart';
import 'package:sydney/models/agent.dart';
import 'package:sydney/models/message.dart';
import 'package:sydney/models/thread_launch_request.dart';
import 'package:sydney/providers/agents_provider.dart';
import 'package:sydney/providers/messages_provider.dart';
import 'package:sydney/screens/inbox/inbox_screen.dart';
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

Widget _host({required List<Agent> agents, ValueChanged<Object?>? onRoute}) {
  return ProviderScope(
    overrides: [
      agentsProvider.overrideWith(() => _OnboardingAgentsController(agents)),
      briefingsProvider.overrideWith((ref) async => const <Message>[]),
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

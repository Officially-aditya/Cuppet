import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/app.dart';
import 'package:sydney/models/agent.dart';
import 'package:sydney/models/user.dart';
import 'package:sydney/providers/agents_provider.dart';
import 'package:sydney/providers/auth_provider.dart';
import 'package:sydney/screens/launch/cuppet_launch_screen.dart';
import 'package:sydney/services/agent_service.dart';
import 'package:sydney/services/api.dart';

class _AuthenticatedController extends AuthController {
  @override
  Future<AuthState> build() async {
    return const AuthState(
      user: User(
        id: 'test-user',
        email: 'test@cuppet.app',
        displayName: 'Test user',
      ),
      sessionToken: 'test-session',
    );
  }
}

class _PendingAgentsController extends AgentsController {
  _PendingAgentsController(this.requestStarted, this.result);

  final void Function() requestStarted;
  final Completer<List<Agent>> result;

  @override
  Future<List<Agent>> build() {
    requestStarted();
    return result.future;
  }
}

class _SwitchableAuthController extends AuthController {
  @override
  Future<AuthState> build() async => _account('account-a');

  void switchTo(AuthState next) {
    state = AsyncValue.data(next);
  }
}

class _AccountAgentService extends AgentService {
  _AccountAgentService()
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  var requestCount = 0;

  @override
  Future<List<Agent>> listAgents() async {
    requestCount += 1;
    final account = requestCount == 1 ? 'account-a' : 'account-b';
    return [_agentFor(account)];
  }
}

AuthState _account(String id) {
  return AuthState(
    user: User(id: id, email: '$id@cuppet.app', displayName: id),
    sessionToken: 'session-$id',
  );
}

Agent _agentFor(String account) {
  return Agent(
    id: '$account-agent',
    threadId: '$account-thread',
    name: '$account agent',
    avatarInitials: 'AA',
    description: 'Owned by $account',
    lastMessagePreview: 'Ready',
    latestMessageAt: DateTime(2026, 7, 14),
  );
}

void main() {
  testWidgets('launch overlay remains until its content is ready', (
    tester,
  ) async {
    Widget host(bool ready) {
      return MaterialApp(
        home: CuppetLaunchScreen(
          ready: ready,
          child: const Scaffold(body: Text('Inbox content')),
        ),
      );
    }

    await tester.pumpWidget(host(false));
    expect(
      find.byKey(const ValueKey('cuppet-launch-animation')),
      findsOneWidget,
    );

    await tester.pumpWidget(host(true));
    await tester.pump(const Duration(milliseconds: 250));

    expect(find.byKey(const ValueKey('cuppet-launch-animation')), findsNothing);
    expect(find.text('Inbox content'), findsOneWidget);
  });

  testWidgets('AuthGate starts loading agents behind the launch overlay', (
    tester,
  ) async {
    final agentsResult = Completer<List<Agent>>();
    var requestStarted = false;

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_AuthenticatedController.new),
          agentsProvider.overrideWith(
            () => _PendingAgentsController(
              () => requestStarted = true,
              agentsResult,
            ),
          ),
        ],
        child: const MaterialApp(home: AuthGate()),
      ),
    );
    await tester.pump();

    expect(requestStarted, isTrue);
    expect(
      find.byKey(const ValueKey('cuppet-launch-animation')),
      findsOneWidget,
    );
    expect(find.text('Your delegation agents'), findsNothing);
  });

  test(
    'agents cache is cleared and reloaded when the account changes',
    () async {
      final service = _AccountAgentService();
      final container = ProviderContainer(
        overrides: [
          authControllerProvider.overrideWith(_SwitchableAuthController.new),
          agentServiceProvider.overrideWithValue(service),
        ],
      );
      addTearDown(container.dispose);

      await container.read(authControllerProvider.future);
      final subscription = container.listen(agentsProvider, (_, _) {});
      addTearDown(subscription.close);

      final firstAccountAgents = await container.read(agentsProvider.future);
      expect(firstAccountAgents.single.id, 'account-a-agent');

      final auth =
          container.read(authControllerProvider.notifier)
              as _SwitchableAuthController;
      auth.switchTo(const AuthState.signedOut());
      await Future<void>.delayed(Duration.zero);

      expect(container.read(agentsProvider).value, isEmpty);

      auth.switchTo(_account('account-b'));
      await Future<void>.delayed(Duration.zero);
      final secondAccountAgents = await container.read(agentsProvider.future);

      expect(secondAccountAgents.single.id, 'account-b-agent');
      expect(service.requestCount, 2);
    },
  );
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/config/routes.dart';
import 'package:sydney/design/tokens.dart';
import 'package:sydney/providers/agents_provider.dart';
import 'package:sydney/screens/create/confirm_screen.dart';
import 'package:sydney/screens/create/create_screen.dart';
import 'package:sydney/services/agent_service.dart';
import 'package:sydney/services/api.dart';

class _ParsedIntentAgentService extends AgentService {
  _ParsedIntentAgentService()
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  @override
  Future<Map<String, dynamic>> parseAgentPrompt(String prompt) async {
    return {
      'name': 'Morning Inbox',
      'action': 'Summarizes unread and important email.',
      'permissions_needed': ['Gmail'],
      'output_template': 'data_summary',
      'schedule_cron': '0 7 * * *',
    };
  }
}

void main() {
  testWidgets(
    'new agent page uses workspace hierarchy and preserves draft flow',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(360, 800));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      RouteSettings? pushedSettings;
      await tester.pumpWidget(
        MaterialApp(
          theme: SydneyTheme.light,
          home: const CreateScreen(),
          onGenerateRoute: (settings) {
            pushedSettings = settings;
            return MaterialPageRoute<void>(
              settings: settings,
              builder: (_) => const Scaffold(body: Text('Confirmation route')),
            );
          },
        ),
      );

      final scaffold = tester.widget<Scaffold>(
        find.byKey(const ValueKey('create-agent-screen')),
      );
      expect(scaffold.backgroundColor, CuppetWorkspaceColors.background);
      expect(find.text('Agent setup'), findsOneWidget);
      expect(find.text('Create an agent'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('creation-prompt-card')),
        findsOneWidget,
      );
      expect(find.text('Continue'), findsOneWidget);

      await tester.tap(find.text('Continue'));
      await tester.pump();
      expect(find.text('Describe what this agent should do.'), findsOneWidget);

      await tester.ensureVisible(find.text('News agent'));
      await tester.tap(find.text('News agent'));
      await tester.pump();

      final editor = tester.widget<TextField>(find.byType(TextField));
      expect(editor.controller!.text, contains('daily newsletter'));

      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(pushedSettings?.name, AppRoutes.confirmCreate);
      final draft = pushedSettings?.arguments as AgentCreationDraft;
      expect(draft.templateId, 'news');
      expect(draft.prompt, contains('daily newsletter'));
      expect(find.text('Confirmation route'), findsOneWidget);
    },
  );

  testWidgets('confirmation page presents parsed schedule and permissions', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          agentServiceProvider.overrideWithValue(_ParsedIntentAgentService()),
        ],
        child: MaterialApp(
          theme: SydneyTheme.light,
          home: const ConfirmScreen(
            draft: AgentCreationDraft(
              prompt: 'Summarize my inbox every morning.',
              templateId: 'email',
              templateLabel: 'Email agent',
              connectedTools: ['Gmail'],
              responseTiming: 'scheduled',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final scaffold = tester.widget<Scaffold>(
      find.byKey(const ValueKey('confirm-agent-screen')),
    );
    expect(scaffold.backgroundColor, CuppetWorkspaceColors.background);
    expect(find.text('Final review'), findsOneWidget);
    expect(find.text('Confirm your agent'), findsOneWidget);
    expect(find.text('Morning Inbox'), findsOneWidget);
    expect(find.byKey(const ValueKey('agent-review-card')), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('When it runs'),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Daily at 7:00 AM · your local time'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Connected tools required'),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Gmail'), findsOneWidget);
    expect(find.text('Create Agent'), findsOneWidget);
  });
}

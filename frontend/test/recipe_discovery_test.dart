import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/config/routes.dart';
import 'package:sydney/models/agent_recipe.dart';
import 'package:sydney/providers/agents_provider.dart';
import 'package:sydney/screens/create/create_screen.dart';
import 'package:sydney/services/agent_service.dart';
import 'package:sydney/services/api.dart';

class _RecipeService extends AgentService {
  _RecipeService(this.recipes)
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  final List<AgentRecipe> recipes;

  @override
  Future<List<AgentRecipe>> listRecipes() async => recipes;
}

class _FailingRecipeService extends AgentService {
  _FailingRecipeService()
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  int attempts = 0;

  @override
  Future<List<AgentRecipe>> listRecipes() async {
    attempts += 1;
    throw const ApiException('offline');
  }
}

void main() {
  testWidgets(
    'recipe discovery renders backend fields and preserves selection',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(360, 800));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      RouteSettings? pushed;
      final recipe = AgentRecipe.fromJson({
        'recipe_id': 'email_digest',
        'recipe_version': 1,
        'prompt_profile_version': 1,
        'display': {
          'name': 'Backend Email',
          'description': 'Loaded from the API',
          'icon': 'mail',
          'example_prompt': 'Summarize my inbox.',
        },
        'required_connectors': ['gmail'],
        'fields': [
          {
            'id': 'scope',
            'label': 'Message scope',
            'type': 'enum',
            'required': true,
            'default_value': 'unread',
            'options': [
              {'value': 'unread', 'label': 'Unread'},
              {'value': 'important', 'label': 'Important'},
            ],
          },
          {
            'id': 'schedule',
            'label': 'Schedule',
            'type': 'schedule',
            'required': true,
            'default_value': '0 18 * * *',
          },
        ],
      });

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            agentServiceProvider.overrideWithValue(_RecipeService([recipe])),
          ],
          child: MaterialApp(
            home: const CreateScreen(),
            onGenerateRoute: (settings) {
              pushed = settings;
              return MaterialPageRoute<void>(
                builder: (_) => const Scaffold(body: Text('next')),
              );
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Backend Email'), findsOneWidget);
      expect(find.text('News agent'), findsNothing);
      final emailCard = find.byKey(const ValueKey('agent-template-email'));
      await tester.ensureVisible(emailCard);
      await tester.tap(emailCard);
      await tester.pump();
      expect(
        tester.widget<TextField>(find.byType(TextField).first).controller!.text,
        'Summarize my inbox.',
      );
      await tester.fling(find.byType(ListView), const Offset(0, 1000), 1000);
      await tester.pumpAndSettle();
      expect(find.text('RECIPE SETTINGS'), findsOneWidget);
      expect(find.byKey(const ValueKey('recipe-field-scope')), findsOneWidget);

      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();
      expect(pushed?.name, AppRoutes.confirmCreate);
      final draft = pushed?.arguments as AgentCreationDraft;
      expect(draft.recipeId, 'email_digest');
      expect(draft.recipeVersion, 1);
      expect(draft.recipeInputs['scope'], 'unread');
      expect(draft.recipeInputs['schedule'], '0 18 * * *');
    },
  );

  testWidgets('recipe discovery failure shows custom plus retry only', (
    tester,
  ) async {
    final service = _FailingRecipeService();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [agentServiceProvider.overrideWithValue(service)],
        child: const MaterialApp(home: CreateScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const ValueKey('recipe-load-error')), findsOneWidget);
    expect(find.text('Custom agent'), findsOneWidget);
    expect(find.text('News agent'), findsNothing);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(service.attempts, 2);
  });
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config/routes.dart';
import 'design/tokens.dart';
import 'models/agent.dart';
import 'providers/auth_provider.dart';
import 'providers/messages_provider.dart';
import 'services/push_service.dart';
import 'screens/auth/sign_in_screen.dart';
import 'screens/auth/sign_up_screen.dart';
import 'screens/connectors/add_connector_screen.dart';
import 'screens/connectors/connectors_screen.dart';
import 'screens/create/confirm_screen.dart';
import 'screens/create/create_screen.dart';
import 'screens/inbox/inbox_screen.dart';
import 'screens/settings/settings_screen.dart';
import 'screens/thread/agent_preferences_screen.dart';
import 'screens/thread/thread_screen.dart';

class SydneyApp extends ConsumerWidget {
  const SydneyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Sydney',
      theme: SydneyTheme.light,
      home: const AuthGate(),
      onGenerateRoute: _onGenerateRoute,
    );
  }

  Route<dynamic> _onGenerateRoute(RouteSettings settings) {
    return switch (settings.name) {
      AppRoutes.signIn => _route(settings, const SignInScreen()),
      AppRoutes.signUp => _route(settings, const SignUpScreen()),
      AppRoutes.inbox => _route(settings, const InboxScreen()),
      AppRoutes.create => _route(settings, const CreateScreen()),
      AppRoutes.connectors => _route(settings, const ConnectorsScreen()),
      AppRoutes.addConnector => _route(settings, const AddConnectorScreen()),
      AppRoutes.agentPreferences => _route(
        settings,
        AgentPreferencesScreen(agent: settings.arguments as Agent),
      ),
      AppRoutes.settings => _route(settings, const SettingsScreen()),
      AppRoutes.thread => _threadRoute(settings),
      AppRoutes.confirmCreate => _confirmCreateRoute(settings),
      _ => _route(
        settings,
        const _RouteErrorScreen(message: 'That page is not available.'),
      ),
    };
  }

  Route<dynamic> _threadRoute(RouteSettings settings) {
    final args = settings.arguments;
    if (args is Agent) {
      return _route(settings, ThreadScreen(agent: args));
    }
    return _route(
      settings,
      const _RouteErrorScreen(message: 'Open a conversation from the inbox.'),
    );
  }

  Route<dynamic> _confirmCreateRoute(RouteSettings settings) {
    final args = settings.arguments;
    if (args is AgentCreationDraft) {
      return _route(settings, ConfirmScreen(draft: args));
    }
    return _route(
      settings,
      const _RouteErrorScreen(message: 'Start with a one-sentence agent idea.'),
    );
  }

  MaterialPageRoute<dynamic> _route(RouteSettings settings, Widget screen) {
    return MaterialPageRoute<dynamic>(
      settings: settings,
      builder: (_) => screen,
    );
  }
}

class AuthGate extends ConsumerWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    return auth.when(
      data: (state) {
        return state.isAuthenticated
            ? const RealtimeBridge(child: InboxScreen())
            : const SignInScreen();
      },
      loading: () => const _AppLoadingScreen(),
      error: (_, _) => const SignInScreen(),
    );
  }
}

class RealtimeBridge extends ConsumerStatefulWidget {
  const RealtimeBridge({required this.child, super.key});

  final Widget child;

  @override
  ConsumerState<RealtimeBridge> createState() => _RealtimeBridgeState();
}

class _RealtimeBridgeState extends ConsumerState<RealtimeBridge> {
  @override
  void initState() {
    super.initState();
    unawaited(
      Future<void>.microtask(() async {
        ref.read(messageActionsProvider).connectLiveUpdates();
        // Initialize push notifications after authentication
        try {
          final result = await ref.read(pushServiceProvider).configure();
          if (result.isEnabled) {
            print('Push notifications enabled (token: ${result.token != null})');
          } else {
            print('Push notifications declined by user');
          }
        } on PushSetupException catch (e) {
          // Firebase not configured or platform not supported — non-fatal
          print('Push notification setup skipped: $e');
        }
      }),
    );
  }

  @override
  void dispose() {
    unawaited(ref.read(messageActionsProvider).disconnectLiveUpdates());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(liveEventsProvider, (_, next) {
      next.whenData((event) => handleRealtimeEvent(ref, event));
    });

    return widget.child;
  }
}

class _AppLoadingScreen extends StatelessWidget {
  const _AppLoadingScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(SydneySpacing.page),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(),
              Text('Sydney', style: Theme.of(context).textTheme.displaySmall),
              const SizedBox(height: SydneySpacing.sm),
              Text(
                'Opening your conversations...',
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: SydneyColors.mutedInk),
              ),
              const SizedBox(height: SydneySpacing.xl),
              ClipRRect(
                borderRadius: BorderRadius.circular(SydneyRadius.full),
                child: const LinearProgressIndicator(
                  minHeight: 4,
                  color: SydneyColors.primary,
                  backgroundColor: SydneyColors.primarySoft,
                ),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

class _RouteErrorScreen extends StatelessWidget {
  const _RouteErrorScreen({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Padding(
        padding: const EdgeInsets.all(SydneySpacing.page),
        child: Center(
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ),
      ),
    );
  }
}

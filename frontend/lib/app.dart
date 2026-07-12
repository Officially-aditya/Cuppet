import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config/routes.dart';
import 'design/tokens.dart';
import 'models/agent.dart';
import 'providers/auth_provider.dart';
import 'providers/agents_provider.dart';
import 'providers/messages_provider.dart';
import 'services/push_service.dart';
import 'services/notification_clear_service.dart';
import 'screens/auth/sign_in_screen.dart';
import 'screens/auth/sign_up_screen.dart';
import 'screens/connectors/add_connector_screen.dart';
import 'screens/connectors/connectors_screen.dart';
import 'screens/create/confirm_screen.dart';
import 'screens/create/create_screen.dart';
import 'screens/inbox/inbox_screen.dart';
import 'screens/launch/cuppet_launch_screen.dart';
import 'screens/settings/settings_screen.dart';
import 'screens/thread/agent_preferences_screen.dart';
import 'screens/thread/thread_screen.dart';

class SydneyApp extends ConsumerWidget {
  const SydneyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Cuppet',
      theme: SydneyTheme.light,
      home: const CuppetLaunchScreen(child: AuthGate()),
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
            debugPrint(
              'Push notifications enabled (token: ${result.token != null})',
            );
          } else {
            debugPrint('Push notifications declined by user');
          }
        } on PushSetupException catch (e) {
          // Firebase not configured or platform not supported — non-fatal
          debugPrint('Push notification setup skipped: $e');
        }

        // Setup click handlers!
        await _setupNotificationClickHandlers();
      }),
    );
  }

  Future<void> _setupNotificationClickHandlers() async {
    if (Firebase.apps.isEmpty) {
      debugPrint(
        'Firebase not initialized. Skipping notification click handlers.',
      );
      return;
    }

    // 1. Handle notification that launched the app from a terminated state
    try {
      final initialMessage =
          await FirebaseMessaging.instance.getInitialMessage();
      if (initialMessage != null) {
        _handleNotificationClick(initialMessage);
      }
    } catch (e) {
      debugPrint('Error getting initial messaging: $e');
    }

    // 2. Handle notifications clicked while the app is in the background
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _handleNotificationClick(message);
    });
  }

  void _handleNotificationClick(RemoteMessage message) async {
    NotificationClearService.clearAll();
    final data = message.data;
    final agentId = data['agent_id']?.toString() ?? data['agentId']?.toString();
    if (agentId == null || agentId.isEmpty) {
      return;
    }

    try {
      // Retrieve the list of agents
      final agentsList = await ref.read(agentsProvider.future);
      final agent = agentsList.firstWhere((a) => a.id == agentId);

      if (mounted) {
        Navigator.of(context).pushNamed(AppRoutes.thread, arguments: agent);
      }
    } catch (_) {
      // Refresh list if not found
      try {
        await ref.read(agentsProvider.notifier).refresh();
        final agentsList = ref.read(agentsProvider).value;
        if (agentsList != null) {
          final agent = agentsList.firstWhere((a) => a.id == agentId);
          if (mounted) {
            Navigator.of(context).pushNamed(AppRoutes.thread, arguments: agent);
          }
        }
      } catch (_) {
        // Agent not found
      }
    }
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
class _AppLoadingScreen extends StatefulWidget {
  const _AppLoadingScreen();

  @override
  State<_AppLoadingScreen> createState() => _AppLoadingScreenState();
}

class _AppLoadingScreenState extends State<_AppLoadingScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacityAnimation;
  late final Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    );

    _opacityAnimation = Tween<double>(begin: 0.6, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _scaleAnimation = Tween<double>(begin: 0.88, end: 1.12).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );

    _controller.repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SydneyColors.surfaceContainerLowest,
      body: Center(
        child: FadeTransition(
          opacity: _opacityAnimation,
          child: ScaleTransition(
            scale: _scaleAnimation,
            child: Image.asset(
              'assets/logos/cuppet.png',
              width: 120,
              height: 120,
              fit: BoxFit.contain,
            ),
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

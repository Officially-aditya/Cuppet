import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/config/routes.dart';
import 'package:sydney/design/colors.dart';
import 'package:sydney/design/workspace_palette.dart';
import 'package:sydney/models/connector.dart';
import 'package:sydney/providers/auth_provider.dart';
import 'package:sydney/providers/connectors_provider.dart';
import 'package:sydney/providers/timezone_provider.dart';
import 'package:sydney/screens/connectors/connectors_screen.dart';
import 'package:sydney/screens/settings/settings_screen.dart';
import 'package:sydney/screens/settings/profile_screen.dart';
import 'package:sydney/widgets/app_bottom_nav.dart';
import 'package:sydney/widgets/workspace_primitives.dart';

class _TestConnectorsController extends ConnectorsController {
  @override
  Future<List<Connector>> build() async => const [];
}

class _SignedOutAuthController extends AuthController {
  @override
  Future<AuthState> build() async => const AuthState.signedOut();
}

class _TestTimezoneController extends TimezonePreferencesController {
  @override
  Future<TimezonePreferencesState> build() async {
    return const TimezonePreferencesState(
      userId: 'test-user',
      detectedTimeZone: 'Asia/Kolkata',
      savedTimeZone: 'Asia/Kolkata',
      followDeviceTimeZone: true,
      preferencesLoaded: true,
    );
  }

  @override
  Future<bool> setFollowDeviceTimeZone(bool follow) async {
    final current = state.value;
    if (current == null) return false;
    state = AsyncValue.data(
      current.copyWith(followDeviceTimeZone: follow, isUpdating: false),
    );
    return true;
  }
}

Widget navigationHost(Widget screen) {
  return ProviderScope(
    overrides: [
      connectorsProvider.overrideWith(_TestConnectorsController.new),
      authControllerProvider.overrideWith(_SignedOutAuthController.new),
      timezonePreferencesProvider.overrideWith(_TestTimezoneController.new),
    ],
    child: MaterialApp(
      home: screen,
      routes: {
        AppRoutes.connectors:
            (_) => const Scaffold(body: Text('Connectors destination')),
        AppRoutes.storage:
            (_) => const Scaffold(body: Text('Storage destination')),
        AppRoutes.profile:
            (_) => const ProfileScreen(),
      },
    ),
  );
}

void main() {
  test('workspace palette keeps brand primary and secondary greens', () {
    expect(CuppetWorkspaceColors.primary, const Color(0xFF006046));
    expect(CuppetWorkspaceColors.secondary, const Color(0xFF3F7D57));
    expect(CuppetWorkspaceColors.sage, CuppetWorkspaceColors.secondary);
    expect(CuppetWorkspaceColors.primaryInk, const Color(0xFF004D39));
    expect(SydneyColors.primary, CuppetWorkspaceColors.primary);
    expect(SydneyColors.secondary, CuppetWorkspaceColors.secondary);
  });

  testWidgets('connectors is a main destination with persistent navigation', (
    tester,
  ) async {
    await tester.pumpWidget(navigationHost(const ConnectorsScreen()));
    await tester.pumpAndSettle();

    final navigation = tester.widget<AppBottomNav>(find.byType(AppBottomNav));
    expect(navigation.currentIndex, 1);
    expect(find.byTooltip('Back'), findsNothing);
    expect(find.text('Inbox'), findsOneWidget);
    expect(find.text('Connectors'), findsWidgets);
    expect(find.text('Settings'), findsOneWidget);
  });

  testWidgets('settings keeps sign out and persistent main navigation', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(568, 768));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(navigationHost(const SettingsScreen()));
    await tester.pumpAndSettle();

    final navigation = tester.widget<AppBottomNav>(find.byType(AppBottomNav));
    expect(navigation.currentIndex, 2);
    expect(find.byTooltip('Back'), findsNothing);
    expect(find.byType(WorkspaceAppBar), findsOneWidget);
    expect(find.text('Your account'), findsOneWidget);
    expect(find.text('Preferences, security and scheduling.'), findsOneWidget);
    expect(find.byKey(const ValueKey('settings-profile-card')), findsOneWidget);
    expect(find.byKey(const ValueKey('settings-push-card')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('settings-timezone-card')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('settings-connectors-card')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('settings-storage-card')), findsOneWidget);
    expect(find.byType(WorkspaceSectionLabel), findsNWidgets(4));
    expect(find.text('Push notifications'), findsOneWidget);
    expect(find.text('Automatic time zone'), findsOneWidget);
    expect(find.text('Sign out'), findsOneWidget);
    final signOutButton = tester.widget<OutlinedButton>(
      find.byKey(const ValueKey('settings-sign-out')),
    );
    expect(
      signOutButton.style?.foregroundColor?.resolve(const {}),
      SydneyColors.danger,
    );
    expect(
      signOutButton.style?.side?.resolve(const {})?.color,
      SydneyColors.danger,
    );

    // Tap on profile card to open the Profile Screen
    await tester.tap(find.byKey(const ValueKey('settings-profile-card')));
    await tester.pumpAndSettle();

    // Now we are on Profile Screen
    expect(find.text('Profile'), findsOneWidget);
    expect(find.text('What should cuppet call you'), findsOneWidget);
    expect(find.byKey(const ValueKey('settings-delete-account-card')), findsOneWidget);

    // Tap back button to return to Settings Screen
    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();

    expect(find.text('Inbox'), findsOneWidget);
    expect(find.text('Connectors'), findsWidgets);
    expect(find.text('Settings'), findsWidgets);

    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('settings-privacy-card')),
      180,
    );
    expect(find.byKey(const ValueKey('settings-privacy-card')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('settings opens Storage from its dedicated card', (tester) async {
    await tester.binding.setSurfaceSize(const Size(568, 768));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(navigationHost(const SettingsScreen()));
    await tester.pumpAndSettle();

    final storageCard = find.byKey(const ValueKey('settings-storage-card'));
    await tester.scrollUntilVisible(storageCard, 180);
    await tester.tap(storageCard);
    await tester.pumpAndSettle();

    expect(find.text('Storage destination'), findsOneWidget);
  });

  testWidgets('settings keeps automatic timezone and connector actions wired', (
    tester,
  ) async {
    await tester.pumpWidget(navigationHost(const SettingsScreen()));
    await tester.pumpAndSettle();

    final timeZoneSwitch = find.byKey(
      const ValueKey('automatic-timezone-switch'),
    );
    expect(timeZoneSwitch, findsOneWidget);
    expect(tester.widget<Switch>(timeZoneSwitch).value, isTrue);
    expect(tester.getSize(timeZoneSwitch).height, greaterThanOrEqualTo(48));

    await tester.tap(timeZoneSwitch);
    await tester.pumpAndSettle();

    expect(tester.widget<Switch>(timeZoneSwitch).value, isFalse);
    expect(find.text('Fixed time zone'), findsOneWidget);

    final connectorCard = find.byKey(
      const ValueKey('settings-connectors-card'),
    );
    await tester.scrollUntilVisible(connectorCard, 180);
    await tester.tap(connectorCard);
    await tester.pumpAndSettle();

    expect(find.text('Connectors destination'), findsOneWidget);
  });

  testWidgets('bottom navigation is accessible, sage, and touch friendly', (
    tester,
  ) async {
    var selectedIndex = -1;
    final semantics = tester.ensureSemantics();

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          bottomNavigationBar: AppBottomNav(
            currentIndex: 2,
            onSelected: (index) => selectedIndex = index,
          ),
        ),
      ),
    );

    for (final destination in ['inbox', 'connectors', 'settings']) {
      final target = find.byKey(ValueKey('bottom-nav-$destination'));
      expect(target, findsOneWidget);
      final size = tester.getSize(target);
      expect(size.width, greaterThanOrEqualTo(48));
      expect(size.height, greaterThanOrEqualTo(48));
    }

    expect(
      tester.getSemantics(find.byKey(const ValueKey('bottom-nav-settings'))),
      matchesSemantics(
        label: 'Settings',
        isButton: true,
        hasSelectedState: true,
        isSelected: true,
        hasTapAction: true,
      ),
    );
    expect(
      tester.widget<Icon>(find.byIcon(Icons.settings_outlined)).color,
      CuppetWorkspaceColors.primaryInk,
    );

    await tester.tap(find.byKey(const ValueKey('bottom-nav-inbox')));
    expect(selectedIndex, 0);
    semantics.dispose();
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/providers/auth_provider.dart';
import 'package:sydney/providers/connectors_provider.dart';
import 'package:sydney/models/connector.dart';
import 'package:sydney/screens/connectors/connectors_screen.dart';
import 'package:sydney/screens/settings/settings_screen.dart';
import 'package:sydney/widgets/app_bottom_nav.dart';

class _TestConnectorsController extends ConnectorsController {
  @override
  Future<List<Connector>> build() async => const [];
}

class _SignedOutAuthController extends AuthController {
  @override
  Future<AuthState> build() async => const AuthState.signedOut();
}

Widget navigationHost(Widget screen) {
  return ProviderScope(
    overrides: [
      connectorsProvider.overrideWith(_TestConnectorsController.new),
      authControllerProvider.overrideWith(_SignedOutAuthController.new),
    ],
    child: MaterialApp(home: screen),
  );
}

void main() {
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
    await tester.pumpWidget(navigationHost(const SettingsScreen()));
    await tester.pump();

    final navigation = tester.widget<AppBottomNav>(find.byType(AppBottomNav));
    expect(navigation.currentIndex, 2);
    expect(find.byTooltip('Back'), findsNothing);
    expect(find.text('Sign out'), findsOneWidget);
    expect(find.text('Inbox'), findsOneWidget);
    expect(find.text('Connectors'), findsWidgets);
    expect(find.text('Settings'), findsWidgets);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/providers/auth_provider.dart';
import 'package:sydney/screens/auth/forgot_password_screen.dart';
import 'package:sydney/services/api.dart';
import 'package:sydney/services/auth_service.dart';

class _ResetAuthService extends AuthService {
  _ResetAuthService()
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  String? requestedEmail;

  @override
  Future<void> requestPasswordReset({required String email}) async {
    requestedEmail = email;
  }
}

void main() {
  testWidgets('forgot password requests a reset link generically', (
    tester,
  ) async {
    final service = _ResetAuthService();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authServiceProvider.overrideWithValue(service)],
        child: const MaterialApp(home: ForgotPasswordScreen()),
      ),
    );

    await tester.enterText(find.byType(TextFormField), 'alex@example.com');
    await tester.tap(find.text('Send reset link'));
    await tester.pumpAndSettle();

    expect(service.requestedEmail, 'alex@example.com');
    expect(
      find.text(
        'If an account uses that email, we’ll send a reset link. Check your inbox.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('forgot password validates the email before requesting', (
    tester,
  ) async {
    final service = _ResetAuthService();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authServiceProvider.overrideWithValue(service)],
        child: const MaterialApp(home: ForgotPasswordScreen()),
      ),
    );

    await tester.enterText(find.byType(TextFormField), 'not-an-email');
    await tester.tap(find.text('Send reset link'));
    await tester.pumpAndSettle();

    expect(service.requestedEmail, isNull);
    expect(find.text('Enter a valid email address.'), findsOneWidget);
  });
}

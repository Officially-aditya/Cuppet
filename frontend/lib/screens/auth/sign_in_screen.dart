import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/auth/auth_widgets.dart';
import '../../widgets/sydney_primitives.dart';
import '../../widgets/workspace_primitives.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});
  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  // NOTE: The email sign-in form is now navigated to a separate screen (AppRoutes.signInWithEmail).
  // The state variables and methods related to the inline email form have been removed.
  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final loading = auth.isLoading;
    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(
                horizontal: SydneySpacing.page,
                vertical: SydneySpacing.md,
              ),
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: 420,
                    minHeight: constraints.maxHeight - (SydneySpacing.md * 2),
                  ),
                  child: IntrinsicHeight(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // --- TOP BRAND & HEADER ---
                        Column(
                          children: [
                            const SizedBox(height: SydneySpacing.lg),
                            const AuthLogo(),
                            const SizedBox(height: 48.0),
                            Text(
                              'Welcome back',
                              textAlign: TextAlign.center,
                              style: Theme.of(
                                context,
                              ).textTheme.headlineSmall?.copyWith(
                                fontSize: 30,
                                fontWeight: FontWeight.w800,
                                color: CuppetWorkspaceColors.ink,
                                height: 1.1,
                                letterSpacing: -0.8,
                              ),
                            ),
                            const SizedBox(height: SydneySpacing.sm + 2),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 28.0,
                              ),
                              child: Text(
                                'Delegate work through conversations with agents you trust.',
                                textAlign: TextAlign.center,
                                style: Theme.of(
                                  context,
                                ).textTheme.bodyMedium?.copyWith(
                                  color: CuppetWorkspaceColors.muted,
                                  fontSize: 14.5,
                                  height: 1.45,
                                ),
                              ),
                            ),
                            const SizedBox(height: 16.0),
                          ],
                        ),

                        // --- MIDDLE SIGN IN OPTIONS ---
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: SydneySpacing.xl,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const WorkspaceSectionLabel('Sign in'),
                              const SizedBox(height: SydneySpacing.md),
                              if (auth.hasError) ...[
                                SydneyNotice(
                                  text: readableAuthError(auth.error!),
                                  icon: Icons.error_outline_rounded,
                                  iconColor: SydneyColors.danger,
                                  backgroundColor: SydneyColors.dangerSoft,
                                  borderColor: SydneyColors.dangerSoft,
                                  textColor: SydneyColors.danger,
                                ),
                                const SizedBox(height: SydneySpacing.md),
                              ],
                              LoginOptionCard(
                                title:
                                    loading
                                        ? 'Signing in...'
                                        : 'Sign in with Google',
                                subtitle:
                                    'Access your account with your Google account.',
                                leadingWidget: const GoogleMark(),
                                onTap: loading ? null : _continueWithGoogle,
                              ),
                              const SizedBox(height: SydneySpacing.md),
                              LoginOptionCard(
                                title: 'Sign in with Email',
                                subtitle:
                                    'Access your account with your email and password.',
                                icon: Icons.mail_outline_rounded,
                                onTap:
                                    loading
                                        ? null
                                        : () => Navigator.of(
                                          context,
                                        ).pushNamed(AppRoutes.signInWithEmail),
                              ),
                            ],
                          ),
                        ),

                        // --- BOTTOM FOOTER & NAVIGATION ---
                        Column(
                          children: [
                            const AuthDividerLabel(),
                            const SizedBox(height: SydneySpacing.md),
                            Wrap(
                              alignment: WrapAlignment.center,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              children: [
                                Text(
                                  "Don't have an account?",
                                  style: Theme.of(
                                    context,
                                  ).textTheme.bodySmall?.copyWith(
                                    color: CuppetWorkspaceColors.muted,
                                    fontSize: 13.5,
                                  ),
                                ),
                                TextButton(
                                  onPressed:
                                      loading
                                          ? null
                                          : () => Navigator.of(
                                            context,
                                          ).pushNamed(AppRoutes.signUp),
                                  style: TextButton.styleFrom(
                                    foregroundColor:
                                        CuppetWorkspaceColors.primary,
                                    textStyle: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13.5,
                                    ),
                                  ),
                                  child: const Text('Create one'),
                                ),
                              ],
                            ),
                            const SizedBox(height: SydneySpacing.xs),
                            Text(
                              'By continuing, you agree to Cuppet\'s Terms & Privacy Policy.',
                              textAlign: TextAlign.center,
                              style: Theme.of(
                                context,
                              ).textTheme.labelSmall?.copyWith(
                                color: CuppetWorkspaceColors.muted.withValues(
                                  alpha: 0.7,
                                ),
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: SydneySpacing.md),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Future<void> _continueWithGoogle() async {
    await ref.read(authControllerProvider.notifier).continueWithGoogle();
    if (!mounted) {
      return;
    }
    final state = ref.read(authControllerProvider).asData?.value;
    if (state?.isAuthenticated == true) {
      final destination =
          state!.isNewUser
              ? AppRoutes.personalizationOnboarding
              : AppRoutes.inbox;
      Navigator.of(
        context,
      ).pushNamedAndRemoveUntil(destination, (route) => false);
    }
  }
}

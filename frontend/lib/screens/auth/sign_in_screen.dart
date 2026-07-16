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
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _showPassword = false;
  bool _showEmailForm = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final loading = auth.isLoading;

    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                SydneySpacing.page,
                SydneySpacing.xxl,
                SydneySpacing.page,
                SydneySpacing.xl,
              ),
              children: [
                const SizedBox(height: SydneySpacing.xl),
                const AuthLogo(),
                const SizedBox(height: SydneySpacing.lg),
                Text(
                  'Welcome back',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: CuppetWorkspaceColors.ink,
                    height: 1.05,
                    letterSpacing: -0.7,
                  ),
                ),
                const SizedBox(height: SydneySpacing.sm),
                Text(
                  'Delegate work through conversations with agents you trust.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: CuppetWorkspaceColors.muted,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: SydneySpacing.xxl),
                const WorkspaceSectionLabel('Sign in'),
                const SizedBox(height: SydneySpacing.sm),
                LoginOptionCard(
                  title: 'Sign in with Google',
                  subtitle: 'Access your account instantly with Google',
                  leadingWidget: const GoogleMark(),
                  onTap: loading ? null : _continueWithGoogle,
                ),
                const SizedBox(height: SydneySpacing.sm),
                LoginOptionCard(
                  title: 'Sign in with Email',
                  subtitle: 'Use your email address and password',
                  icon: Icons.mail_outline_rounded,
                  leadingIconColor: CuppetWorkspaceColors.primaryInk,
                  onTap: () => setState(() => _showEmailForm = !_showEmailForm),
                ),
                if (_showEmailForm) ...[
                  const SizedBox(height: SydneySpacing.md),
                  AnimatedSize(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeInOut,
                    child: WorkspaceCard(
                      padding: const EdgeInsets.all(SydneySpacing.lg),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          children: [
                            AuthField(
                              label: 'Email Address',
                              controller: _emailController,
                              icon: Icons.mail_outline_rounded,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              validator:
                                  (value) =>
                                      value == null || value.trim().isEmpty
                                          ? 'Enter your email.'
                                          : null,
                            ),
                            const SizedBox(height: SydneySpacing.lg),
                            AuthField(
                              label: 'Password',
                              controller: _passwordController,
                              icon: Icons.lock_outline_rounded,
                              obscureText: !_showPassword,
                              textInputAction: TextInputAction.done,
                              suffix: IconButton(
                                tooltip:
                                    _showPassword
                                        ? 'Hide password'
                                        : 'Show password',
                                onPressed:
                                    () => setState(
                                      () => _showPassword = !_showPassword,
                                    ),
                                icon: Icon(
                                  _showPassword
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  size: 18,
                                  color: CuppetWorkspaceColors.muted,
                                ),
                              ),
                              validator:
                                  (value) =>
                                      value == null || value.isEmpty
                                          ? 'Enter your password.'
                                          : null,
                              onFieldSubmitted: (_) => _submit(),
                            ),
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton(
                                onPressed: loading ? null : () {},
                                style: TextButton.styleFrom(
                                  foregroundColor:
                                      CuppetWorkspaceColors.primary,
                                  textStyle: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                child: const Text('Forgot Password?'),
                              ),
                            ),
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
                            AuthPrimaryButton(
                              label: loading ? 'Signing in...' : 'Sign In',
                              onPressed: loading ? null : _submit,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: SydneySpacing.xxl),
                const AuthDividerLabel(),
                const SizedBox(height: SydneySpacing.lg),
                Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      "Don't have an account?",
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: CuppetWorkspaceColors.muted,
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
                        foregroundColor: CuppetWorkspaceColors.primary,
                        textStyle: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      child: const Text('Create one'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    await ref
        .read(authControllerProvider.notifier)
        .signIn(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
    if (!mounted) {
      return;
    }
    final state = ref.read(authControllerProvider).asData?.value;
    if (state?.isAuthenticated == true) {
      Navigator.of(
        context,
      ).pushNamedAndRemoveUntil(AppRoutes.inbox, (route) => false);
    }
  }

  Future<void> _continueWithGoogle() async {
    await ref.read(authControllerProvider.notifier).continueWithGoogle();
    if (!mounted) {
      return;
    }
    final state = ref.read(authControllerProvider).asData?.value;
    if (state?.isAuthenticated == true) {
      Navigator.of(
        context,
      ).pushNamedAndRemoveUntil(AppRoutes.inbox, (route) => false);
    }
  }
}

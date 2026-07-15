import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/auth/auth_widgets.dart';
import '../../widgets/sydney_primitives.dart';
import '../../widgets/workspace_primitives.dart';

class SignUpScreen extends ConsumerStatefulWidget {
  const SignUpScreen({super.key});

  @override
  ConsumerState<SignUpScreen> createState() => _SignUpScreenState();
}

class _SignUpScreenState extends ConsumerState<SignUpScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _showPassword = false;
  bool _showConfirm = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
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
                const AuthLogo(),
                const SizedBox(height: SydneySpacing.lg),
                Text(
                  'Create account',
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
                const SizedBox(height: SydneySpacing.xl),
                const WorkspaceSectionLabel('Account details'),
                const SizedBox(height: SydneySpacing.sm),
                WorkspaceCard(
                  padding: const EdgeInsets.all(SydneySpacing.lg),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      children: [
                        AuthField(
                          label: 'Full Name',
                          controller: _nameController,
                          icon: Icons.person_outline_rounded,
                          textInputAction: TextInputAction.next,
                          validator:
                              (value) =>
                                  value == null || value.trim().isEmpty
                                      ? 'Enter your name.'
                                      : null,
                        ),
                        const SizedBox(height: 14),
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
                        const SizedBox(height: 14),
                        AuthField(
                          label: 'Password',
                          controller: _passwordController,
                          icon: Icons.lock_outline_rounded,
                          obscureText: !_showPassword,
                          textInputAction: TextInputAction.next,
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
                                  value == null || value.length < 8
                                      ? 'Use at least 8 characters.'
                                      : null,
                        ),
                        const SizedBox(height: 14),
                        AuthField(
                          label: 'Password Confirmation',
                          controller: _confirmController,
                          icon: Icons.key_outlined,
                          obscureText: !_showConfirm,
                          textInputAction: TextInputAction.done,
                          suffix: IconButton(
                            tooltip:
                                _showConfirm
                                    ? 'Hide password'
                                    : 'Show password',
                            onPressed:
                                () => setState(
                                  () => _showConfirm = !_showConfirm,
                                ),
                            icon: Icon(
                              _showConfirm
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 18,
                              color: CuppetWorkspaceColors.muted,
                            ),
                          ),
                          validator:
                              (value) =>
                                  value != _passwordController.text
                                      ? 'Passwords do not match.'
                                      : null,
                          onFieldSubmitted: (_) => _submit(),
                        ),
                      ],
                    ),
                  ),
                ),
                if (auth.hasError) ...[
                  const SizedBox(height: SydneySpacing.sm),
                  SydneyNotice(
                    text: readableAuthError(auth.error!),
                    icon: Icons.error_outline_rounded,
                    iconColor: SydneyColors.danger,
                    backgroundColor: SydneyColors.dangerSoft,
                    borderColor: SydneyColors.dangerSoft,
                    textColor: SydneyColors.danger,
                  ),
                ],
                const SizedBox(height: SydneySpacing.lg),
                AuthPrimaryButton(
                  label: loading ? 'Creating...' : 'Create Account',
                  onPressed: loading ? null : _submit,
                ),
                const SizedBox(height: SydneySpacing.lg),
                const AuthDividerLabel(),
                const SizedBox(height: SydneySpacing.lg),
                AuthSecondaryButton(
                  label: 'Sign up with Google',
                  icon: const GoogleMark(),
                  onPressed: loading ? null : _continueWithGoogle,
                ),
                const SizedBox(height: SydneySpacing.xl),
                Wrap(
                  alignment: WrapAlignment.center,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      'Already have an account?',
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
                              ).pushNamedAndRemoveUntil(
                                AppRoutes.signIn,
                                (route) => false,
                              ),
                      style: TextButton.styleFrom(
                        foregroundColor: CuppetWorkspaceColors.primary,
                        textStyle: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      child: const Text('Sign in'),
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
        .signUp(
          displayName: _nameController.text.trim(),
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

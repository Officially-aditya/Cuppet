import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/sydney_primitives.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController(text: 'user@session.local');
  final _passwordController = TextEditingController(text: 'sydneysafepass');
  bool _showPassword = false;

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
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(24, 40, 24, 28),
              children: [
                const SizedBox(height: SydneySpacing.xxl),
                const _AuthLogo(),
                const SizedBox(height: SydneySpacing.lg),
                Text(
                  'Welcome back',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: SydneySpacing.sm),
                Text(
                  'Delegate work through conversations with agents you trust.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: SydneyColors.mutedInk,
                  ),
                ),
                const SizedBox(height: SydneySpacing.xxl),
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      _AuthField(
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
                      _AuthField(
                        label: 'Password',
                        controller: _passwordController,
                        icon: Icons.lock_outline_rounded,
                        obscureText: !_showPassword,
                        textInputAction: TextInputAction.done,
                        suffix: IconButton(
                          tooltip:
                              _showPassword ? 'Hide password' : 'Show password',
                          onPressed:
                              () => setState(
                                () => _showPassword = !_showPassword,
                              ),
                          icon: Icon(
                            _showPassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 18,
                            color: SydneyColors.outline,
                          ),
                        ),
                        validator:
                            (value) =>
                                value == null || value.isEmpty
                                    ? 'Enter your password.'
                                    : null,
                        onFieldSubmitted: (_) => _submit(),
                      ),
                    ],
                  ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: loading ? null : () {},
                    child: const Text('Forgot Password?'),
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
                const SizedBox(height: SydneySpacing.md),
                FilledButton(
                  onPressed: loading ? null : _submit,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                  child: Text(loading ? 'Signing in...' : 'Sign In'),
                ),
                const SizedBox(height: SydneySpacing.xl),
                const _DividerLabel(),
                const SizedBox(height: SydneySpacing.xl),
                OutlinedButton.icon(
                  onPressed: loading ? null : _continueWithGoogle,
                  icon: const _GoogleMark(),
                  label: const Text('Sign in with Google'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: SydneyColors.onSurface,
                    minimumSize: const Size.fromHeight(48),
                  ),
                ),
                const SizedBox(height: SydneySpacing.xxl),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      "Don't have an account?",
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: SydneyColors.onSurfaceVariant,
                      ),
                    ),
                    TextButton(
                      onPressed:
                          loading
                              ? null
                              : () => Navigator.of(
                                context,
                              ).pushNamed(AppRoutes.signUp),
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

class _AuthLogo extends StatelessWidget {
  const _AuthLogo();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: SydneyPanel(
        padding: EdgeInsets.zero,
        radius: SydneyRadius.lg,
        child: SydneyIconBadge(
          size: 64,
          radius: SydneyRadius.lg,
          color: SydneyColors.surfaceContainerLowest,
          foregroundColor: SydneyColors.primary,
          child: Text('S'),
        ),
      ),
    );
  }
}

class _AuthField extends StatelessWidget {
  const _AuthField({
    required this.label,
    required this.controller,
    required this.icon,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.validator,
    this.suffix,
    this.onFieldSubmitted,
  });

  final String label;
  final TextEditingController controller;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final String? Function(String?)? validator;
  final Widget? suffix;
  final ValueChanged<String>? onFieldSubmitted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: SydneySpacing.xs, bottom: 6),
          child: Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              letterSpacing: 0.7,
            ),
          ),
        ),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          obscureText: obscureText,
          validator: validator,
          onFieldSubmitted: onFieldSubmitted,
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 18, color: SydneyColors.outline),
            suffixIcon: suffix,
          ),
        ),
      ],
    );
  }
}

class _DividerLabel extends StatelessWidget {
  const _DividerLabel();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: SydneyColors.line)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: SydneySpacing.md),
          child: Text(
            'OR',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              letterSpacing: 0.8,
            ),
          ),
        ),
        const Expanded(child: Divider(color: SydneyColors.line)),
      ],
    );
  }
}

class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) {
    return const Text(
      'G',
      style: TextStyle(color: Color(0xFFEA4335), fontWeight: FontWeight.w900),
    );
  }
}

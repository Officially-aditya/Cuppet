import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/animations.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController(text: 'alex@sydney.app');
  final _passwordController = TextEditingController(text: 'password');

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
        child: ListView(
          padding: const EdgeInsets.all(SydneySpacing.page),
          children: [
            const SizedBox(height: SydneySpacing.xxl),
            FadeSlideIn(
              child: Text(
                'Sydney',
                style: Theme.of(context).textTheme.displaySmall,
              ),
            ),
            const SizedBox(height: SydneySpacing.sm),
            Text(
              'Delegate work through conversations with agents you trust.',
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(color: SydneyColors.mutedInk),
            ),
            const SizedBox(height: SydneySpacing.xxl),
            Form(
              key: _formKey,
              child: Column(
                children: [
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      hintText: 'you@example.com',
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Enter your email.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: SydneySpacing.md),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    textInputAction: TextInputAction.done,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      hintText: 'Your password',
                    ),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Enter your password.';
                      }
                      return null;
                    },
                    onFieldSubmitted: (_) => _submit(),
                  ),
                ],
              ),
            ),
            if (auth.hasError) ...[
              const SizedBox(height: SydneySpacing.md),
              _InlineError(message: readableAuthError(auth.error!)),
            ],
            const SizedBox(height: SydneySpacing.xl),
            FilledButton(
              onPressed: loading ? null : _submit,
              child: Text(loading ? 'Signing in...' : 'Sign in'),
            ),
            const SizedBox(height: SydneySpacing.sm),
            TextButton(
              onPressed:
                  loading
                      ? null
                      : () => Navigator.of(context).pushNamed(AppRoutes.signUp),
              child: const Text('Create an account'),
            ),
          ],
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
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SydneySpacing.md),
      decoration: BoxDecoration(
        color: SydneyColors.dangerSoft,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
      ),
      child: Text(
        message,
        style: Theme.of(
          context,
        ).textTheme.bodyMedium?.copyWith(color: SydneyColors.danger),
      ),
    );
  }
}

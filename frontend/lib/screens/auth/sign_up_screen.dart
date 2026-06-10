import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';

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

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final loading = auth.isLoading;

    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SydneySpacing.page),
          children: [
            Text(
              'Create your Sydney account',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: SydneySpacing.sm),
            Text(
              'Your agents stay in conversation threads. Connectors are approved later, one by one.',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: SydneyColors.mutedInk),
            ),
            const SizedBox(height: SydneySpacing.xl),
            Form(
              key: _formKey,
              child: Column(
                children: [
                  TextFormField(
                    controller: _nameController,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(labelText: 'Name'),
                    validator:
                        (value) =>
                            value == null || value.trim().isEmpty
                                ? 'Enter your name.'
                                : null,
                  ),
                  const SizedBox(height: SydneySpacing.md),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(labelText: 'Email'),
                    validator:
                        (value) =>
                            value == null || value.trim().isEmpty
                                ? 'Enter your email.'
                                : null,
                  ),
                  const SizedBox(height: SydneySpacing.md),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Password'),
                    validator:
                        (value) =>
                            value == null || value.length < 8
                                ? 'Use at least 8 characters.'
                                : null,
                    onFieldSubmitted: (_) => _submit(),
                  ),
                ],
              ),
            ),
            if (auth.hasError) ...[
              const SizedBox(height: SydneySpacing.md),
              Text(
                readableAuthError(auth.error!),
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: SydneyColors.danger),
              ),
            ],
            const SizedBox(height: SydneySpacing.xl),
            FilledButton(
              onPressed: loading ? null : _submit,
              child: Text(loading ? 'Creating...' : 'Create account'),
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
}

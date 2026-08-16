import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/auth/auth_widgets.dart';
import '../../widgets/sydney_primitives.dart';
import '../../widgets/workspace_primitives.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _loading = false;
  bool _submitted = false;
  Object? _error;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _loading = true;
      _submitted = false;
      _error = null;
    });

    try {
      await ref
          .read(authServiceProvider)
          .requestPasswordReset(email: _emailController.text);
      if (!mounted) return;
      setState(() {
        _submitted = true;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: CuppetWorkspaceColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
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
                        const Padding(
                          padding: EdgeInsets.only(top: SydneySpacing.sm),
                          child: AuthLogo(),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: SydneySpacing.md,
                          ),
                          child: Column(
                            children: [
                              Text(
                                'Forgot your password?',
                                textAlign: TextAlign.center,
                                style: Theme.of(
                                  context,
                                ).textTheme.headlineSmall?.copyWith(
                                  fontSize: 29,
                                  fontWeight: FontWeight.w800,
                                  color: CuppetWorkspaceColors.ink,
                                  height: 1.1,
                                  letterSpacing: -0.8,
                                ),
                              ),
                              const SizedBox(height: SydneySpacing.sm + 2),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 24,
                                ),
                                child: Text(
                                  'Enter your email and we’ll send a secure reset link if an account exists.',
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
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const WorkspaceSectionLabel('Password recovery'),
                            const SizedBox(height: SydneySpacing.md),
                            WorkspaceCard(
                              padding: const EdgeInsets.all(SydneySpacing.lg),
                              child: Form(
                                key: _formKey,
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    AuthField(
                                      label: 'Email Address',
                                      controller: _emailController,
                                      icon: Icons.mail_outline_rounded,
                                      keyboardType: TextInputType.emailAddress,
                                      textInputAction: TextInputAction.done,
                                      validator: _validateEmail,
                                      onFieldSubmitted: (_) => _submit(),
                                    ),
                                    if (_error != null) ...[
                                      const SizedBox(height: SydneySpacing.md),
                                      SydneyNotice(
                                        text: readableAuthError(_error!),
                                        icon: Icons.error_outline_rounded,
                                        iconColor: SydneyColors.danger,
                                        backgroundColor:
                                            SydneyColors.dangerSoft,
                                        borderColor: SydneyColors.dangerSoft,
                                        textColor: SydneyColors.danger,
                                      ),
                                    ],
                                    if (_submitted) ...[
                                      const SizedBox(height: SydneySpacing.md),
                                      const SydneyNotice(
                                        text:
                                            'If an account uses that email, we’ll send a reset link. Check your inbox.',
                                        icon: Icons.mark_email_read_outlined,
                                        iconColor:
                                            CuppetWorkspaceColors.primary,
                                        backgroundColor:
                                            SydneyColors.primarySoft,
                                        borderColor: SydneyColors.primarySoft,
                                        textColor:
                                            CuppetWorkspaceColors.primary,
                                      ),
                                    ],
                                    const SizedBox(height: SydneySpacing.md),
                                    AuthPrimaryButton(
                                      label:
                                          _loading
                                              ? 'Sending...'
                                              : 'Send reset link',
                                      onPressed: _loading ? null : _submit,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                        Column(
                          children: [
                            TextButton(
                              onPressed:
                                  _loading
                                      ? null
                                      : () => Navigator.of(context).pop(),
                              style: TextButton.styleFrom(
                                foregroundColor: CuppetWorkspaceColors.primary,
                                textStyle: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13.5,
                                ),
                              ),
                              child: const Text('Back to email sign in'),
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

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) {
      return 'Enter your email.';
    }
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'Enter a valid email address.';
    }
    return null;
  }
}

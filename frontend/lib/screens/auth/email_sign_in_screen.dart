import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/auth/auth_widgets.dart';
import '../../widgets/sydney_primitives.dart';
import '../../widgets/workspace_primitives.dart';

class EmailSignInScreen extends ConsumerStatefulWidget {
  const EmailSignInScreen({super.key});

  @override
  ConsumerState<EmailSignInScreen> createState() => _EmailSignInScreenState();
}

class _EmailSignInScreenState extends ConsumerState<EmailSignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _showPassword = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
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
      final destination =
          state!.isNewUser
              ? AppRoutes.personalizationOnboarding
              : AppRoutes.inbox;
      Navigator.of(
        context,
      ).pushNamedAndRemoveUntil(destination, (route) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final loading = auth.isLoading;

    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: AppBar(
        backgroundColor: CuppetWorkspaceColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          color: CuppetWorkspaceColors.ink,
          onPressed: loading ? null : () => Navigator.of(context).pop(),
        ),
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
                        // --- 1. TOP BRAND (Cuppet) ---
                        const Padding(
                          padding: EdgeInsets.only(top: SydneySpacing.sm),
                          child: AuthLogo(),
                        ),

                        // --- 2. WELCOME BACK HEADER (Centered between Cuppet & Form) ---
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: SydneySpacing.md,
                          ),
                          child: Column(
                            children: [
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
                                  'Sign in to your account with your email and password.',
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

                        // --- 3. MIDDLE FORM SECTION ---
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const WorkspaceSectionLabel('Email sign in'),
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
                                      textInputAction: TextInputAction.next,
                                      validator:
                                          (value) =>
                                              value == null ||
                                                      value.trim().isEmpty
                                                  ? 'Enter your email.'
                                                  : null,
                                    ),
                                    const SizedBox(height: 14),
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
                                              () =>
                                                  _showPassword =
                                                      !_showPassword,
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
                                        onPressed:
                                            loading
                                                ? null
                                                : () => Navigator.of(
                                                  context,
                                                ).pushNamed(
                                                  AppRoutes.forgotPassword,
                                                ),
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
                                        backgroundColor:
                                            SydneyColors.dangerSoft,
                                        borderColor: SydneyColors.dangerSoft,
                                        textColor: SydneyColors.danger,
                                      ),
                                      const SizedBox(height: SydneySpacing.md),
                                    ],
                                    AuthPrimaryButton(
                                      label:
                                          loading ? 'Signing in...' : 'Sign In',
                                      onPressed: loading ? null : _submit,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),

                        // --- BOTTOM FOOTER & NAVIGATION ---
                        Column(
                          children: [
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
}

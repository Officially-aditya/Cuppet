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
      backgroundColor: SydneyColors.surface,
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
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: SydneyColors.ink,
                        letterSpacing: -0.5,
                      ),
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
                Column(
                  children: [
                    _LoginOptionCard(
                      title: 'Sign in with Google',
                      subtitle: 'Access your account instantly with Google',
                      leadingWidget: const _GoogleMark(),
                      onTap: loading ? null : _continueWithGoogle,
                    ),
                    const SizedBox(height: SydneySpacing.md),
                    _LoginOptionCard(
                      title: 'Sign in with Email',
                      subtitle: 'Use your email address and password',
                      icon: Icons.mail_outline_rounded,
                      leadingIconColor: SydneyColors.primary,
                      onTap: () => setState(() => _showEmailForm = !_showEmailForm),
                    ),
                  ],
                ),
                if (_showEmailForm) ...[
                  const SizedBox(height: SydneySpacing.lg),
                  AnimatedSize(
                    duration: const Duration(milliseconds: 250),
                    curve: Curves.easeInOut,
                    child: Container(
                      decoration: BoxDecoration(
                        color: SydneyColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF17201C).withValues(alpha: 0.05),
                            offset: const Offset(4, 4),
                            blurRadius: 8,
                          ),
                          const BoxShadow(
                            color: Colors.white,
                            offset: Offset(-4, -4),
                            blurRadius: 8,
                          ),
                        ],
                        border: Border.all(
                          color: SydneyColors.line.withValues(alpha: 0.35),
                          width: 0.8,
                        ),
                      ),
                      padding: const EdgeInsets.all(SydneySpacing.lg),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          children: [
                            _AuthField(
                              label: 'Email Address',
                              controller: _emailController,
                              icon: Icons.mail_outline_rounded,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              validator: (value) => value == null || value.trim().isEmpty
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
                                tooltip: _showPassword ? 'Hide password' : 'Show password',
                                onPressed: () => setState(() => _showPassword = !_showPassword),
                                icon: Icon(
                                  _showPassword
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  size: 18,
                                  color: SydneyColors.outline,
                                ),
                              ),
                              validator: (value) => value == null || value.isEmpty
                                  ? 'Enter your password.'
                                  : null,
                              onFieldSubmitted: (_) => _submit(),
                            ),
                            Align(
                              alignment: Alignment.centerRight,
                              child: TextButton(
                                onPressed: loading ? null : () {},
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
                            FilledButton(
                              onPressed: loading ? null : _submit,
                              style: FilledButton.styleFrom(
                                backgroundColor: SydneyColors.primary,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                minimumSize: const Size.fromHeight(48),
                                textStyle: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              child: Text(loading ? 'Signing in...' : 'Sign In'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: SydneySpacing.xxl),
                const _DividerLabel(),
                const SizedBox(height: SydneySpacing.lg),
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
                      onPressed: loading
                          ? null
                          : () => Navigator.of(context).pushNamed(AppRoutes.signUp),
                      child: const Text(
                        'Create one',
                        style: TextStyle(
                          color: SydneyColors.primary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
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
    await ref.read(authControllerProvider.notifier).signIn(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        );
    if (!mounted) {
      return;
    }
    final state = ref.read(authControllerProvider).asData?.value;
    if (state?.isAuthenticated == true) {
      Navigator.of(context).pushNamedAndRemoveUntil(AppRoutes.inbox, (route) => false);
    }
  }

  Future<void> _continueWithGoogle() async {
    await ref.read(authControllerProvider.notifier).continueWithGoogle();
    if (!mounted) {
      return;
    }
    final state = ref.read(authControllerProvider).asData?.value;
    if (state?.isAuthenticated == true) {
      Navigator.of(context).pushNamedAndRemoveUntil(AppRoutes.inbox, (route) => false);
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
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: SydneyColors.ink,
              ),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 18, color: SydneyColors.outline),
            suffixIcon: suffix,
            fillColor: SydneyColors.surfaceContainerLow,
            filled: true,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: SydneySpacing.md,
              vertical: 14,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: SydneyColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: SydneyColors.line),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: SydneyColors.primary),
            ),
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
    return const Row(
      children: [
        Expanded(child: Divider(color: SydneyColors.line)),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: SydneySpacing.md),
          child: Text(
            'OR',
            style: TextStyle(
              color: SydneyColors.outline,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
            ),
          ),
        ),
        Expanded(child: Divider(color: SydneyColors.line)),
      ],
    );
  }
}

class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 18,
      height: 18,
      child: CustomPaint(
        painter: _GoogleLogoPainter(),
      ),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  const _GoogleLogoPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final double width = size.width;
    final double radius = width / 2;
    final double thickness = width * 0.26;

    final Paint paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = thickness
      ..strokeCap = StrokeCap.butt;

    final Rect rect = Rect.fromCircle(center: Offset(radius, radius), radius: radius - thickness / 2);

    // Red segment (top)
    paint.color = const Color(0xFFEA4335);
    canvas.drawArc(rect, -2.4, 1.3, false, paint);

    // Yellow segment (left)
    paint.color = const Color(0xFFFBBC05);
    canvas.drawArc(rect, -3.85, 1.5, false, paint);

    // Green segment (bottom)
    paint.color = const Color(0xFF34A853);
    canvas.drawArc(rect, -5.45, 1.65, false, paint);

    // Blue segment (right)
    paint.color = const Color(0xFF4285F4);
    canvas.drawArc(rect, -0.75, 1.0, false, paint);

    // Blue horizontal bar
    final Paint barPaint = Paint()
      ..color = const Color(0xFF4285F4)
      ..style = PaintingStyle.fill;
    
    canvas.drawRect(
      Rect.fromLTRB(radius, radius - thickness / 2, width, radius + thickness / 2),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _LoginOptionCard extends StatelessWidget {
  const _LoginOptionCard({
    required this.title,
    required this.subtitle,
    this.icon,
    this.leadingWidget,
    this.leadingIconColor,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData? icon;
  final Widget? leadingWidget;
  final Color? leadingIconColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF17201C).withValues(alpha: 0.04),
            offset: const Offset(4, 4),
            blurRadius: 8,
          ),
          const BoxShadow(
            color: Colors.white,
            offset: Offset(-4, -4),
            blurRadius: 8,
          ),
        ],
        border: Border.all(
          color: SydneyColors.line.withValues(alpha: 0.35),
          width: 0.8,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: SydneyColors.surfaceContainerLowest,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: SydneyColors.line,
                      width: 0.8,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: leadingWidget ??
                      Icon(
                        icon,
                        size: 20,
                        color: leadingIconColor ?? SydneyColors.primary,
                      ),
                ),
                const SizedBox(width: SydneySpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                              color: SydneyColors.ink,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: SydneyColors.mutedInk,
                              height: 1.3,
                            ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: SydneySpacing.sm),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: SydneyColors.outline,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

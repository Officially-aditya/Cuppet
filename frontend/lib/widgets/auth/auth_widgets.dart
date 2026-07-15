import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../workspace_primitives.dart';

/// Shared logo badge used on sign-in / sign-up screens.
class AuthLogo extends StatelessWidget {
  const AuthLogo({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Image.asset(
        'assets/logos/cuppet.png',
        width: 240,
        height: 132,
        fit: BoxFit.contain,
        semanticLabel: 'Cuppet logo',
      ),
    );
  }
}

/// Labeled text field used on auth forms.
class AuthField extends StatelessWidget {
  const AuthField({
    required this.label,
    required this.controller,
    required this.icon,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.validator,
    this.suffix,
    this.onFieldSubmitted,
    super.key,
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
    final radius = BorderRadius.circular(SydneyRadius.md);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: SydneySpacing.xs, bottom: 6),
          child: Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: CuppetWorkspaceColors.primaryInk,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.9,
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
            color: CuppetWorkspaceColors.ink,
            height: 1.4,
          ),
          cursorColor: CuppetWorkspaceColors.primary,
          decoration: InputDecoration(
            prefixIcon: Icon(
              icon,
              size: 18,
              color: CuppetWorkspaceColors.muted,
            ),
            suffixIcon: suffix,
            fillColor: CuppetWorkspaceColors.card,
            filled: true,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: SydneySpacing.md,
              vertical: 14,
            ),
            border: OutlineInputBorder(
              borderRadius: radius,
              borderSide: const BorderSide(color: CuppetWorkspaceColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: radius,
              borderSide: const BorderSide(color: CuppetWorkspaceColors.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: radius,
              borderSide: const BorderSide(
                color: CuppetWorkspaceColors.primary,
                width: 1.4,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: radius,
              borderSide: const BorderSide(color: SydneyColors.danger),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: radius,
              borderSide: const BorderSide(
                color: SydneyColors.danger,
                width: 1.4,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Horizontal rule with a centered "OR" label.
class AuthDividerLabel extends StatelessWidget {
  const AuthDividerLabel({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(
          child: Divider(color: CuppetWorkspaceColors.border, height: 1),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: SydneySpacing.md),
          child: Text(
            'OR',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: CuppetWorkspaceColors.muted,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.9,
            ),
          ),
        ),
        const Expanded(
          child: Divider(color: CuppetWorkspaceColors.border, height: 1),
        ),
      ],
    );
  }
}

/// Compact Google "G" mark (vector).
class GoogleMark extends StatelessWidget {
  const GoogleMark({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 18,
      height: 18,
      child: CustomPaint(painter: _GoogleLogoPainter()),
    );
  }
}

class _GoogleLogoPainter extends CustomPainter {
  const _GoogleLogoPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final double scaleX = size.width / 24.0;
    final double scaleY = size.height / 24.0;

    canvas.save();
    canvas.scale(scaleX, scaleY);

    final Path redPath =
        Path()
          ..moveTo(12.0, 5.04)
          ..cubicTo(13.64, 5.04, 15.12, 5.6, 16.28, 6.71)
          ..relativeLineTo(3.2, -3.2)
          ..cubicTo(17.52, 1.68, 14.98, 1.0, 12.0, 1.0)
          ..cubicTo(7.35, 1.0, 3.34, 3.67, 1.39, 7.56)
          ..relativeLineTo(3.9, 3.02)
          ..cubicTo(6.21, 7.42, 8.87, 5.04, 12.0, 5.04);

    canvas.drawPath(
      redPath,
      Paint()
        ..color = const Color(0xFFEA4335)
        ..style = PaintingStyle.fill,
    );

    final Path greenPath =
        Path()
          ..moveTo(12.0, 18.96)
          ..cubicTo(8.87, 18.96, 6.21, 16.58, 5.29, 13.42)
          ..relativeLineTo(-3.9, 3.02)
          ..cubicTo(3.34, 20.33, 7.35, 23.0, 12.0, 23.0)
          ..cubicTo(14.98, 23.0, 17.48, 22.01, 19.3, 20.31)
          ..relativeLineTo(-3.2, -2.63)
          ..cubicTo(14.96, 18.49, 13.47, 18.96, 12.0, 18.96);

    canvas.drawPath(
      greenPath,
      Paint()
        ..color = const Color(0xFF34A853)
        ..style = PaintingStyle.fill,
    );

    final Path yellowPath =
        Path()
          ..moveTo(5.29, 13.42)
          ..cubicTo(5.08, 12.79, 4.96, 12.12, 4.96, 11.4)
          ..cubicTo(4.96, 10.68, 5.08, 10.01, 5.29, 9.38)
          ..relativeLineTo(-3.9, -3.02)
          ..cubicTo(0.5, 7.97, 0.0, 9.43, 0.0, 11.4)
          ..cubicTo(0.0, 13.37, 0.5, 14.83, 1.39, 16.44)
          ..relativeLineTo(3.9, -3.02);

    canvas.drawPath(
      yellowPath,
      Paint()
        ..color = const Color(0xFFFBBC05)
        ..style = PaintingStyle.fill,
    );

    final Path bluePath =
        Path()
          ..moveTo(24.0, 11.4)
          ..cubicTo(24.0, 10.57, 23.93, 9.77, 23.8, 9.0)
          ..lineTo(12.0, 9.0)
          ..lineTo(12.0, 13.54)
          ..lineTo(18.74, 13.54)
          ..cubicTo(18.45, 15.1, 17.57, 16.41, 16.25, 17.3)
          ..lineTo(19.45, 19.93)
          ..cubicTo(21.33, 18.2, 24.0, 15.64, 24.0, 11.4)
          ..close();

    canvas.drawPath(
      bluePath,
      Paint()
        ..color = const Color(0xFF4285F4)
        ..style = PaintingStyle.fill,
    );

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Tappable option card for Google / email sign-in paths.
/// Matches the home-page [WorkspaceCard] surface treatment.
class LoginOptionCard extends StatelessWidget {
  const LoginOptionCard({
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.icon,
    this.leadingWidget,
    this.leadingIconColor,
    super.key,
  });

  final String title;
  final String subtitle;
  final IconData? icon;
  final Widget? leadingWidget;
  final Color? leadingIconColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final usesSoftAvatar = leadingWidget == null;

    return WorkspaceCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.lg,
        vertical: 14,
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color:
                  usesSoftAvatar
                      ? CuppetWorkspaceColors.softSage
                      : CuppetWorkspaceColors.card,
              borderRadius: BorderRadius.circular(SydneyRadius.md),
              border: Border.all(color: CuppetWorkspaceColors.panelBorder),
            ),
            alignment: Alignment.center,
            child:
                leadingWidget ??
                Icon(
                  icon,
                  size: 20,
                  color: leadingIconColor ?? CuppetWorkspaceColors.primaryInk,
                ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontSize: 14,
                    color: CuppetWorkspaceColors.ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: CuppetWorkspaceColors.muted,
                    fontWeight: FontWeight.w400,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: SydneySpacing.sm),
          const Icon(
            Icons.chevron_right_rounded,
            size: 20,
            color: CuppetWorkspaceColors.muted,
          ),
        ],
      ),
    );
  }
}

/// Primary filled action button styled like home / create workspace CTAs.
class AuthPrimaryButton extends StatelessWidget {
  const AuthPrimaryButton({
    required this.label,
    required this.onPressed,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: onPressed,
      style: FilledButton.styleFrom(
        backgroundColor: CuppetWorkspaceColors.primary,
        foregroundColor: Colors.white,
        disabledBackgroundColor: CuppetWorkspaceColors.secondary,
        disabledForegroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.md),
        ),
        minimumSize: const Size.fromHeight(50),
        textStyle: const TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 14,
          letterSpacing: 0.1,
        ),
      ),
      child: Text(label),
    );
  }
}

/// Secondary outlined action button matching create-flow cancel buttons.
class AuthSecondaryButton extends StatelessWidget {
  const AuthSecondaryButton({
    required this.label,
    required this.onPressed,
    this.icon,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final Widget? icon;

  @override
  Widget build(BuildContext context) {
    final child =
        icon == null
            ? Text(label)
            : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                icon!,
                const SizedBox(width: SydneySpacing.sm),
                Text(label),
              ],
            );

    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: CuppetWorkspaceColors.ink,
        side: const BorderSide(color: CuppetWorkspaceColors.border),
        backgroundColor: CuppetWorkspaceColors.card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.md),
        ),
        minimumSize: const Size.fromHeight(50),
        textStyle: const TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 14,
        ),
      ),
      child: child,
    );
  }
}

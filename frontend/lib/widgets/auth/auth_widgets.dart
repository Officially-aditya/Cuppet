import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';

/// Shared logo badge used on sign-in / sign-up screens.
class AuthLogo extends StatelessWidget {
  const AuthLogo({super.key});

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
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: SydneyColors.ink),
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

/// Horizontal rule with a centered "OR" label.
class AuthDividerLabel extends StatelessWidget {
  const AuthDividerLabel({super.key});

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
                    border: Border.all(color: SydneyColors.line, width: 0.8),
                  ),
                  alignment: Alignment.center,
                  child:
                      leadingWidget ??
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

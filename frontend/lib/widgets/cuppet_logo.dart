import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';

import '../design/tokens.dart';

/// The standalone Cuppet Courier mark used on branded application surfaces.
/// Can be animated to flap its tails if [animate] is set to true.
class CuppetMark extends StatefulWidget {
  const CuppetMark({
    this.size = 64,
    this.semanticLabel = 'Cuppet logo',
    this.animate = false,
    super.key,
  });

  final double size;
  final String semanticLabel;
  final bool animate;

  @override
  State<CuppetMark> createState() => _CuppetMarkState();
}

class _CuppetMarkState extends State<CuppetMark> with SingleTickerProviderStateMixin {
  AnimationController? _animationController;

  @override
  void initState() {
    super.initState();
    if (widget.animate) {
      _animationController = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 1400),
      )..repeat();
    }
  }

  @override
  void didUpdateWidget(CuppetMark oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.animate != oldWidget.animate) {
      if (widget.animate) {
        _animationController ??= AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 1400),
        );
        _animationController!.repeat();
      } else {
        _animationController?.stop();
      }
    }
  }

  @override
  void dispose() {
    _animationController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: widget.semanticLabel,
      image: true,
      child: CustomPaint(
        size: Size(widget.size, widget.size),
        painter: _CuppetBirdPainter(
          animation: _animationController,
        ),
      ),
    );
  }
}

class _CuppetBirdPainter extends CustomPainter {
  _CuppetBirdPainter({Animation<double>? animation})
      : animation = animation,
        super(repaint: animation);

  final Animation<double>? animation;

  @override
  void paint(Canvas canvas, Size size) {
    final double scale = size.width / 128.0;
    canvas.save();
    canvas.scale(scale, scale);

    final Paint paint = Paint()
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    // --- 1. Upper Tail (Purple shape on the left) ---
    canvas.save();
    // Pivot at (41, 72)
    canvas.translate(41, 72);
    if (animation != null) {
      final double t = animation!.value * 2 * math.pi;
      // Oscillates between ~ -4.5 and +4.5 degrees
      final double angleUpper = math.sin(t) * 0.08;
      canvas.rotate(angleUpper);
    }
    canvas.translate(-41, -72);

    final Path path1 = Path()
      ..moveTo(13, 47)
      ..lineTo(48, 56)
      ..lineTo(41, 72)
      ..lineTo(13, 64)
      ..lineTo(30, 57)
      ..close();
    paint.color = const Color(0xFF55508F);
    canvas.drawPath(path1, paint);
    canvas.restore();

    // --- 2. Lower Tail (Coral/Salmon shape on the left) ---
    canvas.save();
    canvas.translate(41, 72);
    if (animation != null) {
      final double t = animation!.value * 2 * math.pi;
      // Oscillates symmetrically out-of-phase with the upper tail
      final double angleLower = -math.sin(t) * 0.08;
      canvas.rotate(angleLower);
    }
    canvas.translate(-41, -72);

    final Path path2 = Path()
      ..moveTo(13, 88)
      ..lineTo(41, 72)
      ..lineTo(49, 80)
      ..lineTo(23, 101)
      ..lineTo(30, 83)
      ..close();
    paint.color = const Color(0xFFE56B61);
    canvas.drawPath(path2, paint);
    canvas.restore();

    // --- 3. Coral Facet (Top wing fold) ---
    final Path path3 = Path()
      ..moveTo(47, 57)
      ..lineTo(37, 13)
      ..lineTo(79, 39)
      ..close();
    final coralGradient = ui.Gradient.linear(
      const Offset(37, 13),
      const Offset(76, 60),
      [const Color(0xFFFF9A7F), const Color(0xFFC94F66)],
    );
    paint.shader = coralGradient;
    canvas.drawPath(path3, paint);

    // --- 4. Teal Facet (Bottom wing fold) ---
    final Path path4 = Path()
      ..moveTo(41, 71)
      ..lineTo(29, 114)
      ..lineTo(73, 83)
      ..close();
    final tealGradient = ui.Gradient.linear(
      const Offset(30, 110),
      const Offset(75, 75),
      [const Color(0xFF0B625B), const Color(0xFF2BA898)],
    );
    paint.shader = tealGradient;
    canvas.drawPath(path4, paint);

    // --- 5. Indigo Facet (Main body background shape) ---
    final Path path5 = Path()
      ..moveTo(45, 56)
      ..lineTo(79, 38)
      ..lineTo(110, 62)
      ..lineTo(72, 84)
      ..lineTo(41, 71)
      ..close();
    final indigoGradient = ui.Gradient.linear(
      const Offset(38, 52),
      const Offset(109, 81),
      [const Color(0xFF5D579D), const Color(0xFF29264F)],
    );
    paint.shader = indigoGradient;
    canvas.drawPath(path5, paint);

    // --- 6. Ivory/White Facet (Bird's chest/front face) ---
    final Path path6 = Path()
      ..moveTo(45, 56)
      ..lineTo(79, 38)
      ..lineTo(72, 84)
      ..lineTo(41, 71)
      ..close();
    paint.shader = null;
    paint.color = const Color(0xFFF5F3EE);
    canvas.drawPath(path6, paint);

    // --- 7. Amber Facet (Head/upper beak) ---
    final Path path7 = Path()
      ..moveTo(79, 38)
      ..lineTo(104, 47)
      ..lineTo(113, 61)
      ..lineTo(108, 68)
      ..lineTo(90, 59)
      ..close();
    final amberGradient = ui.Gradient.linear(
      const Offset(78, 38),
      const Offset(112, 66),
      [const Color(0xFFF4C66D), const Color(0xFFDB8833)],
    );
    paint.shader = amberGradient;
    canvas.drawPath(path7, paint);

    // --- 8. Beak Tip (Orange point) ---
    final Path path8 = Path()
      ..moveTo(108, 55)
      ..lineTo(125, 62)
      ..lineTo(107, 68)
      ..close();
    paint.shader = null;
    paint.color = const Color(0xFFF58A73);
    canvas.drawPath(path8, paint);

    // --- 9. Under-wing Shadow (Semi-transparent indigo) ---
    final Path path9 = Path()
      ..moveTo(72, 84)
      ..lineTo(90, 59)
      ..lineTo(108, 68)
      ..close();
    paint.color = const Color(0xFF3F356D).withValues(alpha: 0.65);
    canvas.drawPath(path9, paint);

    // --- 10. Eye (Black circle) ---
    paint.color = const Color(0xFF17201C);
    canvas.drawCircle(const Offset(101, 53), 3, paint);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant _CuppetBirdPainter oldDelegate) {
    return oldDelegate.animation != animation;
  }
}

/// The Courier app-icon treatment used specifically for the Assistant contact.
class CuppetAssistantAvatar extends StatelessWidget {
  const CuppetAssistantAvatar({this.size = 44, super.key});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      image: true,
      label: 'Cuppet Assistant',
      child: SizedBox.square(
        dimension: size,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(size * 0.27),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: CuppetWorkspaceColors.card,
              border: Border.all(color: CuppetWorkspaceColors.panelBorder),
              borderRadius: BorderRadius.circular(size * 0.27),
            ),
            child: Image.asset(
              'assets/logos/cuppet-app-icon.png',
              fit: BoxFit.cover,
              filterQuality: FilterQuality.high,
              excludeFromSemantics: true,
            ),
          ),
        ),
      ),
    );
  }
}

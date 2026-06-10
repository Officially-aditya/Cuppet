import 'package:flutter/material.dart';

class SydneyDurations {
  const SydneyDurations._();

  static const fast = Duration(milliseconds: 140);
  static const standard = Duration(milliseconds: 220);
  static const deliberate = Duration(milliseconds: 360);
}

class SydneyCurves {
  const SydneyCurves._();

  static const standard = Curves.easeOutCubic;
  static const entrance = Curves.easeOutQuart;
  static const exit = Curves.easeInCubic;
}

class FadeSlideIn extends StatelessWidget {
  const FadeSlideIn({
    required this.child,
    this.offset = const Offset(0, 0.03),
    this.duration = SydneyDurations.standard,
    super.key,
  });

  final Widget child;
  final Offset offset;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: duration,
      curve: SydneyCurves.entrance,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: FractionalTranslation(
            translation: Offset.lerp(offset, Offset.zero, value)!,
            child: child,
          ),
        );
      },
      child: child,
    );
  }
}

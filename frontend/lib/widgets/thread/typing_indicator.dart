import 'package:flutter/material.dart';

import '../../design/animations.dart';
import '../../design/tokens.dart';

class TypingIndicator extends StatefulWidget {
  const TypingIndicator({super.key});

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: SydneySpacing.md),
        padding: const EdgeInsets.symmetric(
          horizontal: SydneySpacing.lg,
          vertical: SydneySpacing.md,
        ),
        decoration: BoxDecoration(
          color: SydneyColors.agentBubble,
          borderRadius: SydneyRadius.bubbleAgent,
          border: Border.all(color: SydneyColors.line),
        ),
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            return Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var index = 0; index < 3; index++) ...[
                  _Dot(value: (_controller.value + index * 0.18) % 1),
                  if (index < 2) const SizedBox(width: SydneySpacing.xs),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.value});

  final double value;

  @override
  Widget build(BuildContext context) {
    final opacity = 0.35 + (0.65 * Curves.easeInOut.transform(value));
    return AnimatedContainer(
      duration: SydneyDurations.fast,
      width: 6,
      height: 6,
      decoration: BoxDecoration(
        color: SydneyColors.mutedInk.withValues(alpha: opacity),
        shape: BoxShape.circle,
      ),
    );
  }
}

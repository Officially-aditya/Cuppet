import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class CuppetLaunchScreen extends StatefulWidget {
  const CuppetLaunchScreen({required this.child, super.key});

  final Widget child;

  @override
  State<CuppetLaunchScreen> createState() => _CuppetLaunchScreenState();
}

class _CuppetLaunchScreenState extends State<CuppetLaunchScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..addStatusListener((status) {
        if (status == AnimationStatus.completed && mounted) {
          setState(() => _finished = true);
        }
      });
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_finished) {
      return widget.child;
    }

    return Scaffold(
      backgroundColor: SydneyColors.surfaceContainerLowest,
      body: Center(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final fade = CurvedAnimation(
              parent: _controller,
              curve: const Interval(0.82, 1.0, curve: Curves.easeOut),
            ).value;
            return Opacity(
              opacity: (1.0 - fade).clamp(0.0, 1.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.asset(
                    'assets/logos/cuppet.png',
                    key: const ValueKey('cuppet-launch-animation'),
                    width: 220,
                    height: 220,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: SydneySpacing.md),
                  Text(
                    'Cuppet',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          color: SydneyColors.primary,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.8,
                        ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

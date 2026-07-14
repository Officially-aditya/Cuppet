import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class CuppetLaunchScreen extends StatefulWidget {
  const CuppetLaunchScreen({
    required this.ready,
    required this.child,
    super.key,
  });

  final bool ready;
  final Widget child;

  @override
  State<CuppetLaunchScreen> createState() => _CuppetLaunchScreenState();
}

class _CuppetLaunchScreenState extends State<CuppetLaunchScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _opacity = Tween<double>(
      begin: 0.82,
      end: 1,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
    _scale = Tween<double>(
      begin: 0.98,
      end: 1.03,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
    if (!widget.ready) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(CuppetLaunchScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.ready == oldWidget.ready) return;

    if (widget.ready) {
      _controller.stop();
    } else {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        IgnorePointer(
          ignoring: widget.ready,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            child:
                widget.ready
                    ? const SizedBox.expand(
                      key: ValueKey('cuppet-launch-ready'),
                    )
                    : Scaffold(
                      key: const ValueKey('cuppet-launch-loading'),
                      backgroundColor: SydneyColors.surfaceContainerLowest,
                      body: Center(
                        child: FadeTransition(
                          opacity: _opacity,
                          child: ScaleTransition(
                            scale: _scale,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Image.asset(
                                  'assets/logos/cuppet.png',
                                  key: const ValueKey(
                                    'cuppet-launch-animation',
                                  ),
                                  width: 220,
                                  height: 220,
                                  fit: BoxFit.contain,
                                ),
                                const SizedBox(height: SydneySpacing.md),
                                Text(
                                  'Cuppet',
                                  style: Theme.of(
                                    context,
                                  ).textTheme.headlineMedium?.copyWith(
                                    color: SydneyColors.primary,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -0.8,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
          ),
        ),
      ],
    );
  }
}

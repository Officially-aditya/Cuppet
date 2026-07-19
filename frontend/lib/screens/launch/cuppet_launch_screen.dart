import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../widgets/cuppet_logo.dart';

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
                      backgroundColor: CuppetWorkspaceColors.background,
                      body: Center(
                        child: FadeTransition(
                          opacity: _opacity,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const CuppetMark(
                                key: ValueKey('cuppet-launch-animation'),
                                size: 180,
                                animate: true,
                              ),
                              const SizedBox(height: SydneySpacing.md),
                              Text(
                                'Cuppet',
                                style: Theme.of(
                                  context,
                                ).textTheme.headlineMedium?.copyWith(
                                  color: CuppetWorkspaceColors.primary,
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
      ],
    );
  }
}

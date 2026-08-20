import 'package:flutter/material.dart';

/// A native Material switch with a subtle horizontal press stretch.
///
/// The switch keeps Flutter's built-in semantics, focus handling, thumb
/// animation, and adaptive platform rendering. The surrounding listener only
/// adds the short pressed-state motion.
class StretchSwitch extends StatefulWidget {
  const StretchSwitch({
    required this.value,
    required this.onChanged,
    this.activeThumbColor,
    this.activeTrackColor,
    this.inactiveThumbColor,
    this.inactiveTrackColor,
    super.key,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;
  final Color? activeThumbColor;
  final Color? activeTrackColor;
  final Color? inactiveThumbColor;
  final Color? inactiveTrackColor;

  @override
  State<StretchSwitch> createState() => _StretchSwitchState();
}

class _StretchSwitchState extends State<StretchSwitch>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pressController;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _pressController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 140),
    );
  }

  void _setPressed(bool pressed) {
    if (widget.onChanged == null || _pressed == pressed || !mounted) return;
    setState(() => _pressed = pressed);
    if (pressed) {
      _pressController.forward();
    } else {
      _pressController.reverse();
    }
  }

  @override
  void didUpdateWidget(covariant StretchSwitch oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.onChanged == null && _pressed) {
      _pressed = false;
      _pressController.reverse();
    }
  }

  @override
  void dispose() {
    _pressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.opaque,
      onPointerDown: widget.onChanged == null ? null : (_) => _setPressed(true),
      onPointerUp: widget.onChanged == null ? null : (_) => _setPressed(false),
      onPointerCancel:
          widget.onChanged == null ? null : (_) => _setPressed(false),
      child: AnimatedBuilder(
        animation: _pressController,
        builder: (context, child) {
          final stretch = Curves.easeOutCubic.transform(_pressController.value);
          return Transform.scale(
            scaleX: 1 + (stretch * 0.08),
            scaleY: 1 - (stretch * 0.035),
            alignment: Alignment.center,
            child: child,
          );
        },
        child: Switch.adaptive(
          value: widget.value,
          onChanged: widget.onChanged,
          activeThumbColor: widget.activeThumbColor,
          activeTrackColor: widget.activeTrackColor,
          inactiveThumbColor: widget.inactiveThumbColor,
          inactiveTrackColor: widget.inactiveTrackColor,
        ),
      ),
    );
  }
}

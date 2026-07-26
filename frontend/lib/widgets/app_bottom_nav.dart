import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../design/tokens.dart';

class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    required this.currentIndex,
    required this.onSelected,
    super.key,
  });

  final int currentIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: CuppetWorkspaceColors.card,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: CuppetWorkspaceColors.border)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: SydneySpacing.bottomNavHeight,
            child: Row(
              children: [
                Expanded(
                  child: _NavButton(
                    tooltip: 'Inbox',
                    iconAsset: 'assets/icons/bottom_nav_inbox.svg',
                    label: 'Inbox',
                    selected: currentIndex == 0,
                    onPressed: () => onSelected(0),
                  ),
                ),
                Expanded(
                  child: _NavButton(
                    tooltip: 'Connectors',
                    iconAsset: 'assets/icons/bottom_nav_connectors.svg',
                    label: 'Connectors',
                    selected: currentIndex == 1,
                    onPressed: () => onSelected(1),
                  ),
                ),
                Expanded(
                  child: _NavButton(
                    tooltip: 'Settings',
                    iconAsset: 'assets/icons/bottom_nav_settings.svg',
                    label: 'Settings',
                    selected: currentIndex == 2,
                    onPressed: () => onSelected(2),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.tooltip,
    required this.iconAsset,
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final String tooltip;
  final String iconAsset;
  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final foreground =
        selected
            ? CuppetWorkspaceColors.primaryInk
            : CuppetWorkspaceColors.muted;

    return Tooltip(
      message: tooltip,
      excludeFromSemantics: true,
      child: Semantics(
        key: ValueKey<String>('bottom-nav-${label.toLowerCase()}'),
        container: true,
        label: tooltip,
        selected: selected,
        button: true,
        onTap: onPressed,
        excludeSemantics: true,
        child: InkWell(
          onTap: onPressed,
          splashFactory: InkRipple.splashFactory,
          overlayColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return CuppetWorkspaceColors.primary.withValues(alpha: 0.06);
            }
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.focused)) {
              return CuppetWorkspaceColors.primary.withValues(alpha: 0.035);
            }
            return Colors.transparent;
          }),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOutCubic,
                  width: 42,
                  height: 26,
                  decoration: BoxDecoration(
                    color:
                        selected
                            ? CuppetWorkspaceColors.softSage.withValues(
                              alpha: 0.72,
                            )
                            : Colors.transparent,
                    borderRadius: BorderRadius.circular(SydneyRadius.full),
                  ),
                  alignment: Alignment.center,
                  child: TweenAnimationBuilder<Color?>(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeOutCubic,
                    tween: ColorTween(end: foreground),
                    builder:
                        (context, color, child) => SvgPicture.asset(
                          iconAsset,
                          key: ValueKey(
                            'bottom-nav-icon-${label.toLowerCase()}',
                          ),
                          width: 20,
                          height: 20,
                          colorFilter: ColorFilter.mode(
                            color ?? foreground,
                            BlendMode.srcIn,
                          ),
                        ),
                  ),
                ),
                const SizedBox(height: SydneySpacing.xs),
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutCubic,
                  style: (Theme.of(context).textTheme.labelSmall ??
                          const TextStyle())
                      .copyWith(
                        color: foreground,
                        fontSize: 11,
                        fontWeight:
                            selected ? FontWeight.w800 : FontWeight.w600,
                      ),
                  child: Text(label),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

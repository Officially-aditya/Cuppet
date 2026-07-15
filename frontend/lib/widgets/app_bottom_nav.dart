import 'package:flutter/material.dart';

import '../config/routes.dart';
import '../design/tokens.dart';

void navigateToMainDestination(
  BuildContext context, {
  required int currentIndex,
  required int selectedIndex,
}) {
  if (selectedIndex == currentIndex) {
    return;
  }

  final route = switch (selectedIndex) {
    0 => AppRoutes.inbox,
    1 => AppRoutes.connectors,
    2 => AppRoutes.settings,
    _ => null,
  };
  if (route != null) {
    Navigator.of(context).pushReplacementNamed(route);
  }
}

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
                    icon: Icons.inbox_outlined,
                    label: 'Inbox',
                    selected: currentIndex == 0,
                    onPressed: () => onSelected(0),
                  ),
                ),
                Expanded(
                  child: _NavButton(
                    tooltip: 'Connectors',
                    icon: Icons.public_rounded,
                    label: 'Connectors',
                    selected: currentIndex == 1,
                    onPressed: () => onSelected(1),
                  ),
                ),
                Expanded(
                  child: _NavButton(
                    tooltip: 'Settings',
                    icon: Icons.settings_outlined,
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
    required this.icon,
    required this.label,
    required this.selected,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final foreground =
        selected ? CuppetWorkspaceColors.primary : CuppetWorkspaceColors.muted;

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
          overlayColor: const WidgetStatePropertyAll(
            CuppetWorkspaceColors.softSage,
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  curve: Curves.easeOut,
                  width: 42,
                  height: 26,
                  decoration: BoxDecoration(
                    color:
                        selected
                            ? CuppetWorkspaceColors.softSage
                            : Colors.transparent,
                    borderRadius: BorderRadius.circular(SydneyRadius.full),
                  ),
                  alignment: Alignment.center,
                  child: Icon(icon, size: 20, color: foreground),
                ),
                const SizedBox(height: SydneySpacing.xs),
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: foreground,
                    fontSize: 11,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
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

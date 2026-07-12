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
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: SydneyColors.surface,
        border: Border(top: BorderSide(color: SydneyColors.line)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: SydneySpacing.bottomNavHeight,
          child: Row(
            children: [
              _NavButton(
                tooltip: 'Inbox',
                icon: Icons.inbox_outlined,
                label: 'Inbox',
                selected: currentIndex == 0,
                onPressed: () => onSelected(0),
              ),
              _NavButton(
                tooltip: 'Connectors',
                icon: Icons.public_rounded,
                label: 'Connectors',
                selected: currentIndex == 1,
                onPressed: () => onSelected(1),
              ),
              _NavButton(
                tooltip: 'Settings',
                icon: Icons.settings_outlined,
                label: 'Settings',
                selected: currentIndex == 2,
                onPressed: () => onSelected(2),
              ),
            ],
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
    return Tooltip(
      message: tooltip,
      child: Semantics(
        label: tooltip,
        selected: selected,
        button: true,
        child: InkWell(
          onTap: onPressed,
          child: SizedBox(
            width: MediaQuery.sizeOf(context).width / 3,
            height: SydneySpacing.bottomNavHeight,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: selected ? SydneyColors.primary : SydneyColors.outline,
                ),
                const SizedBox(height: SydneySpacing.xs),
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color:
                        selected ? SydneyColors.primary : SydneyColors.outline,
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

import 'package:flutter/material.dart';

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
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _NavButton(
                tooltip: 'Inbox',
                icon: Icons.mail_outline_rounded,
                selected: currentIndex == 0,
                onPressed: () => onSelected(0),
              ),
              _NavButton(
                tooltip: 'Research Scout',
                icon: Icons.bar_chart_rounded,
                selected: currentIndex == 1,
                onPressed: () => onSelected(1),
              ),
              _NavButton(
                tooltip: 'Connectors',
                icon: Icons.groups_2_outlined,
                selected: currentIndex == 2,
                onPressed: () => onSelected(2),
              ),
              _NavButton(
                tooltip: 'Settings',
                icon: Icons.settings_outlined,
                selected: currentIndex == 3,
                onPressed: () => onSelected(3),
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
    required this.selected,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;
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
        child: InkResponse(
          onTap: onPressed,
          radius: 28,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: selected ? SydneyColors.primarySoft : Colors.transparent,
              borderRadius: BorderRadius.circular(SydneyRadius.full),
            ),
            child: Icon(
              icon,
              size: 22,
              color: selected ? SydneyColors.primary : SydneyColors.mutedInk,
            ),
          ),
        ),
      ),
    );
  }
}

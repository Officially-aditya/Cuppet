import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class CreationAppBar extends StatelessWidget implements PreferredSizeWidget {
  const CreationAppBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      automaticallyImplyLeading: false,
      backgroundColor: CuppetWorkspaceColors.background,
      foregroundColor: CuppetWorkspaceColors.ink,
      surfaceTintColor: Colors.transparent,
      scrolledUnderElevation: 0,
      elevation: 0,
      toolbarHeight: preferredSize.height,
    );
  }
}

class CreationFooter extends StatelessWidget {
  const CreationFooter({
    required this.secondaryLabel,
    required this.onSecondary,
    required this.primaryLabel,
    required this.onPrimary,
    this.primaryChild,
    super.key,
  });

  final String secondaryLabel;
  final VoidCallback? onSecondary;
  final String primaryLabel;
  final VoidCallback? onPrimary;
  final Widget? primaryChild;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(SydneySpacing.lg),
        decoration: const BoxDecoration(
          color: CuppetWorkspaceColors.card,
          border: Border(top: BorderSide(color: CuppetWorkspaceColors.border)),
        ),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: onSecondary,
                style: OutlinedButton.styleFrom(
                  foregroundColor: CuppetWorkspaceColors.ink,
                  side: const BorderSide(color: CuppetWorkspaceColors.border),
                  backgroundColor: CuppetWorkspaceColors.card,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SydneyRadius.md),
                  ),
                  minimumSize: const Size.fromHeight(50),
                ),
                child: Text(secondaryLabel),
              ),
            ),
            const SizedBox(width: SydneySpacing.md),
            Expanded(
              child: FilledButton(
                onPressed: onPrimary,
                style: FilledButton.styleFrom(
                  backgroundColor: CuppetWorkspaceColors.primary,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: CuppetWorkspaceColors.sage,
                  disabledForegroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SydneyRadius.md),
                  ),
                  minimumSize: const Size.fromHeight(50),
                ),
                child: primaryChild ?? Text(primaryLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

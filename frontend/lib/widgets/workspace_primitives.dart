import 'package:flutter/material.dart';

import '../design/tokens.dart';

class WorkspaceAppBar extends StatelessWidget implements PreferredSizeWidget {
  const WorkspaceAppBar({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    super.key,
  });

  final String eyebrow;
  final String title;
  final String subtitle;

  @override
  Size get preferredSize => const Size.fromHeight(116);

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
      titleSpacing: SydneySpacing.page,
      title: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            eyebrow,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: CuppetWorkspaceColors.primaryInk,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(height: SydneySpacing.sm),
          Text(
            title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: CuppetWorkspaceColors.ink,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              height: 1.05,
              letterSpacing: -0.7,
            ),
          ),
          const SizedBox(height: SydneySpacing.sm),
          Text(
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: CuppetWorkspaceColors.muted,
              fontSize: 13,
              fontWeight: FontWeight.w400,
              height: 1.25,
            ),
          ),
        ],
      ),
    );
  }
}

class WorkspaceCard extends StatelessWidget {
  const WorkspaceCard({
    required this.child,
    this.padding = const EdgeInsets.all(SydneySpacing.lg),
    this.color = CuppetWorkspaceColors.card,
    this.borderColor = CuppetWorkspaceColors.border,
    this.radius = SydneyRadius.lg,
    this.onTap,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final Color borderColor;
  final double radius;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radius),
      side: BorderSide(color: borderColor),
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A1C1A17),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: color,
        shape: shape,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

class WorkspaceSectionLabel extends StatelessWidget {
  const WorkspaceSectionLabel(this.text, {this.trailing, super.key});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            text.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: CuppetWorkspaceColors.primaryInk,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.9,
            ),
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}

class WorkspacePrivacyPanel extends StatelessWidget {
  const WorkspacePrivacyPanel({
    required this.title,
    required this.message,
    super.key,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(SydneySpacing.lg),
      decoration: BoxDecoration(
        color: CuppetWorkspaceColors.softSage,
        borderRadius: BorderRadius.circular(SydneyRadius.lg),
        border: Border.all(color: CuppetWorkspaceColors.panelBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.shield_outlined,
                color: CuppetWorkspaceColors.primaryInk,
                size: 18,
              ),
              const SizedBox(width: SydneySpacing.sm),
              Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: CuppetWorkspaceColors.primaryInk,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.sm),
          Text(
            message,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: CuppetWorkspaceColors.muted,
              fontWeight: FontWeight.w500,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/connector.dart';
import '../surface_card.dart';

class ConnectorListItem extends StatelessWidget {
  const ConnectorListItem({
    required this.connector,
    required this.onToggle,
    super.key,
  });

  final Connector connector;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final needsReview = connector.status == ConnectorStatus.actionRequired;
    return SurfaceCard(
      borderColor: needsReview ? SydneyColors.warning : SydneyColors.line,
      padding: EdgeInsets.zero,
      child: IntrinsicHeight(
        child: Row(
          children: [
            if (needsReview) Container(width: 4, color: SydneyColors.warning),
            Expanded(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  needsReview ? SydneySpacing.md : SydneySpacing.lg,
                  SydneySpacing.lg,
                  SydneySpacing.lg,
                  SydneySpacing.lg,
                ),
                child: Row(
                  children: [
                    _ConnectorIcon(connector: connector),
                    const SizedBox(width: SydneySpacing.lg),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            connector.name,
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          const SizedBox(height: SydneySpacing.xs),
                          Text(
                            _statusText(connector),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(
                              context,
                            ).textTheme.bodySmall?.copyWith(
                              color:
                                  needsReview
                                      ? SydneyColors.warning
                                      : SydneyColors.subtleInk,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: SydneySpacing.md),
                    _ConnectorAction(
                      status: connector.status,
                      onPressed: onToggle,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConnectorIcon extends StatelessWidget {
  const _ConnectorIcon({required this.connector});

  final Connector connector;

  @override
  Widget build(BuildContext context) {
    final needsReview = connector.status == ConnectorStatus.actionRequired;
    final icon = switch (connector.iconName) {
      'calendar' => Icons.calendar_month_outlined,
      'chat' || 'tag' => Icons.tag_rounded,
      _ => Icons.mail_outline_rounded,
    };

    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color:
            needsReview
                ? SydneyColors.warningSoft
                : SydneyColors.surfaceContainer,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
      ),
      child: Icon(
        icon,
        color: needsReview ? SydneyColors.warning : SydneyColors.primary,
      ),
    );
  }
}

class _ConnectorAction extends StatelessWidget {
  const _ConnectorAction({required this.status, required this.onPressed});

  final ConnectorStatus status;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final label = switch (status) {
      ConnectorStatus.connected => 'Connected',
      ConnectorStatus.actionRequired => 'Review',
      ConnectorStatus.linking => 'Opening',
      ConnectorStatus.disconnected => 'Link',
    };
    final icon =
        status == ConnectorStatus.connected ? Icons.check_circle_rounded : null;
    final background = switch (status) {
      ConnectorStatus.connected => SydneyColors.primarySoft,
      ConnectorStatus.actionRequired => SydneyColors.warningSoft,
      ConnectorStatus.linking => SydneyColors.infoSoft,
      ConnectorStatus.disconnected => SydneyColors.surfaceContainer,
    };
    final foreground = switch (status) {
      ConnectorStatus.connected => SydneyColors.primary,
      ConnectorStatus.actionRequired => SydneyColors.warning,
      ConnectorStatus.linking => SydneyColors.info,
      ConnectorStatus.disconnected => SydneyColors.ink,
    };

    return FilledButton.icon(
      onPressed: status == ConnectorStatus.linking ? null : onPressed,
      icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 15),
      label: Text(label),
      style: FilledButton.styleFrom(
        backgroundColor: background,
        disabledBackgroundColor: background,
        foregroundColor: foreground,
        disabledForegroundColor: foreground,
        minimumSize: const Size(0, 36),
        padding: EdgeInsets.symmetric(
          horizontal: icon == null ? SydneySpacing.lg : SydneySpacing.md,
          vertical: SydneySpacing.sm,
        ),
        textStyle: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: foreground,
          fontWeight: FontWeight.w800,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.full),
          side: BorderSide(
            color:
                status == ConnectorStatus.actionRequired
                    ? SydneyColors.warning
                    : Colors.transparent,
          ),
        ),
      ),
    );
  }
}

String _statusText(Connector connector) {
  return switch (connector.status) {
    ConnectorStatus.connected => connector.description,
    ConnectorStatus.disconnected => connector.description,
    ConnectorStatus.actionRequired => 'Action required',
    ConnectorStatus.linking => 'Opening authorization',
  };
}

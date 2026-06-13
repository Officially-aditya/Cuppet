import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/connector.dart';
import '../sydney_primitives.dart';

class ConnectorListItem extends StatelessWidget {
  const ConnectorListItem({
    required this.connector,
    required this.onConnectedChanged,
    this.compact = false,
    super.key,
  });

  final Connector connector;
  final ValueChanged<bool> onConnectedChanged;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return SydneyPanel(
      onTap: compact ? () => onConnectedChanged(!connector.isConnected) : null,
      padding: EdgeInsets.all(compact ? SydneySpacing.md : SydneySpacing.lg),
      shadow: !compact,
      child:
          compact
              ? _CompactConnector(connector: connector)
              : _AdvancedConnector(
                connector: connector,
                onConnectedChanged: onConnectedChanged,
              ),
    );
  }
}

class _AdvancedConnector extends StatelessWidget {
  const _AdvancedConnector({
    required this.connector,
    required this.onConnectedChanged,
  });

  final Connector connector;
  final ValueChanged<bool> onConnectedChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ConnectorIcon(connector: connector, size: 40),
            const SizedBox(width: SydneySpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    connector.name,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: SydneyColors.onSurface,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    connector.description,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: SydneyColors.onSurfaceVariant,
                      fontWeight: FontWeight.w400,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.md),
        _ConnectorStatusLine(
          connector: connector,
          onConnectedChanged: onConnectedChanged,
        ),
      ],
    );
  }
}

class _CompactConnector extends StatelessWidget {
  const _CompactConnector({required this.connector});

  final Connector connector;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ConnectorIcon(connector: connector, size: 36),
        const SizedBox(width: SydneySpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      connector.name,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: SydneyColors.onSurface,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  if (connector.isConnected || connector.status == ConnectorStatus.actionRequired)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          connector.isConnected
                              ? Icons.check_rounded
                              : Icons.error_outline_rounded,
                          color:
                              connector.isConnected
                                  ? SydneyColors.primary
                                  : SydneyColors.warning,
                          size: 10,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          connector.isConnected ? 'Active' : 'Reconnect',
                          style: Theme.of(
                            context,
                          ).textTheme.labelSmall?.copyWith(
                            color:
                                connector.isConnected
                                    ? SydneyColors.primary
                                    : SydneyColors.warning,
                            fontSize: 9,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                connector.description,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: SydneyColors.mutedInk,
                  fontWeight: FontWeight.w400,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ConnectorStatusLine extends StatelessWidget {
  const _ConnectorStatusLine({
    required this.connector,
    required this.onConnectedChanged,
  });

  final Connector connector;
  final ValueChanged<bool> onConnectedChanged;

  @override
  Widget build(BuildContext context) {
    final connected = connector.isConnected;
    final actionRequired = connector.status == ConnectorStatus.actionRequired;
    final label =
        connected
            ? 'CONNECTED'
            : actionRequired
            ? 'RECONNECT REQUIRED'
            : 'DISCONNECTED';
    final statusColor =
        connected
            ? SydneyColors.primary
            : actionRequired
            ? SydneyColors.warning
            : SydneyColors.onSurfaceVariant;

    return Row(
      children: [
        Icon(
          connected
              ? Icons.radio_button_checked_rounded
              : actionRequired
              ? Icons.error_outline_rounded
              : Icons.radio_button_unchecked_rounded,
          color:
              connected
                  ? SydneyColors.primary
                  : actionRequired
                  ? SydneyColors.warning
                  : SydneyColors.outline,
          size: 18,
        ),
        const SizedBox(width: SydneySpacing.sm),
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: statusColor,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(width: SydneySpacing.sm),
        Semantics(
          label: '${connector.name} connector',
          value:
              connected
                  ? 'Connected'
                  : actionRequired
                  ? 'Reconnect required'
                  : 'Disconnected',
          child: Switch.adaptive(
            value: connected,
            activeThumbColor: SydneyColors.onPrimary,
            activeTrackColor: SydneyColors.primary,
            inactiveThumbColor: SydneyColors.onPrimary,
            inactiveTrackColor: SydneyColors.surfaceDim,
            onChanged: onConnectedChanged,
          ),
        ),
      ],
    );
  }
}

class ConnectorIcon extends StatelessWidget {
  const ConnectorIcon({required this.connector, this.size = 40, super.key});

  final Connector connector;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = _iconColors(connector.iconName);
    return SydneyIconBadge(
      size: size,
      radius: SydneyRadius.md,
      color: colors.background,
      foregroundColor: colors.foreground,
      borderColor: colors.border,
      child: Icon(_iconData(connector.iconName), size: size * 0.48),
    );
  }
}

IconData _iconData(String? iconName) {
  return switch (iconName) {
    'Calendar' || 'Clock' => Icons.calendar_month_outlined,
    'MessageSquare' => Icons.chat_bubble_outline_rounded,
    'Layers' => Icons.layers_outlined,
    'BookOpen' => Icons.menu_book_outlined,
    'FileText' => Icons.description_outlined,
    'Trello' => Icons.view_kanban_outlined,
    'CheckSquare' => Icons.check_box_outlined,
    'Github' => Icons.code_rounded,
    'HardDrive' => Icons.storage_rounded,
    'FolderOpen' => Icons.folder_open_rounded,
    _ => Icons.mail_outline_rounded,
  };
}

({Color background, Color foreground, Color? border}) _iconColors(
  String? iconName,
) {
  return switch (iconName) {
    'Mail' => (
      background: const Color(0xFFFEE2E2),
      foreground: const Color(0xFFDC2626),
      border: null,
    ),
    'Calendar' => (
      background: const Color(0xFFDBEAFE),
      foreground: const Color(0xFF2563EB),
      border: null,
    ),
    'MessageSquare' => (
      background: const Color(0xFFD1FAE5),
      foreground: const Color(0xFF047857),
      border: null,
    ),
    'Layers' => (
      background: SydneyColors.surface,
      foreground: const Color(0xFF4F46E5),
      border: SydneyColors.line,
    ),
    'Clock' => (
      background: SydneyColors.surface,
      foreground: const Color(0xFFEA580C),
      border: SydneyColors.line,
    ),
    'BookOpen' => (
      background: SydneyColors.surface,
      foreground: const Color(0xFFD97706),
      border: SydneyColors.line,
    ),
    'FileText' => (
      background: SydneyColors.surface,
      foreground: const Color(0xFF0EA5E9),
      border: SydneyColors.line,
    ),
    'Trello' => (
      background: SydneyColors.surface,
      foreground: const Color(0xFF9333EA),
      border: SydneyColors.line,
    ),
    'CheckSquare' => (
      background: SydneyColors.surface,
      foreground: const Color(0xFF059669),
      border: SydneyColors.line,
    ),
    'Github' => (
      background: SydneyColors.surface,
      foreground: const Color(0xFF1F2937),
      border: SydneyColors.line,
    ),
    'HardDrive' => (
      background: SydneyColors.surface,
      foreground: const Color(0xFF2563EB),
      border: SydneyColors.line,
    ),
    'FolderOpen' => (
      background: SydneyColors.surface,
      foreground: const Color(0xFFCA8A04),
      border: SydneyColors.line,
    ),
    _ => (
      background: SydneyColors.primarySoft,
      foreground: SydneyColors.primary,
      border: SydneyColors.line,
    ),
  };
}

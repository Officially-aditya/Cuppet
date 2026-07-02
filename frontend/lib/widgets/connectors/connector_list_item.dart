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
    final childWidget = compact
        ? _CompactConnector(connector: connector)
        : _AdvancedConnector(
            connector: connector,
            onConnectedChanged: onConnectedChanged,
          );

    return Container(
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          // Neumorphic dark shadow (bottom-right)
          BoxShadow(
            color: const Color(0xFF17201C).withValues(alpha: 0.05),
            offset: const Offset(4, 4),
            blurRadius: 8,
          ),
          // Neumorphic light shadow (top-left)
          const BoxShadow(
            color: Colors.white,
            offset: Offset(-4, -4),
            blurRadius: 8,
          ),
        ],
        border: Border.all(
          color: SydneyColors.line.withValues(alpha: 0.35),
          width: 0.8,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: compact ? () => onConnectedChanged(!connector.isConnected) : null,
          child: Padding(
            padding: EdgeInsets.all(compact ? SydneySpacing.md : SydneySpacing.lg),
            child: childWidget,
          ),
        ),
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
                          color: SydneyColors.ink,
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
                            color: SydneyColors.ink,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                  ),
                  if (connector.isConnected ||
                      connector.status == ConnectorStatus.actionRequired)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          connector.isConnected
                              ? Icons.check_rounded
                              : Icons.error_outline_rounded,
                          color: connector.isConnected
                              ? SydneyColors.primary
                              : SydneyColors.warning,
                          size: 10,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          connector.isConnected ? 'Active' : 'Reconnect',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: connector.isConnected
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
    final linking = connector.status == ConnectorStatus.linking ||
        connector.status == ConnectorStatus.connecting;
    final label = linking
        ? 'CONNECTING'
        : connected
            ? 'CONNECTED'
            : actionRequired
                ? 'RECONNECT REQUIRED'
                : 'DISCONNECTED';
    final statusColor = linking
        ? SydneyColors.info
        : connected
            ? SydneyColors.primary
            : actionRequired
                ? SydneyColors.warning
                : SydneyColors.onSurfaceVariant;

    return Row(
      children: [
        Icon(
          linking
              ? Icons.hourglass_top_rounded
              : connected
                  ? Icons.radio_button_checked_rounded
                  : actionRequired
                      ? Icons.error_outline_rounded
                      : Icons.radio_button_unchecked_rounded,
          color: linking
              ? SydneyColors.info
              : connected
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
          value: linking
              ? 'Connecting'
              : connected
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
            onChanged: linking ? null : onConnectedChanged,
          ),
        ),
      ],
    );
  }
}

const Map<String, String> _brandLogoUrls = {
  'web_search': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/512px-Google_%22G%22_logo.svg.png',
  'gmail': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gmail_icon_%282020%29.svg/512px-Gmail_icon_%282020%29.svg.png',
  'slack': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/512px-Slack_icon_2019.svg.png',
  'drive': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Google_Drive_icon_%282020%29.svg/512px-Google_Drive_icon_%282020%29.svg.png',
  'calendar': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/512px-Google_Calendar_icon_%282020%29.svg.png',
  'github': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Octicons-mark-github.svg/512px-Octicons-mark-github.svg.png',
};

class ConnectorIcon extends StatelessWidget {
  const ConnectorIcon({required this.connector, this.size = 40, super.key});

  final Connector connector;
  final double size;

  @override
  Widget build(BuildContext context) {
    final logoUrl = _brandLogoUrls[connector.id];
    if (logoUrl != null) {
      return SydneyIconBadge(
        size: size,
        radius: SydneyRadius.md,
        color: Colors.white,
        foregroundColor: Colors.transparent,
        borderColor: SydneyColors.line,
        child: Padding(
          padding: EdgeInsets.all(size * 0.16),
          child: Image.network(
            logoUrl,
            width: size * 0.68,
            height: size * 0.68,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) {
              final colors = _iconColors(connector.iconName);
              return Icon(
                _iconData(connector.iconName),
                size: size * 0.48,
                color: colors.foreground,
              );
            },
          ),
        ),
      );
    }

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

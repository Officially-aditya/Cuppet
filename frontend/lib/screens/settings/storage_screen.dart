import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../models/message_archive.dart';
import '../../providers/connectors_provider.dart';
import '../../providers/message_archive_provider.dart';
import '../../services/api.dart';
import '../../widgets/stretch_switch.dart';
import '../../widgets/workspace_primitives.dart';

class StorageScreen extends ConsumerWidget {
  const StorageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final archive = ref.watch(messageArchiveProvider);
    final connectors = ref.watch(connectorsProvider);
    final driveConnected =
        connectors.asData?.value.any(
          (connector) => connector.id == 'drive' && connector.isConnected,
        ) ??
        false;

    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: const WorkspaceAppBar(
        eyebrow: 'Settings',
        title: 'Storage',
        subtitle: 'Manage conversation history and Drive archives.',
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: CuppetWorkspaceColors.primary,
          onRefresh: () async {
            ref.invalidate(messageArchiveProvider);
            ref.invalidate(connectorsProvider);
            await Future.wait([
              ref.read(messageArchiveProvider.future),
              ref.read(connectorsProvider.future),
            ]);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              SydneySpacing.page,
              SydneySpacing.lg,
              SydneySpacing.page,
              SydneySpacing.xl,
            ),
            children: [
              const WorkspaceSectionLabel('Conversation history'),
              const SizedBox(height: SydneySpacing.sm),
              const WorkspaceCard(
                key: ValueKey('local-message-retention-card'),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _StorageIcon(icon: Icons.history_rounded),
                    SizedBox(width: SydneySpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '30-day message history',
                            style: TextStyle(
                              color: CuppetWorkspaceColors.ink,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          SizedBox(height: SydneySpacing.xs),
                          Text(
                            'Messages are removed from Cuppet exactly 30 days after they are sent. Drive archives are optional and do not change this limit.',
                            style: TextStyle(
                              color: CuppetWorkspaceColors.muted,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.xl),
              const WorkspaceSectionLabel('Google Drive archive'),
              const SizedBox(height: SydneySpacing.sm),
              _ArchiveCard(
                archive: archive,
                driveConnected: driveConnected,
                driveStatusLoading: connectors.isLoading,
              ),
              const SizedBox(height: SydneySpacing.md),
              const WorkspacePrivacyPanel(
                title: 'Archive privacy',
                message:
                    'Conversation archives are JSONL files stored in your Google Drive. They never include Assistant memory, hidden prompts, OAuth data, or attachment contents.',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ArchiveCard extends ConsumerWidget {
  const _ArchiveCard({
    required this.archive,
    required this.driveConnected,
    required this.driveStatusLoading,
  });

  final AsyncValue<MessageArchiveState> archive;
  final bool driveConnected;
  final bool driveStatusLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = archive.asData?.value;
    final busy = archive.isLoading;
    final enabled = state?.enabled == true;
    final folderLink = state?.folderLink;

    return WorkspaceCard(
      key: const ValueKey('drive-message-archive-card'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const _StorageIcon(icon: Icons.cloud_upload_outlined),
              const SizedBox(width: SydneySpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Archive conversations',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: CuppetWorkspaceColors.ink,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.xs),
                    Text(
                      'Save copies older than 24 hours to your Google Drive before Cuppet removes them.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: CuppetWorkspaceColors.muted,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: SydneySpacing.sm),
              if (busy)
                const SizedBox(
                  width: 48,
                  height: 48,
                  child: Center(
                    child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: CuppetWorkspaceColors.primary,
                      ),
                    ),
                  ),
                )
              else
                StretchSwitch(
                  key: const ValueKey('drive-message-archive-toggle'),
                  value: enabled,
                  activeTrackColor: CuppetWorkspaceColors.primary,
                  activeThumbColor: Colors.white,
                  onChanged:
                      !driveConnected && !enabled
                          ? null
                          : (value) => _setEnabled(context, ref, value),
                ),
            ],
          ),
          const SizedBox(height: SydneySpacing.md),
          _ArchiveStatus(
            state: state,
            driveConnected: driveConnected,
            driveStatusLoading: driveStatusLoading,
          ),
          if (archive.hasError) ...[
            const SizedBox(height: SydneySpacing.sm),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Drive archive status couldn’t be loaded. Please wait a moment and try again.',
                  ),
                ),
                TextButton(
                  onPressed: () => ref.invalidate(messageArchiveProvider),
                  child: const Text('Try again'),
                ),
              ],
            ),
          ],
          if (!driveStatusLoading && !driveConnected && !enabled) ...[
            const SizedBox(height: SydneySpacing.sm),
            OutlinedButton.icon(
              key: const ValueKey('connect-drive-from-storage'),
              onPressed:
                  () => Navigator.of(context).pushNamed(AppRoutes.connectors),
              icon: const Icon(Icons.add_link_rounded, size: 18),
              label: const Text('Connect Google Drive'),
            ),
          ],
          if (state?.actionRequired == true) ...[
            const SizedBox(height: SydneySpacing.sm),
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Archive access needs attention. Local messages will still be removed after 30 days.',
                  ),
                ),
                TextButton(
                  key: const ValueKey('reconnect-drive-archive'),
                  onPressed:
                      busy ? null : () => _setEnabled(context, ref, true),
                  child: const Text('Reconnect'),
                ),
              ],
            ),
          ],
          if (folderLink != null) ...[
            const Divider(height: SydneySpacing.xl),
            Wrap(
              spacing: SydneySpacing.sm,
              runSpacing: SydneySpacing.sm,
              children: [
                OutlinedButton.icon(
                  key: const ValueKey('open-drive-archive-folder'),
                  onPressed: () => _openFolder(context, folderLink),
                  icon: const Icon(Icons.open_in_new_rounded, size: 18),
                  label: const Text('Open archive folder'),
                ),
                TextButton.icon(
                  key: const ValueKey('delete-drive-archives'),
                  onPressed: busy ? null : () => _deleteArchives(context, ref),
                  style: TextButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.error,
                  ),
                  icon: const Icon(Icons.delete_outline_rounded, size: 18),
                  label: const Text('Delete all archives'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _setEnabled(
    BuildContext context,
    WidgetRef ref,
    bool enabled,
  ) async {
    try {
      await ref.read(messageArchiveProvider.notifier).setEnabled(enabled);
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                error,
                fallback: 'Drive archive settings couldn’t be updated.',
              ),
            ),
          ),
        );
      }
    }
  }

  Future<void> _openFolder(BuildContext context, Uri folderLink) async {
    final opened = await launchUrl(
      folderLink,
      mode: LaunchMode.externalApplication,
    );
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('The Drive folder could not be opened.')),
      );
    }
  }

  Future<void> _deleteArchives(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: const Text('Delete all Drive archives?'),
            content: const Text(
              'This permanently removes every Cuppet-created conversation archive from Google Drive and turns archiving off. Current Cuppet conversations are not deleted.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                key: const ValueKey('confirm-delete-drive-archives'),
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('Delete archives'),
              ),
            ],
          ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(messageArchiveProvider.notifier).deleteFiles();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Drive archives deleted.')),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                error,
                fallback: 'Drive archives couldn’t be deleted right now.',
              ),
            ),
          ),
        );
      }
    }
  }
}

class _ArchiveStatus extends StatelessWidget {
  const _ArchiveStatus({
    required this.state,
    required this.driveConnected,
    required this.driveStatusLoading,
  });

  final MessageArchiveState? state;
  final bool driveConnected;
  final bool driveStatusLoading;

  @override
  Widget build(BuildContext context) {
    final lastSuccessAt = state?.lastSuccessAt;
    final actionRequired = state?.actionRequired == true;
    final enabled = state?.enabled == true;
    final statusLabel =
        actionRequired
            ? 'Needs attention'
            : enabled
            ? 'Archive on'
            : 'Archive off';
    final statusColor =
        actionRequired
            ? SydneyColors.warning
            : enabled
            ? CuppetWorkspaceColors.primary
            : CuppetWorkspaceColors.muted;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: statusColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: SydneySpacing.sm),
            Text(
              statusLabel,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: statusColor,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.xs),
        Text(
          driveStatusLoading
              ? 'Checking Google Drive connection…'
              : driveConnected
              ? 'Google Drive is connected.'
              : 'Google Drive is not connected.',
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: CuppetWorkspaceColors.muted),
        ),
        if (lastSuccessAt != null) ...[
          const SizedBox(height: SydneySpacing.xs),
          Text(
            'Last archived ${_formatDateTime(lastSuccessAt.toLocal())}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: CuppetWorkspaceColors.muted),
          ),
        ],
      ],
    );
  }

  String _formatDateTime(DateTime value) {
    final hour = value.hour % 12 == 0 ? 12 : value.hour % 12;
    final minute = value.minute.toString().padLeft(2, '0');
    final period = value.hour >= 12 ? 'PM' : 'AM';
    return '${value.day}/${value.month}/${value.year} at $hour:$minute $period';
  }
}

class _StorageIcon extends StatelessWidget {
  const _StorageIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: const BoxDecoration(
        color: CuppetWorkspaceColors.softSage,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: 19, color: CuppetWorkspaceColors.primaryInk),
    );
  }
}

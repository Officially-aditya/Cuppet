import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../design/tokens.dart';
import '../../models/connector.dart';
import '../../models/message_archive.dart';
import '../../providers/connectors_provider.dart';
import '../../providers/message_archive_provider.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/connectors/connector_list_item.dart';
import '../../widgets/sydney_primitives.dart';
import '../../widgets/workspace_primitives.dart';

class ConnectorsScreen extends ConsumerWidget {
  const ConnectorsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectors = ref.watch(connectorsProvider);

    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: const WorkspaceAppBar(
        eyebrow: 'Workspace setup',
        title: 'Connect your tools',
        subtitle: 'Choose which services Cuppet can connect to.',
      ),
      body: SafeArea(
        bottom: false,
        child: connectors.when(
          data: (items) => _ConnectorList(connectors: items),
          loading: () => const _ConnectorLoading(),
          error:
              (error, _) => SydneyErrorState(
                title: 'Connectors could not load',
                message: error.toString(),
                onRetry: () => ref.invalidate(connectorsProvider),
              ),
        ),
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: 1,
        onSelected:
            (index) => navigateToMainDestination(
              context,
              currentIndex: 1,
              selectedIndex: index,
            ),
      ),
    );
  }
}

class _ConnectorList extends ConsumerWidget {
  const _ConnectorList({required this.connectors});

  final List<Connector> connectors;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final archive = ref.watch(messageArchiveProvider);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        SydneySpacing.lg,
        SydneySpacing.page,
        SydneySpacing.lg,
      ),
      children: [
        const WorkspaceSectionLabel('AVAILABLE SERVICES'),
        const SizedBox(height: SydneySpacing.lg),
        if (connectors.isEmpty)
          const SydneyEmptyState(
            icon: Icons.public_rounded,
            title: 'No connectors available',
            message: 'Connector options will appear here when they load.',
          )
        else
          for (final connector in connectors) ...[
            ConnectorListItem(
              connector: connector,
              onConnectedChanged: (connected) async {
                try {
                  await ref
                      .read(connectorsProvider.notifier)
                      .setConnected(connector.id, connected: connected);
                } catch (error) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text(error.toString())));
                }
              },
              details:
                  connector.id == 'drive'
                      ? _DriveArchiveControls(
                        driveConnected: connector.isConnected,
                        archive: archive,
                      )
                      : null,
            ),
            const SizedBox(height: SydneySpacing.md),
          ],
        const SizedBox(height: SydneySpacing.sm),
        const WorkspacePrivacyPanel(
          title: 'Access & privacy',
          message:
              'Cuppet only uses the access you approve. Connector tokens stay encrypted on Cuppet\'s backend, and agents stay within each connector\'s granted scopes.',
        ),
      ],
    );
  }
}

class _DriveArchiveControls extends ConsumerWidget {
  const _DriveArchiveControls({
    required this.driveConnected,
    required this.archive,
  });

  final bool driveConnected;
  final AsyncValue<MessageArchiveState> archive;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = archive.asData?.value;
    final busy = archive.isLoading;
    final enabled = state?.enabled == true;
    final lastSuccessAt = state?.lastSuccessAt;
    final folderLink = state?.folderLink;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Archive conversations to Google Drive',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: CuppetWorkspaceColors.ink,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Separate consent stores JSONL copies in your Drive. Drive search access does not enable this.',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: CuppetWorkspaceColors.muted,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            Switch.adaptive(
              key: const ValueKey('drive-message-archive-toggle'),
              value: enabled,
              onChanged:
                  busy || (!driveConnected && !enabled)
                      ? null
                      : (value) => _setEnabled(context, ref, value),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.sm),
        if (!driveConnected && !enabled)
          const Text(
            'Connect Google Drive before enabling conversation archives.',
          ),
        if (state?.actionRequired == true)
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Archive access needs attention. Local messages are still deleted at 30 days.',
                ),
              ),
              TextButton(
                onPressed: busy ? null : () => _setEnabled(context, ref, true),
                child: const Text('Reconnect'),
              ),
            ],
          ),
        if (lastSuccessAt != null)
          Text(
            'Last archived ${lastSuccessAt.toLocal()}',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: CuppetWorkspaceColors.muted,
            ),
          ),
        if (folderLink != null || state?.status != 'disabled')
          Wrap(
            spacing: SydneySpacing.sm,
            children: [
              if (folderLink != null)
                TextButton.icon(
                  onPressed:
                      () => launchUrl(
                        folderLink,
                        mode: LaunchMode.externalApplication,
                      ),
                  icon: const Icon(Icons.open_in_new_rounded, size: 16),
                  label: const Text('Open archive folder'),
                ),
              if (folderLink != null)
                TextButton.icon(
                  key: const ValueKey('delete-drive-archives'),
                  onPressed: busy ? null : () => _deleteArchives(context, ref),
                  icon: const Icon(Icons.delete_outline_rounded, size: 16),
                  label: const Text('Delete Drive archives'),
                ),
            ],
          ),
      ],
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
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }

  Future<void> _deleteArchives(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: const Text('Delete Drive archives?'),
            content: const Text(
              'This permanently removes Cuppet-created conversation archives from Google Drive. It does not delete your current Cuppet conversations.',
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
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    }
  }
}

class _ConnectorLoading extends StatelessWidget {
  const _ConnectorLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        SydneySpacing.lg,
        SydneySpacing.page,
        SydneySpacing.lg,
      ),
      children: [
        const WorkspaceSectionLabel('AVAILABLE SERVICES'),
        const SizedBox(height: SydneySpacing.lg),
        for (var index = 0; index < 3; index++) ...[
          const WorkspaceCard(
            padding: EdgeInsets.zero,
            child: SydneyLoadingBlock(height: 112, radius: SydneyRadius.lg),
          ),
          if (index < 2) const SizedBox(height: SydneySpacing.md),
        ],
      ],
    );
  }
}

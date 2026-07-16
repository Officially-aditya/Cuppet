import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/connector.dart';
import '../../providers/connectors_provider.dart';
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

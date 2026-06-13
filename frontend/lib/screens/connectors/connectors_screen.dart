import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../models/connector.dart';
import '../../providers/connectors_provider.dart';
import '../../widgets/connectors/connector_list_item.dart';
import '../../widgets/sydney_primitives.dart';

class ConnectorsScreen extends ConsumerWidget {
  const ConnectorsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectors = ref.watch(connectorsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
        ),
        title: const Text('Connectors'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
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
      bottomNavigationBar: SydneyFooter(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SydneyPanel(
              onTap:
                  () => Navigator.of(context).pushNamed(AppRoutes.addConnector),
              padding: const EdgeInsets.all(14),
              color: SydneyColors.surface,
              shadow: false,
              child: Row(
                children: [
                  const SydneyIconBadge(
                    size: 40,
                    radius: SydneyRadius.md,
                    color: SydneyColors.primarySoft,
                    foregroundColor: SydneyColors.primary,
                    child: Icon(Icons.add_rounded, size: 20),
                  ),
                  const SizedBox(width: SydneySpacing.md),
                  Expanded(
                    child: Text(
                      'Add new connector',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: SydneyColors.onSurface,
                      ),
                    ),
                  ),
                  FilledButton(
                    onPressed:
                        () => Navigator.of(
                          context,
                        ).pushNamed(AppRoutes.addConnector),
                    style: FilledButton.styleFrom(
                      backgroundColor: SydneyColors.surfaceContainer,
                      foregroundColor: SydneyColors.onSurface,
                      minimumSize: const Size(0, 32),
                      padding: const EdgeInsets.symmetric(
                        horizontal: SydneySpacing.md,
                      ),
                      textStyle: Theme.of(context).textTheme.labelSmall,
                    ),
                    child: const Text('CONNECT'),
                  ),
                  const SizedBox(width: SydneySpacing.xs),
                  IconButton(
                    tooltip: 'Expand connector options',
                    onPressed:
                        () => Navigator.of(
                          context,
                        ).pushNamed(AppRoutes.addConnector),
                    icon: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 18,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.md),
            OutlinedButton.icon(
              onPressed:
                  () => Navigator.of(context).pushNamed(AppRoutes.addConnector),
              icon: const Text('Other...'),
              label: const Icon(Icons.chevron_right_rounded, size: 14),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(44),
                textStyle: Theme.of(context).textTheme.labelSmall?.copyWith(
                  letterSpacing: 0.8,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
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
        164,
      ),
      children: [
        Text(
          'Connectors are approved here, but tokens stay with the backend.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: SydneyColors.mutedInk,
            height: 1.35,
          ),
        ),
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
              onConnectedChanged:
                  (connected) => ref
                      .read(connectorsProvider.notifier)
                      .setConnected(connector.id, connected: connected),
            ),
            const SizedBox(height: SydneySpacing.md),
          ],
      ],
    );
  }
}

class _ConnectorLoading extends StatelessWidget {
  const _ConnectorLoading();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(SydneySpacing.page),
      itemBuilder:
          (_, _) =>
              const SydneyLoadingBlock(height: 112, radius: SydneyRadius.md),
      separatorBuilder: (_, _) => const SizedBox(height: SydneySpacing.md),
      itemCount: 3,
    );
  }
}

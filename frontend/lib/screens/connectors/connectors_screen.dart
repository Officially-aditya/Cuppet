import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
      backgroundColor: SydneyColors.surface,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: SydneyColors.surface.withValues(alpha: 0.95),
        scrolledUnderElevation: 0,
        elevation: 0,
        leadingWidth: 56,
        leading: Padding(
          padding: const EdgeInsets.only(left: 16),
          child: Center(
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: SydneyColors.line),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x04000000),
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: IconButton(
                padding: EdgeInsets.zero,
                tooltip: 'Back',
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_rounded, size: 18, color: SydneyColors.ink),
              ),
            ),
          ),
        ),
        titleSpacing: 12,
        title: Text(
          'Connectors',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: SydneyColors.ink,
                letterSpacing: -0.5,
              ),
        ),
      ),
      body: SafeArea(
        bottom: false,
        child: connectors.when(
          data: (items) => _ConnectorList(connectors: items),
          loading: () => const _ConnectorLoading(),
          error: (error, _) => SydneyErrorState(
            title: 'Connectors could not load',
            message: error.toString(),
            onRetry: () => ref.invalidate(connectorsProvider),
          ),
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
              onConnectedChanged: (connected) async {
                try {
                  await ref
                      .read(connectorsProvider.notifier)
                      .setConnected(connector.id, connected: connected);
                } catch (error) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(error.toString())),
                  );
                }
              },
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
      itemBuilder: (_, _) => const SydneyLoadingBlock(height: 112, radius: SydneyRadius.md),
      separatorBuilder: (_, _) => const SizedBox(height: SydneySpacing.md),
      itemCount: 3,
    );
  }
}

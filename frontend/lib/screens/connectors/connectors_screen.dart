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
      bottomNavigationBar: SydneyFooter(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              decoration: BoxDecoration(
                color: SydneyColors.surface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF17201C).withValues(alpha: 0.05),
                    offset: const Offset(4, 4),
                    blurRadius: 8,
                  ),
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
                  onTap: () => Navigator.of(context).pushNamed(AppRoutes.addConnector),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
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
                                  color: SydneyColors.ink,
                                  fontWeight: FontWeight.bold,
                                ),
                          ),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.of(context).pushNamed(AppRoutes.addConnector),
                          style: FilledButton.styleFrom(
                            backgroundColor: SydneyColors.primary,
                            foregroundColor: Colors.white,
                            minimumSize: const Size(0, 32),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: SydneySpacing.md,
                            ),
                            textStyle: Theme.of(context).textTheme.labelSmall?.copyWith(
                                  fontWeight: FontWeight.bold,
                                ),
                          ),
                          child: const Text('CONNECT'),
                        ),
                        const SizedBox(width: SydneySpacing.xs),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: SydneySpacing.md),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).pushNamed(AppRoutes.addConnector),
              icon: const Text('Other...'),
              label: const Icon(Icons.chevron_right_rounded, size: 14),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(44),
                side: const BorderSide(color: SydneyColors.line),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/connector.dart';
import '../../providers/connectors_provider.dart';
import '../../widgets/connectors/connector_list_item.dart';

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
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        centerTitle: true,
        title: const Text('Connectors'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
        actions: [
          IconButton(
            tooltip: 'Connector hub',
            onPressed: () {},
            icon: const Icon(Icons.hub_outlined),
          ),
          const SizedBox(width: SydneySpacing.sm),
        ],
      ),
      body: SafeArea(
        child: connectors.when(
          data: (items) => _ConnectorList(connectors: items),
          loading: () => const _ConnectorLoading(),
          error:
              (error, _) => _ConnectorError(
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
      padding: const EdgeInsets.all(SydneySpacing.page),
      children: [
        Text('Connectors', style: Theme.of(context).textTheme.displaySmall),
        const SizedBox(height: SydneySpacing.xs),
        Text(
          'Connectors are approved here, but tokens stay with the backend.',
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: SydneyColors.subtleInk),
        ),
        const SizedBox(height: SydneySpacing.xl),
        for (final connector in connectors) ...[
          ConnectorListItem(
            connector: connector,
            onToggle:
                () =>
                    ref.read(connectorsProvider.notifier).toggle(connector.id),
          ),
          const SizedBox(height: SydneySpacing.lg),
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
      padding: const EdgeInsets.all(SydneySpacing.page),
      itemBuilder:
          (_, index) => Container(
            height: index == 0 ? 76 : 82,
            decoration: BoxDecoration(
              color: SydneyColors.surfaceRaised,
              borderRadius: BorderRadius.circular(SydneyRadius.sm),
              border: Border.all(color: SydneyColors.line),
            ),
          ),
      separatorBuilder: (_, _) => const SizedBox(height: SydneySpacing.lg),
      itemCount: 4,
    );
  }
}

class _ConnectorError extends StatelessWidget {
  const _ConnectorError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(SydneySpacing.page),
      children: [
        Text(
          'Connectors could not load',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: SydneySpacing.sm),
        Text(
          message,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: SydneyColors.danger),
        ),
        const SizedBox(height: SydneySpacing.lg),
        FilledButton(onPressed: onRetry, child: const Text('Try again')),
      ],
    );
  }
}

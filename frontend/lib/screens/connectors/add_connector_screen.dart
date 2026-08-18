import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/connector.dart';
import '../../providers/connectors_provider.dart';
import '../../services/api.dart';
import '../../widgets/connectors/connector_list_item.dart';
import '../../widgets/sydney_primitives.dart';
import 'custom_mcp_provider_form.dart';

class AddConnectorScreen extends ConsumerStatefulWidget {
  const AddConnectorScreen({super.key});

  @override
  ConsumerState<AddConnectorScreen> createState() => _AddConnectorScreenState();
}

class _AddConnectorScreenState extends ConsumerState<AddConnectorScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final connectors = ref.watch(connectorsProvider);

    return Scaffold(
      appBar: PreferredSize(
        preferredSize: const Size.fromHeight(110),
        child: AppBar(
          automaticallyImplyLeading: false,
          title: const Text('Add Connector'),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(54),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                SydneySpacing.page,
                0,
                SydneySpacing.page,
                SydneySpacing.md,
              ),
              child: TextField(
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                style: Theme.of(context).textTheme.bodySmall,
                decoration: const InputDecoration(
                  hintText: 'Search connectors...',
                  prefixIcon: Icon(Icons.search_rounded, size: 16),
                  fillColor: SydneyColors.surfaceContainerLow,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: SydneySpacing.md,
                    vertical: SydneySpacing.sm,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: connectors.when(
          data:
              (items) => _DirectoryList(
                connectors: items,
                searchQuery: _searchController.text,
              ),
          loading: () => const _DirectoryLoading(),
          error:
              (error, _) => SydneyErrorState(
                title: 'Connector directory could not load',
                message: friendlyErrorMessage(
                  error,
                  fallback: 'Connectors couldn’t be loaded right now.',
                ),
                onRetry: () => ref.invalidate(connectorsProvider),
              ),
        ),
      ),
    );
  }
}

class _DirectoryList extends ConsumerWidget {
  const _DirectoryList({required this.connectors, required this.searchQuery});

  final List<Connector> connectors;
  final String searchQuery;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = searchQuery.trim().toLowerCase();
    final byCategory = <String, List<Connector>>{};
    for (final connector in connectors) {
      if (query.isNotEmpty &&
          !connector.name.toLowerCase().contains(query) &&
          !connector.description.toLowerCase().contains(query)) {
        continue;
      }
      byCategory.putIfAbsent(connector.category, () => []).add(connector);
    }

    if (byCategory.isEmpty) {
      return const SydneyEmptyState(
        icon: Icons.search_rounded,
        title: 'No connectors found',
        message: 'Try a different connector name or category.',
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        SydneySpacing.lg,
        SydneySpacing.page,
        SydneySpacing.xl,
      ),
      children: [
        for (final entry in byCategory.entries) ...[
          SydneySectionLabel(entry.key),
          const SizedBox(height: 2),
          for (final connector in entry.value) ...[
            ConnectorListItem(
              connector: connector,
              compact: true,
              onConnectedChanged: (connected) async {
                if (connector.name == 'Outlook') {
                  Navigator.of(context).maybePop();
                  return;
                }
                try {
                  await ref
                      .read(connectorsProvider.notifier)
                      .setConnected(connector.id, connected: connected);
                } catch (error) {
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        friendlyErrorMessage(
                          error,
                          fallback:
                              'That connection couldn’t be updated right now.',
                        ),
                      ),
                    ),
                  );
                }
              },
            ),
            const SizedBox(height: 6),
          ],
          const SizedBox(height: SydneySpacing.md),
        ],
        OutlinedButton.icon(
          onPressed: () => showCustomMcpProviderForm(context, ref),
          icon: const Icon(Icons.extension_outlined, size: 16),
          label: const Text('Add custom MCP provider'),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(44),
            foregroundColor: SydneyColors.onSurfaceVariant,
            textStyle: Theme.of(context).textTheme.labelSmall?.copyWith(
              letterSpacing: 0.8,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ],
    );
  }
}

class _DirectoryLoading extends StatelessWidget {
  const _DirectoryLoading();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(SydneySpacing.page),
      itemBuilder:
          (_, index) => SydneyLoadingBlock(
            height: index % 4 == 0 ? 18 : 68,
            radius: index % 4 == 0 ? SydneyRadius.xs : SydneyRadius.md,
          ),
      separatorBuilder: (_, _) => const SizedBox(height: SydneySpacing.sm),
      itemCount: 10,
    );
  }
}

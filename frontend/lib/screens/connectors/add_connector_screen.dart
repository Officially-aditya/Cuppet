import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/connector.dart';
import '../../providers/connectors_provider.dart';
import '../../services/api.dart';
import '../../widgets/connectors/connector_list_item.dart';
import '../../widgets/sydney_primitives.dart';

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
          onPressed: () => _showCustomMcpProviderForm(context, ref),
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

Future<void> _showCustomMcpProviderForm(
  BuildContext context,
  WidgetRef ref,
) async {
  final created = await showModalBottomSheet<Connector>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _CustomMcpProviderForm(),
  );
  if (created == null || !context.mounted) return;
  ref.invalidate(connectorsProvider);
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text('${created.name} was added. Connect it to continue.'),
    ),
  );
}

class _CustomMcpProviderForm extends ConsumerStatefulWidget {
  const _CustomMcpProviderForm();

  @override
  ConsumerState<_CustomMcpProviderForm> createState() =>
      _CustomMcpProviderFormState();
}

class _CustomMcpProviderFormState
    extends ConsumerState<_CustomMcpProviderForm> {
  final _nameController = TextEditingController();
  final _endpointController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _capabilitiesController = TextEditingController(text: 'mcp.read');
  final _scopesController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _endpointController.dispose();
    _descriptionController.dispose();
    _capabilitiesController.dispose();
    _scopesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return Material(
      color: CuppetWorkspaceColors.background,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          SydneySpacing.page,
          SydneySpacing.lg,
          SydneySpacing.page,
          SydneySpacing.lg + bottomInset,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Add a custom MCP provider',
                      style: TextStyle(
                        color: CuppetWorkspaceColors.ink,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed:
                        _submitting ? null : () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                    tooltip: 'Close',
                  ),
                ],
              ),
              const SizedBox(height: SydneySpacing.xs),
              const Text(
                'Connect an OAuth-enabled, read-only MCP server. Cuppet never asks for API keys here.',
                style: TextStyle(
                  color: CuppetWorkspaceColors.muted,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: SydneySpacing.lg),
              _field(
                controller: _nameController,
                label: 'Provider name',
                hint: 'Linear workspace',
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: SydneySpacing.md),
              _field(
                controller: _endpointController,
                label: 'MCP HTTPS endpoint',
                hint: 'https://example.com/mcp',
                keyboardType: TextInputType.url,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: SydneySpacing.md),
              _field(
                controller: _descriptionController,
                label: 'Description (optional)',
                hint: 'Read approved project updates',
                maxLines: 2,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: SydneySpacing.md),
              _field(
                controller: _capabilitiesController,
                label: 'Read capabilities',
                hint: 'linear.read, linear.search',
                helperText: 'Separate read-only capability names with commas.',
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: SydneySpacing.md),
              _field(
                controller: _scopesController,
                label: 'OAuth scopes (optional)',
                hint: 'read:projects, read:issues',
                helperText:
                    'Leave blank to use the server’s advertised scopes.',
                textInputAction: TextInputAction.done,
              ),
              if (_error != null) ...[
                const SizedBox(height: SydneySpacing.md),
                Text(
                  _error!,
                  style: const TextStyle(
                    color: SydneyColors.danger,
                    height: 1.35,
                  ),
                ),
              ],
              const SizedBox(height: SydneySpacing.lg),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon:
                      _submitting
                          ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                          : const Icon(Icons.arrow_forward_rounded, size: 17),
                  label: Text(
                    _submitting ? 'Checking provider...' : 'Add provider',
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required String hint,
    String? helperText,
    TextInputType? keyboardType,
    TextInputAction? textInputAction,
    int maxLines = 1,
  }) {
    return TextField(
      controller: controller,
      enabled: !_submitting,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        helperText: helperText,
      ),
    );
  }

  Future<void> _submit() async {
    final name = _nameController.text.trim();
    final endpoint = _endpointController.text.trim();
    final description = _descriptionController.text.trim();
    final capabilities = _splitValues(_capabilitiesController.text);
    final scopes = _splitValues(_scopesController.text);
    final uri = Uri.tryParse(endpoint);

    if (name.isEmpty || name.length > 80) {
      setState(
        () => _error = 'Enter a provider name between 1 and 80 characters.',
      );
      return;
    }
    if (uri == null ||
        uri.scheme.toLowerCase() != 'https' ||
        uri.host.isEmpty) {
      setState(() => _error = 'Use a public HTTPS MCP endpoint.');
      return;
    }
    if (capabilities.isEmpty) {
      setState(() => _error = 'Add at least one read-only capability.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final created = await ref
          .read(connectorServiceProvider)
          .createCustomMcpProvider(
            name: name,
            endpoint: endpoint,
            description: description,
            capabilities: capabilities,
            oauthScopes: scopes,
          );
      if (mounted) Navigator.of(context).pop(created);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = friendlyErrorMessage(
          error,
          fallback:
              'The provider could not be verified. Check its OAuth metadata and try again.',
        );
      });
    }
  }
}

List<String> _splitValues(String value) {
  return value
      .split(',')
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toSet()
      .toList();
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

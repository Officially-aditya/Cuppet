import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/connector.dart';
import '../../providers/connectors_provider.dart';
import '../../services/api.dart';

Future<void> showCustomMcpProviderForm(
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
                'Required: a provider name, a public HTTPS MCP endpoint, and at least one read-only capability. Cuppet discovers the provider\'s OAuth metadata automatically and never asks for API keys.',
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
                helperText: 'Required. Use the name people will recognize.',
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: SydneySpacing.md),
              _field(
                controller: _endpointController,
                label: 'MCP HTTPS endpoint',
                hint: 'https://example.com/mcp',
                helperText:
                    'Required. The server must be public, use HTTPS, and expose OAuth metadata.',
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
                helperText:
                    'Required. Separate read-only capability names with commas.',
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: SydneySpacing.md),
              _field(
                controller: _scopesController,
                label: 'OAuth scopes (optional)',
                hint: 'read:projects, read:issues',
                helperText:
                    'Optional. Leave blank to use the server\'s advertised read-only scopes.',
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
    if (description.length > 240) {
      setState(
        () => _error = 'Keep the description to 240 characters or less.',
      );
      return;
    }
    if (uri == null ||
        uri.scheme.toLowerCase() != 'https' ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty) {
      setState(
        () =>
            _error =
                'Use a public HTTPS MCP endpoint without embedded credentials.',
      );
      return;
    }
    if (capabilities.isEmpty) {
      setState(() => _error = 'Add at least one read-only capability.');
      return;
    }
    final invalidCapability = _firstInvalidCapability(capabilities);
    if (invalidCapability != null) {
      setState(
        () =>
            _error =
                'Use valid read-only capability names. "$invalidCapability" is not allowed.',
      );
      return;
    }
    if (capabilities.length > 16 ||
        capabilities.any((capability) => capability.length > 120)) {
      setState(
        () =>
            _error = 'Add up to 16 capabilities, each 120 characters or less.',
      );
      return;
    }
    final invalidScope = _firstInvalidScope(scopes);
    if (invalidScope != null) {
      setState(
        () =>
            _error =
                'OAuth scopes must be read-only. "$invalidScope" is not allowed.',
      );
      return;
    }
    if (scopes.length > 32 || scopes.any((scope) => scope.length > 120)) {
      setState(
        () =>
            _error = 'Add up to 32 OAuth scopes, each 120 characters or less.',
      );
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

String? _firstInvalidCapability(List<String> capabilities) {
  final namePattern = RegExp(r'^[a-z][a-z0-9_.:-]*$', caseSensitive: false);
  final writePattern = RegExp(
    r'(^|[_.:-])(write|create|delete|destroy|update|send|post|put|patch|remove|execute|run|invite|grant|revoke|mutat|action)(?:$|[_.:-])',
    caseSensitive: false,
  );
  for (final capability in capabilities) {
    if (!namePattern.hasMatch(capability) ||
        writePattern.hasMatch(capability)) {
      return capability;
    }
  }
  return null;
}

String? _firstInvalidScope(List<String> scopes) {
  final writeSegments = {
    'write',
    'create',
    'delete',
    'destroy',
    'update',
    'send',
    'post',
    'put',
    'patch',
    'remove',
    'execute',
    'run',
    'invite',
    'grant',
    'revoke',
    'mutate',
    'action',
  };
  for (final scope in scopes) {
    final segments = scope
        .split(RegExp(r'[^a-z0-9]+', caseSensitive: false))
        .where((segment) => segment.isNotEmpty)
        .map((segment) => segment.toLowerCase());
    if (!segments.isNotEmpty ||
        segments.any(
          (segment) =>
              writeSegments.contains(segment) || segment.startsWith('mutat'),
        )) {
      return scope;
    }
  }
  return null;
}

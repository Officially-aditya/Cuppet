import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';

import '../../design/tokens.dart';
import '../../models/personalization_consent.dart';
import '../../models/personalization_settings.dart';
import '../../models/preference_profile.dart';
import '../../models/preference_profile_item.dart';
import '../../providers/personalization_provider.dart';
import '../../services/api.dart';
import '../../widgets/workspace_primitives.dart';

class PersonalizationScreen extends ConsumerWidget {
  const PersonalizationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(personalizationProvider);
    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: const WorkspaceAppBar(
        eyebrow: 'Settings',
        title: 'Personalization',
        subtitle: 'Permission first. Fewer, more useful suggestions.',
      ),
      body: SafeArea(
        child: profile.when(
          loading:
              () => const Center(
                child: CircularProgressIndicator(
                  color: CuppetWorkspaceColors.primary,
                ),
              ),
          error:
              (error, _) => _ErrorState(
                error: error,
                onRetry: () => ref.invalidate(personalizationProvider),
              ),
          data: (value) => _PersonalizationBody(profile: value),
        ),
      ),
    );
  }
}

class _PersonalizationBody extends ConsumerStatefulWidget {
  const _PersonalizationBody({required this.profile});

  final PreferenceProfile profile;

  @override
  ConsumerState<_PersonalizationBody> createState() =>
      _PersonalizationBodyState();
}

class _PersonalizationBodyState extends ConsumerState<_PersonalizationBody> {
  late PersonalizationSettingsView _view;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _view = PersonalizationSettingsView(widget.profile);
  }

  @override
  void didUpdateWidget(covariant _PersonalizationBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.profile != widget.profile) {
      _view = PersonalizationSettingsView(widget.profile);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = _view.settings;
    final direct = _view.consentGranted('explicit_feedback');
    final activity = _view.consentGranted('cuppet_activity');
    final connected = _view.consentGranted('connected_content');
    final browser = _view.consentGranted('browser_activity');
    final crossSource = _view.consentGranted('cross_source');
    final browserConnected = _view.browserConnected;
    final grouped = <String, List<PreferenceProfileItem>>{};
    for (final item in widget.profile.items) {
      grouped.putIfAbsent(item.dimension, () => []).add(item);
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        SydneySpacing.lg,
        SydneySpacing.page,
        SydneySpacing.xl,
      ),
      children: [
        WorkspaceCard(
          key: const ValueKey('personalization-overview-card'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Personalized suggestions',
                      style: TextStyle(
                        color: CuppetWorkspaceColors.ink,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  Switch.adaptive(
                    key: const ValueKey('personalization-enabled-switch'),
                    value: settings.enabled,
                    onChanged: _busy ? null : _setEnabled,
                    activeTrackColor: CuppetWorkspaceColors.primary,
                    activeThumbColor: Colors.white,
                  ),
                ],
              ),
              const SizedBox(height: SydneySpacing.xs),
              const Text(
                'Cuppet never uses these signals for advertising, sells them, or trains a general-purpose model. Turning this off does not affect Assistant, agents, or connectors.',
                style: TextStyle(
                  color: CuppetWorkspaceColors.muted,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SydneySpacing.xl),
        WorkspaceCard(
          key: const ValueKey('personalization-pause-card'),
          padding: EdgeInsets.zero,
          child: _ConsentTile(
            title: 'Pause preference learning',
            description:
                'Keep your profile and suggestions available, but stop collecting new signals until you resume.',
            value: settings.learningPaused,
            onChanged: _busy ? null : _setLearningPaused,
          ),
        ),
        const SizedBox(height: SydneySpacing.xl),
        const WorkspaceSectionLabel('What Cuppet may learn from'),
        const SizedBox(height: SydneySpacing.sm),
        WorkspaceCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _ConsentTile(
                title: 'Direct feedback',
                description: 'Useful, not useful, and suggestion decisions.',
                value: direct,
                onChanged:
                    _busy
                        ? null
                        : (value) => _setConsent('explicit_feedback', value),
              ),
              const Divider(
                height: 1,
                indent: 24,
                color: CuppetWorkspaceColors.border,
              ),
              _ConsentTile(
                title: 'Activity inside Cuppet',
                description:
                    'Repeated requests and other first-party activity.',
                value: activity,
                onChanged:
                    _busy
                        ? null
                        : (value) => _setConsent('cuppet_activity', value),
              ),
              const Divider(
                height: 1,
                indent: 24,
                color: CuppetWorkspaceColors.border,
              ),
              _ConsentTile(
                title: 'Connected account patterns',
                description:
                    'Learn which connected sources and formats are useful to you.',
                value: connected,
                onChanged:
                    _busy
                        ? null
                        : (value) => _setConsent('connected_content', value),
              ),
              const Divider(
                height: 1,
                indent: 24,
                color: CuppetWorkspaceColors.border,
              ),
              _ConsentTile(
                title: 'Browser activity',
                description:
                    'Only an approved browser integration may send domain-level activity. Page contents are never accepted here.',
                value: browser,
                onChanged:
                    _busy
                        ? null
                        : (value) => _setConsent('browser_activity', value),
              ),
              const Divider(
                height: 1,
                indent: 24,
                color: CuppetWorkspaceColors.border,
              ),
              _ConsentTile(
                title: 'Combine signals across sources',
                description:
                    'Allow authorized source patterns to be considered together.',
                value: crossSource,
                onChanged:
                    _busy
                        ? null
                        : (value) => _setConsent('cross_source', value),
              ),
            ],
          ),
        ),
        const SizedBox(height: SydneySpacing.xl),
        const WorkspaceSectionLabel('Browser connection'),
        const SizedBox(height: SydneySpacing.sm),
        WorkspaceCard(
          key: const ValueKey('personalization-browser-connection-card'),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                browserConnected
                    ? 'Browser integration connected'
                    : 'No browser integration connected',
                style: const TextStyle(
                  color: CuppetWorkspaceColors.ink,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: SydneySpacing.xs),
              const Text(
                'Connecting only makes bounded domain-level events available. It does not grant browser access or enable personalization by itself.',
                style: TextStyle(
                  color: CuppetWorkspaceColors.muted,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: SydneySpacing.sm),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton(
                  onPressed:
                      _busy
                          ? null
                          : browserConnected
                          ? _disconnectBrowser
                          : _connectBrowser,
                  child: Text(
                    browserConnected ? 'Disconnect browser' : 'Connect browser',
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SydneySpacing.xl),
        const WorkspaceSectionLabel('Suggestion delivery'),
        const SizedBox(height: SydneySpacing.sm),
        WorkspaceCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              _ConsentTile(
                title: 'During Assistant conversations',
                description:
                    'Suggestions appear only while you are already using Assistant.',
                value: settings.inChat,
                onChanged: _busy ? null : (value) => _setInChat(value),
              ),
              const Divider(
                height: 1,
                indent: 24,
                color: CuppetWorkspaceColors.border,
              ),
              _ConsentTile(
                title: 'Proactive suggestions',
                description:
                    'Allow a small number of suggestions outside active chats.',
                value: settings.proactive,
                onChanged: _busy ? null : (value) => _setProactive(value),
              ),
              const Divider(
                height: 1,
                indent: 24,
                color: CuppetWorkspaceColors.border,
              ),
              _ConsentTile(
                title: 'Push notifications for suggestions',
                description:
                    'Only delivered during your quiet-hours window rules.',
                value: settings.push,
                enabled: settings.proactive,
                onChanged:
                    _busy || !settings.proactive
                        ? null
                        : (value) => _setPush(value),
              ),
              const Divider(
                height: 1,
                indent: 24,
                color: CuppetWorkspaceColors.border,
              ),
              ListTile(
                title: const Text('Quiet hours'),
                subtitle: Text(
                  '${settings.quietHoursStart} to ${settings.quietHoursEnd} in your device time zone',
                ),
                trailing: TextButton(
                  onPressed: _busy ? null : _pickQuietHours,
                  child: const Text('Edit'),
                ),
              ),
              const Divider(
                height: 1,
                indent: 24,
                color: CuppetWorkspaceColors.border,
              ),
              ListTile(
                title: const Text('Suggestion frequency'),
                subtitle: const Text(
                  'A hard limit of two suggestions per week still applies.',
                ),
                trailing: DropdownButton<String>(
                  value: settings.frequency,
                  underline: const SizedBox.shrink(),
                  items: const [
                    DropdownMenuItem(value: 'low', child: Text('Low')),
                    DropdownMenuItem(
                      value: 'balanced',
                      child: Text('Balanced'),
                    ),
                    DropdownMenuItem(value: 'high', child: Text('High')),
                  ],
                  onChanged:
                      _busy
                          ? null
                          : (value) {
                            if (value != null) _setFrequency(value);
                          },
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SydneySpacing.xl),
        const WorkspaceSectionLabel('What Cuppet has learned'),
        const SizedBox(height: SydneySpacing.sm),
        if (widget.profile.items.isEmpty)
          const WorkspaceCard(
            key: ValueKey('personalization-empty-profile'),
            child: Text(
              'Nothing yet. Your profile stays empty until you opt in and give Cuppet a signal.',
            ),
          )
        else
          for (final entry in grouped.entries) ...[
            _ProfileGroup(
              dimension: entry.key,
              items: entry.value,
              onEdit: _editItem,
              onDelete: _deleteItem,
            ),
            const SizedBox(height: SydneySpacing.md),
          ],
        OutlinedButton.icon(
          key: const ValueKey('personalization-add-exclusion'),
          onPressed: _busy ? null : _addExclusion,
          icon: const Icon(Icons.block_outlined),
          label: const Text('Add something to avoid'),
        ),
        if (widget.profile.recentSuggestions.isNotEmpty) ...[
          const SizedBox(height: SydneySpacing.xl),
          const WorkspaceSectionLabel('Recent suggestions'),
          const SizedBox(height: SydneySpacing.sm),
          WorkspaceCard(
            key: const ValueKey('personalization-suggestion-history'),
            padding: EdgeInsets.zero,
            child: Column(
              children: [
                for (final suggestion in widget.profile.recentSuggestions)
                  ListTile(
                    title: Text(suggestion.title),
                    subtitle: Text(
                      '${suggestion.type.replaceAll('_', ' ')} · ${suggestion.status}',
                    ),
                    dense: true,
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: SydneySpacing.md),
        OutlinedButton.icon(
          key: const ValueKey('personalization-export'),
          onPressed: _busy ? null : _export,
          icon: const Icon(Icons.file_download_outlined),
          label: const Text('Export personalization data'),
        ),
        const SizedBox(height: SydneySpacing.sm),
        OutlinedButton.icon(
          key: const ValueKey('personalization-reset'),
          onPressed: _busy ? null : _reset,
          icon: const Icon(Icons.delete_sweep_outlined),
          label: const Text('Reset personalization data'),
        ),
        if (_busy) ...[
          const SizedBox(height: SydneySpacing.md),
          const Center(
            child: CircularProgressIndicator(
              color: CuppetWorkspaceColors.primary,
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _setEnabled(bool value) async {
    await _run(() async {
      final updated = await ref
          .read(personalizationServiceProvider)
          .updateSettings(_view.settings.copyWith(enabled: value));
      _view = _view.copyWith(settings: updated);
      ref.invalidate(personalizationProvider);
    });
  }

  Future<void> _setLearningPaused(bool value) async {
    await _run(() async {
      final updated = await ref
          .read(personalizationServiceProvider)
          .updateSettings(_view.settings.copyWith(learningPaused: value));
      _view = _view.copyWith(settings: updated);
    });
  }

  Future<void> _connectBrowser() async {
    await _run(() async {
      final token =
          await ref.read(personalizationServiceProvider).connectBrowser();
      _view = _view.copyWith(browserConnected: true);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder:
            (dialogContext) => AlertDialog(
              title: const Text('Browser connection token'),
              content: SelectableText(
                'Paste this token into the approved Cuppet browser integration. It is shown once.\n\n$token',
              ),
              actions: [
                TextButton(
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: token));
                    if (dialogContext.mounted) Navigator.pop(dialogContext);
                  },
                  child: const Text('Copy token'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: const Text('Close'),
                ),
              ],
            ),
      );
    });
  }

  Future<void> _disconnectBrowser() async {
    await _run(() async {
      await ref.read(personalizationServiceProvider).disconnectBrowser();
      _view = _view.copyWith(browserConnected: false);
    });
  }

  Future<void> _setInChat(bool value) async {
    await _run(() async {
      final updated = await ref
          .read(personalizationServiceProvider)
          .updateSettings(_view.settings.copyWith(inChat: value));
      _view = _view.copyWith(settings: updated);
    });
  }

  Future<void> _setProactive(bool value) async {
    await _run(() async {
      final updated = await ref
          .read(personalizationServiceProvider)
          .updateSettings(
            _view.settings.copyWith(
              proactive: value,
              push: value ? _view.settings.push : false,
            ),
          );
      _view = _view.copyWith(settings: updated);
    });
  }

  Future<void> _setPush(bool value) async {
    await _run(() async {
      final updated = await ref
          .read(personalizationServiceProvider)
          .updateSettings(_view.settings.copyWith(push: value));
      _view = _view.copyWith(settings: updated);
    });
  }

  Future<void> _setFrequency(String value) async {
    await _run(() async {
      final updated = await ref
          .read(personalizationServiceProvider)
          .updateSettings(_view.settings.copyWith(frequency: value));
      _view = _view.copyWith(settings: updated);
    });
  }

  Future<void> _pickQuietHours() async {
    final start = await showTimePicker(
      context: context,
      initialTime: _parseTime(
        _view.settings.quietHoursStart,
        const TimeOfDay(hour: 21, minute: 0),
      ),
      helpText: 'Quiet hours start',
    );
    if (!mounted || start == null) return;
    final end = await showTimePicker(
      context: context,
      initialTime: _parseTime(
        _view.settings.quietHoursEnd,
        const TimeOfDay(hour: 8, minute: 0),
      ),
      helpText: 'Quiet hours end',
    );
    if (!mounted || end == null) return;
    await _run(() async {
      final updated = await ref
          .read(personalizationServiceProvider)
          .updateSettings(
            _view.settings.copyWith(
              quietHoursStart: _formatTime(start),
              quietHoursEnd: _formatTime(end),
            ),
          );
      _view = _view.copyWith(settings: updated);
    });
  }

  TimeOfDay _parseTime(String value, TimeOfDay fallback) {
    final parts = value.split(':');
    final hour = int.tryParse(parts.first);
    final minute = parts.length > 1 ? int.tryParse(parts[1]) : null;
    return hour != null && minute != null && hour < 24 && minute < 60
        ? TimeOfDay(hour: hour, minute: minute)
        : fallback;
  }

  String _formatTime(TimeOfDay value) =>
      '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';

  Future<void> _setConsent(String purpose, bool value) async {
    await _run(() async {
      final service = ref.read(personalizationServiceProvider);
      final consent =
          value
              ? await service.grantConsent(purpose)
              : await service.revokeConsent(purpose);
      _view = _view.copyWith(
        consents: [
          ..._view.consents.where((item) => item.purpose != purpose),
          consent,
        ],
      );
      ref.invalidate(personalizationProvider);
    });
  }

  Future<void> _deleteItem(PreferenceProfileItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: const Text('Remove this preference?'),
            content: Text(
              'Cuppet will remove “${item.key.replaceAll('_', ' ')}” from the profile and recompute related suggestions.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Remove'),
              ),
            ],
          ),
    );
    if (!mounted || confirmed != true) return;
    await _run(() async {
      await ref.read(personalizationServiceProvider).deleteItem(item.id);
      ref.invalidate(personalizationProvider);
    });
  }

  Future<void> _addExclusion() async {
    final typeController = TextEditingController(text: 'topic');
    final keyController = TextEditingController();
    final result = await showDialog<bool>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: const Text('Add something to avoid'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: typeController,
                  decoration: const InputDecoration(
                    labelText: 'Type',
                    hintText: 'topic or source',
                  ),
                ),
                TextField(
                  controller: keyController,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'Topic or source',
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Avoid'),
              ),
            ],
          ),
    );
    final type = typeController.text.trim().toLowerCase();
    final key = keyController.text.trim();
    typeController.dispose();
    keyController.dispose();
    if (!mounted || result != true || key.isEmpty) return;
    if (!const {'topic', 'source', 'format'}.contains(type)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Use topic, source, or format.')),
      );
      return;
    }
    await _run(() async {
      await ref
          .read(personalizationServiceProvider)
          .createExclusion(subjectType: type, subjectKey: key);
      ref.invalidate(personalizationProvider);
    });
  }

  Future<void> _editItem(PreferenceProfileItem item) async {
    final keyController = TextEditingController(
      text: item.key.replaceAll('_', ' '),
    );
    final weightController = TextEditingController(
      text: item.weight.toStringAsFixed(2),
    );
    final edit = await showDialog<Map<String, dynamic>>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: const Text('Edit preference'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: keyController,
                  autofocus: true,
                  decoration: const InputDecoration(
                    labelText: 'Topic, source, or format',
                  ),
                ),
                TextField(
                  controller: weightController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                    signed: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Strength',
                    hintText: '-1.0 to 1.0',
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () {
                  final weight = double.tryParse(weightController.text.trim());
                  final key = keyController.text.trim();
                  if (weight == null ||
                      weight < -1 ||
                      weight > 1 ||
                      key.isEmpty) {
                    return;
                  }
                  Navigator.pop(dialogContext, {'weight': weight, 'key': key});
                },
                child: const Text('Save'),
              ),
            ],
          ),
    );
    keyController.dispose();
    weightController.dispose();
    if (!mounted || edit == null) return;
    await _run(() async {
      await ref
          .read(personalizationServiceProvider)
          .updateItem(
            item.id,
            weight: edit['weight'] as double,
            key: edit['key'] as String,
          );
      ref.invalidate(personalizationProvider);
    });
  }

  Future<void> _reset() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (dialogContext) => AlertDialog(
            title: const Text('Reset personalization?'),
            content: const Text(
              'This removes your preference profile, feedback signals, suggestion history, and browser connection. Consent changes are retained as a minimal audit record. Assistant memory is not affected.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Reset'),
              ),
            ],
          ),
    );
    if (confirmed != true) return;
    await _run(() async {
      await ref.read(personalizationServiceProvider).resetProfile();
      ref.invalidate(personalizationProvider);
    });
  }

  Future<void> _export() async {
    await _run(() async {
      final data = await ref.read(personalizationServiceProvider).exportData();
      await Clipboard.setData(ClipboardData(text: jsonEncode(data)));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Personalization data copied to the clipboard.'),
          ),
        );
      }
    });
  }

  Future<void> _run(Future<void> Function() operation) async {
    setState(() => _busy = true);
    try {
      await operation();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                error,
                fallback: 'Personalization could not be updated.',
              ),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class PersonalizationSettingsView {
  PersonalizationSettingsView(PreferenceProfile profile)
    : settings = profile.settings,
      consents = profile.consents,
      browserConnected = profile.browserConnected;

  PersonalizationSettingsView._({
    required this.settings,
    required this.consents,
    required this.browserConnected,
  });

  final PersonalizationSettings settings;
  final List<PersonalizationConsent> consents;
  final bool browserConnected;

  PersonalizationSettingsView copyWith({
    PersonalizationSettings? settings,
    List<PersonalizationConsent>? consents,
    bool? browserConnected,
  }) => PersonalizationSettingsView._(
    settings: settings ?? this.settings,
    consents: consents ?? this.consents,
    browserConnected: browserConnected ?? this.browserConnected,
  );

  bool consentGranted(String purpose) =>
      consents.any((item) => item.purpose == purpose && item.isGranted);
}

class _ConsentTile extends StatelessWidget {
  const _ConsentTile({
    required this.title,
    required this.description,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final String title;
  final String description;
  final bool value;
  final bool enabled;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(
      SydneySpacing.lg,
      SydneySpacing.sm,
      SydneySpacing.sm,
      SydneySpacing.sm,
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: CuppetWorkspaceColors.ink,
                ),
              ),
              const SizedBox(height: SydneySpacing.xs),
              Text(
                description,
                style: const TextStyle(
                  color: CuppetWorkspaceColors.muted,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
        Switch.adaptive(
          value: value,
          onChanged: enabled ? onChanged : null,
          activeTrackColor: CuppetWorkspaceColors.primary,
          activeThumbColor: Colors.white,
        ),
      ],
    ),
  );
}

class _ProfileGroup extends StatelessWidget {
  const _ProfileGroup({
    required this.dimension,
    required this.items,
    required this.onEdit,
    required this.onDelete,
  });

  final String dimension;
  final List<PreferenceProfileItem> items;
  final ValueChanged<PreferenceProfileItem> onEdit;
  final ValueChanged<PreferenceProfileItem> onDelete;

  @override
  Widget build(BuildContext context) => WorkspaceCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          dimension.replaceAll('_', ' ').toUpperCase(),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: CuppetWorkspaceColors.primary,
            fontWeight: FontWeight.w800,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: SydneySpacing.sm),
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: SydneySpacing.sm),
            child: Row(
              children: [
                Icon(
                  item.isNegative
                      ? Icons.remove_circle_outline
                      : Icons.add_circle_outline,
                  size: 17,
                  color:
                      item.isNegative
                          ? SydneyColors.danger
                          : CuppetWorkspaceColors.primary,
                ),
                const SizedBox(width: SydneySpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.key.replaceAll('_', ' '),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      if (item.derivedFrom.isNotEmpty)
                        Text(
                          'From ${item.derivedFrom.map(_provenanceLabel).join(', ')}',
                          style: const TextStyle(
                            color: CuppetWorkspaceColors.muted,
                            fontSize: 11,
                          ),
                        ),
                    ],
                  ),
                ),
                Text(
                  _strength(item.weight),
                  style: const TextStyle(
                    color: CuppetWorkspaceColors.muted,
                    fontSize: 12,
                  ),
                ),
                if (dimension != 'exclusion')
                  IconButton(
                    tooltip: 'Edit preference',
                    onPressed: () => onEdit(item),
                    icon: const Icon(Icons.edit_outlined, size: 17),
                  ),
                IconButton(
                  tooltip: 'Remove preference',
                  onPressed: () => onDelete(item),
                  icon: const Icon(Icons.close_rounded, size: 18),
                ),
              ],
            ),
          ),
      ],
    ),
  );

  String _strength(double weight) {
    final value = weight.abs();
    if (value >= 0.75) return 'Strong';
    if (value >= 0.4) return 'Moderate';
    return 'Weak';
  }

  String _provenanceLabel(String value) => switch (value) {
    'connected_content' => 'connected sources',
    'browser_activity' => 'browser activity',
    'cross_source' => 'combined sources',
    'assistant_feedback' => 'direct feedback',
    'confirmed_memory' => 'confirmed memory',
    _ => 'Cuppet activity',
  };
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(SydneySpacing.page),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            friendlyErrorMessage(
              error,
              fallback: 'Personalization could not be loaded.',
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: SydneySpacing.md),
          OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    ),
  );
}

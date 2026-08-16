import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../../providers/agents_provider.dart';
import '../../services/api.dart';
import '../../widgets/workspace_primitives.dart';

class AgentPreferencesScreen extends ConsumerStatefulWidget {
  const AgentPreferencesScreen({required this.agent, super.key});

  final Agent agent;

  @override
  ConsumerState<AgentPreferencesScreen> createState() =>
      _AgentPreferencesScreenState();
}

class _AgentPreferencesScreenState
    extends ConsumerState<AgentPreferencesScreen> {
  String _responseTiming = 'real-time';
  double _responseLimit = 2;
  bool _runIndefinitely = false;
  late bool _isPaused;
  late final TextEditingController _descriptionController;
  final _activeUntilController = TextEditingController(text: 'June 30, 2026');

  @override
  void initState() {
    super.initState();
    _descriptionController = TextEditingController(
      text: widget.agent.description,
    );
    _isPaused = widget.agent.availability == AgentAvailability.paused;
    final schedule = widget.agent.parsedIntent?['schedule_cron']?.toString();
    final hasSchedule = schedule != null && schedule.trim().isNotEmpty;
    _responseTiming =
        hasSchedule || widget.agent.parsedIntent?['realtime_enabled'] != true
            ? 'daily'
            : 'real-time';
    final rawLimit =
        widget.agent.parsedIntent?['response_limit'] ??
        widget.agent.parsedIntent?['responseLimit'];
    if (rawLimit == 'concise') {
      _responseLimit = 1;
    } else if (rawLimit == 'detailed') {
      _responseLimit = 3;
    } else {
      _responseLimit = 2; // Balanced
    }

    final rawActiveUntil =
        widget.agent.parsedIntent?['active_until'] ??
        widget.agent.parsedIntent?['activeUntil'];
    if (rawActiveUntil == null) {
      _runIndefinitely = true;
      _activeUntilController.text = '';
    } else {
      _runIndefinitely = false;
      try {
        final parsed = DateTime.parse(rawActiveUntil.toString());
        final months = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        _activeUntilController.text =
            '${months[parsed.month - 1]} ${parsed.day}, ${parsed.year}';
      } catch (_) {
        _activeUntilController.text = rawActiveUntil.toString();
      }
    }
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _activeUntilController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: CuppetWorkspaceColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: CuppetWorkspaceColors.ink,
        title: Text(
          'Agent Preferences',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: CuppetWorkspaceColors.ink,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.md,
            SydneySpacing.page,
            SydneySpacing.xxl,
          ),
          children: [
            Text(
              'Configure how ${widget.agent.name} processes information and communicates with you.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: CuppetWorkspaceColors.muted,
                height: 1.35,
              ),
            ),
            const SizedBox(height: SydneySpacing.xl),

            // AGENT DESCRIPTION
            const WorkspaceSectionLabel('Agent Description'),
            const SizedBox(height: SydneySpacing.sm),
            WorkspaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    key: const ValueKey('agent_description_field'),
                    controller: _descriptionController,
                    minLines: 3,
                    maxLines: 6,
                    textCapitalization: TextCapitalization.sentences,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: CuppetWorkspaceColors.ink,
                      height: 1.4,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Describe what this agent should do.',
                      helperText:
                          'Use "update agent..." in chat for future changes.',
                      helperStyle: const TextStyle(
                        color: CuppetWorkspaceColors.muted,
                        fontSize: 11,
                      ),
                      helperMaxLines: 2,
                      filled: true,
                      fillColor: CuppetWorkspaceColors.background,
                      contentPadding: const EdgeInsets.all(SydneySpacing.md),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(SydneyRadius.md),
                        borderSide: const BorderSide(
                          color: CuppetWorkspaceColors.border,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(SydneyRadius.md),
                        borderSide: const BorderSide(
                          color: CuppetWorkspaceColors.border,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(SydneyRadius.md),
                        borderSide: const BorderSide(
                          color: CuppetWorkspaceColors.primary,
                          width: 1.4,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.xl),

            // STATUS
            const WorkspaceSectionLabel('Agent Status'),
            const SizedBox(height: SydneySpacing.sm),
            WorkspaceCard(
              padding: EdgeInsets.zero,
              child: SwitchListTile.adaptive(
                value: _isPaused,
                onChanged: (paused) => setState(() => _isPaused = paused),
                activeThumbColor: Colors.white,
                activeTrackColor: CuppetWorkspaceColors.primary,
                title: Text(
                  _isPaused ? 'Resume agent' : 'Pause agent',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: CuppetWorkspaceColors.ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                subtitle: Text(
                  _isPaused
                      ? 'This agent is paused and will not run on its schedule.'
                      : 'Turn this on to stop scheduled runs.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: CuppetWorkspaceColors.muted,
                  ),
                ),
                secondary: Icon(
                  _isPaused
                      ? Icons.play_circle_outline_rounded
                      : Icons.pause_circle_outline_rounded,
                  color: CuppetWorkspaceColors.primaryInk,
                ),
              ),
            ),
            const SizedBox(height: SydneySpacing.xl),

            if (widget.agent.supportsRealtime) ...[
              // RESPONSE TIMING
              const WorkspaceSectionLabel('Response Timing'),
              const SizedBox(height: SydneySpacing.sm),
              WorkspaceCard(
                key: const ValueKey('response-timing-card'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Select when the agent should deliver updates or actions.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: CuppetWorkspaceColors.muted,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.md),
                    _TimingOption(
                      title: 'Real-time',
                      subtitle:
                          'Notify me when a matching external event occurs',
                      selected: _responseTiming == 'real-time',
                      onTap:
                          () => setState(() => _responseTiming = 'real-time'),
                    ),
                    const SizedBox(height: SydneySpacing.sm),
                    _TimingOption(
                      title: 'Daily Summary',
                      subtitle: 'A consolidated digest at a set time',
                      selected: _responseTiming == 'daily',
                      onTap: () => setState(() => _responseTiming = 'daily'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.xl),
            ],

            // RESPONSE LIMIT
            const WorkspaceSectionLabel('Response Verbosity'),
            const SizedBox(height: SydneySpacing.sm),
            WorkspaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Adjust the verbosity of the agent's output.",
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: CuppetWorkspaceColors.muted,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: SydneySpacing.md),
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      activeTrackColor: CuppetWorkspaceColors.primary,
                      inactiveTrackColor: CuppetWorkspaceColors.softSage,
                      thumbColor: CuppetWorkspaceColors.primary,
                      overlayColor: CuppetWorkspaceColors.softSage,
                    ),
                    child: Slider(
                      min: 1,
                      max: 3,
                      divisions: 2,
                      value: _responseLimit,
                      onChanged:
                          (value) => setState(() => _responseLimit = value),
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _LimitLabel(
                        label: 'Concise',
                        selected: _responseLimit.round() == 1,
                      ),
                      _LimitLabel(
                        label: 'Balanced',
                        selected: _responseLimit.round() == 2,
                      ),
                      _LimitLabel(
                        label: 'Detailed',
                        selected: _responseLimit.round() == 3,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.xl),

            // ACTIVE UNTIL
            const WorkspaceSectionLabel('Active Until'),
            const SizedBox(height: SydneySpacing.sm),
            WorkspaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "Set an expiration date for this agent's active duties.",
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: CuppetWorkspaceColors.muted,
                      height: 1.3,
                    ),
                  ),
                  const SizedBox(height: SydneySpacing.md),
                  TextField(
                    controller: _activeUntilController,
                    enabled: !_runIndefinitely,
                    readOnly: true,
                    onTap:
                        _runIndefinitely
                            ? null
                            : () async {
                              final now = DateTime.now();
                              final initialDate =
                                  DateTime.tryParse(
                                    widget
                                            .agent
                                            .parsedIntent?['active_until'] ??
                                        '',
                                  ) ??
                                  now.add(const Duration(days: 365));
                              final picked = await showDatePicker(
                                context: context,
                                initialDate:
                                    initialDate.isAfter(now)
                                        ? initialDate
                                        : now,
                                firstDate: now,
                                lastDate: now.add(
                                  const Duration(days: 365 * 10),
                                ),
                              );
                              if (picked != null) {
                                final months = [
                                  'January',
                                  'February',
                                  'March',
                                  'April',
                                  'May',
                                  'June',
                                  'July',
                                  'August',
                                  'September',
                                  'October',
                                  'November',
                                  'December',
                                ];
                                setState(() {
                                  _activeUntilController.text =
                                      '${months[picked.month - 1]} ${picked.day}, ${picked.year}';
                                });
                              }
                            },
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: CuppetWorkspaceColors.ink,
                      fontWeight: FontWeight.w600,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Unlimited',
                      fillColor: CuppetWorkspaceColors.background,
                      filled: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(SydneyRadius.md),
                        borderSide: const BorderSide(
                          color: CuppetWorkspaceColors.border,
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(SydneyRadius.md),
                        borderSide: const BorderSide(
                          color: CuppetWorkspaceColors.border,
                        ),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(SydneyRadius.md),
                        borderSide: const BorderSide(
                          color: CuppetWorkspaceColors.primary,
                          width: 1.4,
                        ),
                      ),
                      suffixIcon: const Icon(
                        Icons.calendar_today_rounded,
                        color: CuppetWorkspaceColors.muted,
                        size: 18,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: SydneySpacing.md,
                        vertical: 14,
                      ),
                    ),
                  ),
                  const SizedBox(height: SydneySpacing.sm),
                  Material(
                    color: Colors.transparent,
                    child: CheckboxListTile(
                      value: _runIndefinitely,
                      onChanged: (value) {
                        setState(() {
                          _runIndefinitely = value ?? false;
                          if (_runIndefinitely) {
                            _activeUntilController.clear();
                          } else {
                            final defaultDate = DateTime.now().add(
                              const Duration(days: 365),
                            );
                            final months = [
                              'January',
                              'February',
                              'March',
                              'April',
                              'May',
                              'June',
                              'July',
                              'August',
                              'September',
                              'October',
                              'November',
                              'December',
                            ];
                            _activeUntilController.text =
                                '${months[defaultDate.month - 1]} ${defaultDate.day}, ${defaultDate.year}';
                          }
                        });
                      },
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      activeColor: CuppetWorkspaceColors.primary,
                      title: Text(
                        'Run indefinitely',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: CuppetWorkspaceColors.ink,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            if (!widget.agent.isAssistant) ...[
              const SizedBox(height: SydneySpacing.xl),
              const WorkspaceSectionLabel('Danger Zone'),
              const SizedBox(height: SydneySpacing.sm),
              WorkspaceCard(
                color: SydneyColors.dangerSoft,
                borderColor: SydneyColors.dangerSoft,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Delete agent',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: SydneyColors.danger,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Permanently delete this agent and all its messages. This action cannot be undone.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: SydneyColors.danger,
                        fontWeight: FontWeight.w500,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.md),
                    OutlinedButton.icon(
                      onPressed: _confirmDelete,
                      icon: const Icon(Icons.delete_outline_rounded, size: 16),
                      label: const Text('Delete Agent'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: SydneyColors.danger,
                        side: const BorderSide(color: SydneyColors.danger),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(SydneyRadius.md),
                        ),
                        minimumSize: const Size.fromHeight(44),
                        textStyle: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: SydneySpacing.xxl),
            FilledButton.icon(
              onPressed: _savePreferences,
              icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
              label: const Text('Save Preferences'),
              style: FilledButton.styleFrom(
                backgroundColor: CuppetWorkspaceColors.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(SydneyRadius.lg),
                ),
                minimumSize: const Size.fromHeight(48),
                textStyle: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _savePreferences() async {
    final limitStr =
        _responseLimit.round() == 1
            ? 'concise'
            : _responseLimit.round() == 3
            ? 'detailed'
            : 'balanced';

    String? activeUntilIso;
    if (!_runIndefinitely) {
      final parsedDate = _parseActiveUntilText(_activeUntilController.text);
      if (parsedDate != null) {
        activeUntilIso = parsedDate.toUtc().toIso8601String();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please select or enter a valid date.')),
        );
        return;
      }
    }

    final description = _descriptionController.text.trim();
    if (description.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add a clear agent description.')),
      );
      return;
    }
    final descriptionChanged = description != widget.agent.description.trim();
    if (descriptionChanged && !await _confirmDescriptionUpdate()) {
      return;
    }

    try {
      final patch = <String, dynamic>{
        'response_limit': limitStr,
        'active_until': activeUntilIso,
        if (widget.agent.supportsRealtime)
          'realtime_enabled': _responseTiming == 'real-time',
        'status': _isPaused ? 'paused' : 'active',
        if (descriptionChanged) 'description': description,
      };
      await ref.read(agentServiceProvider).patchAgent(widget.agent.id, patch);
      ref.invalidate(agentsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Preferences saved successfully.')),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                e,
                fallback: 'Agent preferences couldn’t be saved right now.',
              ),
            ),
          ),
        );
      }
    }
  }

  Future<bool> _confirmDescriptionUpdate() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Update agent functionality?'),
            content: const Text(
              'Changing the agent description will update its functionality.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Confirm'),
              ),
            ],
          ),
    );
    return confirmed == true;
  }

  DateTime? _parseActiveUntilText(String text) {
    try {
      final clean = text.trim();
      if (clean.isEmpty) return null;

      final months = [
        'january',
        'february',
        'march',
        'april',
        'may',
        'june',
        'july',
        'august',
        'september',
        'october',
        'november',
        'december',
      ];
      final match = RegExp(
        r'^([a-zA-Z]+)\s+(\d{1,2}),\s*(\d{4})$',
      ).firstMatch(clean);
      if (match != null) {
        final monthStr = match.group(1)!.toLowerCase();
        final day = int.parse(match.group(2)!);
        final year = int.parse(match.group(3)!);
        final monthIndex = months.indexOf(monthStr);
        if (monthIndex != -1) {
          return DateTime(year, monthIndex + 1, day, 23, 59, 59);
        }
      }

      return DateTime.tryParse(clean);
    } catch (_) {
      return null;
    }
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: const Text('Delete agent'),
            content: Text(
              'This will permanently delete "${widget.agent.name}" and all its messages. This cannot be undone.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFFDC2626),
                ),
                child: const Text('Delete'),
              ),
            ],
          ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await ref.read(agentServiceProvider).archiveAgent(widget.agent.id);
      ref.invalidate(agentsProvider);
      if (mounted) {
        Navigator.of(context).popUntil((route) => route.isFirst);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('"${widget.agent.name}" deleted.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                e,
                fallback: 'That agent couldn’t be deleted right now.',
              ),
            ),
          ),
        );
      }
    }
  }
}

class _TimingOption extends StatelessWidget {
  const _TimingOption({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color:
            selected
                ? CuppetWorkspaceColors.softSage
                : CuppetWorkspaceColors.card,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(
          color:
              selected
                  ? CuppetWorkspaceColors.primary
                  : CuppetWorkspaceColors.border,
          width: selected ? 1.4 : 1.0,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(SydneyRadius.md),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(SydneySpacing.md),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: CuppetWorkspaceColors.ink,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: CuppetWorkspaceColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                _RadioDot(selected: selected),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RadioDot extends StatelessWidget {
  const _RadioDot({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        color: selected ? CuppetWorkspaceColors.primary : Colors.transparent,
        shape: BoxShape.circle,
        border: Border.all(
          color:
              selected
                  ? CuppetWorkspaceColors.primary
                  : CuppetWorkspaceColors.border,
          width: 1.5,
        ),
      ),
      alignment: Alignment.center,
      child:
          selected
              ? Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
              )
              : null,
    );
  }
}

class _LimitLabel extends StatelessWidget {
  const _LimitLabel({required this.label, required this.selected});

  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color:
            selected
                ? CuppetWorkspaceColors.primaryInk
                : CuppetWorkspaceColors.muted,
        fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
      ),
    );
  }
}

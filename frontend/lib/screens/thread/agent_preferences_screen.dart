import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../../providers/agents_provider.dart';
import '../../widgets/sydney_primitives.dart';

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
                icon: const Icon(
                  Icons.arrow_back_rounded,
                  size: 18,
                  color: SydneyColors.ink,
                ),
              ),
            ),
          ),
        ),
        titleSpacing: 12,
        title: Text(
          'Agent Preferences',
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
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.md,
            SydneySpacing.page,
            96,
          ),
          children: [
            Text(
              'Configure how this agent processes information and communicates with you.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.mutedInk,
                height: 1.35,
              ),
            ),
            const SizedBox(height: SydneySpacing.md),
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
              padding: const EdgeInsets.all(SydneySpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _PanelTitle(
                    icon: Icons.info_outline_rounded,
                    title: 'Agent Description',
                  ),
                  const SizedBox(height: SydneySpacing.md),
                  TextField(
                    key: const ValueKey('agent_description_field'),
                    controller: _descriptionController,
                    minLines: 3,
                    maxLines: 6,
                    textCapitalization: TextCapitalization.sentences,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurface,
                      height: 1.4,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Describe what this agent should do.',
                      helperText:
                          'Use “update agent…” in chat for future changes.',
                      helperMaxLines: 2,
                      filled: true,
                      fillColor: SydneyColors.surfaceContainerLowest,
                      contentPadding: const EdgeInsets.all(SydneySpacing.md),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: SydneyColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: SydneyColors.line),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.md),
            Material(
              color: SydneyColors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(
                  color: SydneyColors.line.withValues(alpha: 0.35),
                  width: 0.8,
                ),
              ),
              clipBehavior: Clip.antiAlias,
              child: SwitchListTile(
                value: _isPaused,
                onChanged: (paused) => setState(() => _isPaused = paused),
                activeThumbColor: Colors.white,
                activeTrackColor: SydneyColors.primary,
                title: Text(
                  _isPaused ? 'Resume agent' : 'Pause agent',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: SydneyColors.ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: Text(
                  _isPaused
                      ? 'This agent is paused and will not run on its schedule.'
                      : 'Turn this on to stop scheduled runs.',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
                ),
                secondary: Icon(
                  _isPaused
                      ? Icons.play_circle_outline
                      : Icons.pause_circle_outline,
                  color: SydneyColors.primary,
                ),
              ),
            ),
            const SizedBox(height: SydneySpacing.md),
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
              padding: const EdgeInsets.all(SydneySpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _PanelTitle(
                    icon: Icons.tune_rounded,
                    title: 'Response Timing',
                  ),
                  const SizedBox(height: SydneySpacing.xs),
                  Text(
                    'Select when the agent should deliver updates or actions.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 11,
                      color: SydneyColors.mutedInk,
                    ),
                  ),
                  const SizedBox(height: SydneySpacing.md),
                  _TimingOption(
                    title: 'Real-time',
                    subtitle: 'Notify me when a matching external event occurs',
                    selected: _responseTiming == 'real-time',
                    onTap: () => setState(() => _responseTiming = 'real-time'),
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
            const SizedBox(height: SydneySpacing.md),
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
              padding: const EdgeInsets.all(SydneySpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _PanelTitle(
                    icon: Icons.layers_outlined,
                    title: 'Response Limit',
                  ),
                  const SizedBox(height: SydneySpacing.xs),
                  Text(
                    "Adjust the verbosity of the agent's output.",
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 11,
                      color: SydneyColors.mutedInk,
                    ),
                  ),
                  const SizedBox(height: SydneySpacing.md),
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      activeTrackColor: SydneyColors.primary,
                      inactiveTrackColor: SydneyColors.primarySoft,
                      thumbColor: SydneyColors.primary,
                      overlayColor: SydneyColors.primarySoft,
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
            const SizedBox(height: SydneySpacing.md),
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
              padding: const EdgeInsets.all(SydneySpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _PanelTitle(
                    icon: Icons.calendar_month_outlined,
                    title: 'Active Until',
                  ),
                  const SizedBox(height: SydneySpacing.xs),
                  Text(
                    "Set an expiration date for this agent's active duties.",
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 11,
                      color: SydneyColors.mutedInk,
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
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurface,
                      fontWeight: FontWeight.w500,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Unlimited',
                      fillColor: SydneyColors.surfaceContainer,
                      filled: true,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: SydneyColors.line),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: SydneyColors.line),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                          color: SydneyColors.primary,
                        ),
                      ),
                      suffixIcon: const Icon(
                        Icons.chevron_right_rounded,
                        color: SydneyColors.outlineVariant,
                        size: 18,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: SydneySpacing.lg,
                        vertical: SydneySpacing.md,
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
                      title: Text(
                        'Run indefinitely',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: SydneyColors.onSurfaceVariant,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (!widget.agent.isAssistant) ...[
              const SizedBox(height: SydneySpacing.lg),
              const SydneySectionLabel('Danger Zone'),
              const SizedBox(height: SydneySpacing.sm),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF991B1B).withValues(alpha: 0.03),
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
                    color: const Color(0xFFFCA5A5),
                    width: 0.8,
                  ),
                ),
                padding: const EdgeInsets.all(SydneySpacing.lg),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Delete agent',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: const Color(0xFF991B1B),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Permanently delete this agent and all its messages. This action cannot be undone.',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFFB91C1C),
                        fontWeight: FontWeight.w400,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.md),
                    OutlinedButton.icon(
                      onPressed: _confirmDelete,
                      icon: const Icon(Icons.delete_outline_rounded, size: 16),
                      label: const Text('Delete Agent'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        minimumSize: const Size.fromHeight(44),
                        textStyle: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SydneyFooter(
        child: FilledButton.icon(
          onPressed: _savePreferences,
          icon: const Icon(Icons.check_box_outlined, size: 18),
          label: const Text('Save Preferences'),
          style: FilledButton.styleFrom(
            backgroundColor: SydneyColors.primary,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            minimumSize: const Size.fromHeight(48),
            textStyle: const TextStyle(fontWeight: FontWeight.bold),
          ),
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
          SnackBar(content: Text('Failed to save preferences: $e')),
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
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }
}

class _PanelTitle extends StatelessWidget {
  const _PanelTitle({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: SydneyColors.primary, size: 18),
        const SizedBox(width: SydneySpacing.sm),
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: SydneyColors.primary,
            fontSize: 14,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
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
        color: selected ? SydneyColors.primarySoft : SydneyColors.surfaceRaised,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: selected ? SydneyColors.primary : SydneyColors.line,
          width: selected ? 1.2 : 0.8,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
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
                        style: Theme.of(
                          context,
                        ).textTheme.labelMedium?.copyWith(
                          color: SydneyColors.ink,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: SydneyColors.onSurfaceVariant,
                          fontWeight: FontWeight.w400,
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
      width: 16,
      height: 16,
      decoration: BoxDecoration(
        color: selected ? SydneyColors.primary : Colors.transparent,
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? SydneyColors.primary : SydneyColors.outline,
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
        color: selected ? SydneyColors.primary : SydneyColors.onSurfaceVariant,
        fontWeight: FontWeight.w800,
      ),
    );
  }
}

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
  ConsumerState<AgentPreferencesScreen> createState() => _AgentPreferencesScreenState();
}

class _AgentPreferencesScreenState extends ConsumerState<AgentPreferencesScreen> {
  String _responseTiming = 'real-time';
  double _responseLimit = 2;
  bool _runIndefinitely = false;
  final _activeUntilController = TextEditingController(text: 'June 30, 2026');

  @override
  void dispose() {
    _activeUntilController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
        ),
        title: const Text('Agent Preferences'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
      ),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.lg,
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
            const SizedBox(height: SydneySpacing.lg),
            SydneyPanel(
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
                    subtitle: 'Immediate notification on every action',
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
            SydneyPanel(
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
            SydneyPanel(
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
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: SydneyColors.onSurface,
                      fontWeight: FontWeight.w500,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'Unlimited',
                      fillColor: SydneyColors.surfaceContainer,
                      suffixIcon: Icon(
                        Icons.chevron_right_rounded,
                        color: SydneyColors.outlineVariant,
                        size: 18,
                      ),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: SydneySpacing.lg,
                        vertical: SydneySpacing.md,
                      ),
                    ),
                  ),
                  const SizedBox(height: SydneySpacing.sm),
                  CheckboxListTile(
                    value: _runIndefinitely,
                    onChanged:
                        (value) =>
                            setState(() => _runIndefinitely = value ?? false),
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
                ],
              ),
            ),
            if (!widget.agent.isAssistant) ...[
              const SizedBox(height: SydneySpacing.lg),
              const SydneySectionLabel('Danger Zone'),
              SydneyPanel(
                borderColor: const Color(0xFFFCA5A5),
                color: const Color(0xFFFEF2F2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Delete agent',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: const Color(0xFF991B1B),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
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
                        minimumSize: const Size.fromHeight(40),
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
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.check_box_outlined, size: 18),
          label: const Text('Save Preferences'),
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        ),
      ),
    );
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
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
          SnackBar(content: Text(e.toString())),
        );
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
    return SydneyPanel(
      onTap: onTap,
      shadow: false,
      padding: const EdgeInsets.all(SydneySpacing.md),
      borderColor: selected ? SydneyColors.primary : SydneyColors.line,
      color: selected ? SydneyColors.primarySoft : SydneyColors.surfaceRaised,
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
                  ).textTheme.labelMedium?.copyWith(color: SydneyColors.ink),
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
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

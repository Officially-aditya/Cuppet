import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../providers/agents_provider.dart';
import '../../services/agent_service.dart';
import '../../widgets/sydney_primitives.dart';
import 'create_screen.dart';

class ConfirmScreen extends ConsumerStatefulWidget {
  const ConfirmScreen({required this.draft, super.key});

  final AgentCreationDraft draft;

  @override
  ConsumerState<ConfirmScreen> createState() => _ConfirmScreenState();
}

class _ConfirmScreenState extends ConsumerState<ConfirmScreen> {
  bool _creating = false;
  bool _loading = true;
  Map<String, dynamic>? _parsedIntent;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadParsedIntent();
  }

  Future<void> _loadParsedIntent() async {
    try {
      final parsed = await ref.read(agentServiceProvider).parseAgentPrompt(widget.draft.prompt);
      if (mounted) {
        setState(() {
          _parsedIntent = parsed;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  String _describeTiming(Map<String, dynamic>? parsed) {
    final cron = parsed?['schedule_cron']?.toString();
    if (cron == null) return 'Whenever you message it';
    if (cron.contains('0 9 * * *')) return 'Daily at 9:00 AM';
    if (cron.contains('0 8 * * *')) return 'Daily at 8:00 AM';
    if (cron.contains('0 7 * * *')) return 'Daily at 7:00 AM';
    if (cron.contains('0 6 * * *')) return 'Daily at 6:00 AM';
    if (cron.contains('0 8 * * 1')) return 'Weekly on Mondays at 8:00 AM';
    if (cron.contains('0 9 * * 1')) return 'Weekly on Mondays at 9:00 AM';
    if (cron.contains('0 20 * * *')) return 'Daily at 8:00 PM';
    if (cron.contains('0 21 * * *')) return 'Daily at 9:00 PM';
    if (cron.contains('0 16 * * *')) return 'Daily at 4:00 PM';
    if (cron.contains('0 17 * * 5')) return 'Weekly on Fridays at 5:00 PM';
    return 'Runs on schedule: $cron';
  }

  IconData _permissionIcon(String perm) {
    final lower = perm.toLowerCase();
    if (lower.contains('calendar')) return Icons.calendar_month_outlined;
    if (lower.contains('gmail') || lower.contains('email')) return Icons.mail_outline_rounded;
    if (lower.contains('drive')) return Icons.description_outlined;
    if (lower.contains('web')) return Icons.search_rounded;
    return Icons.security_outlined;
  }

  String _describeOutput(Map<String, dynamic>? parsed) {
    final template = parsed?['output_template']?.toString();
    return switch (template) {
      'plain_text' => 'A custom formatted text report',
      'checklist' => 'An interactive checklist of action items',
      'urgency_list' => 'A prioritized list of urgent updates',
      'data_summary' => 'A structured data summary report',
      'daily_task' => 'A daily practice task breakdown',
      'streak_counter' => 'A tracker counting streak milestones',
      'comparison' => 'A structured comparison overview',
      'news_brief' => 'A summarized brief of recent articles',
      'study_guide' => 'A study topic, explanation, and reference links',
      _ => 'A detailed summary report',
    };
  }

  @override
  Widget build(BuildContext context) {
    final permissions = _parsedIntent?['permissions_needed'] is List
        ? List<String>.from(_parsedIntent?['permissions_needed'])
        : const <String>[];

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: _creating ? null : () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
        ),
        title: const Text('Confirm'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
      ),
      body: SafeArea(
        bottom: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(SydneySpacing.lg),
                      child: Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: SydneyColors.danger),
                      ),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(
                      SydneySpacing.page,
                      SydneySpacing.lg,
                      SydneySpacing.page,
                      140,
                    ),
                    children: [
                      SydneyPanel(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          children: [
                            const SydneyIconBadge(
                              size: 48,
                              color: SydneyColors.primarySoft,
                              foregroundColor: SydneyColors.primary,
                              radius: SydneyRadius.full,
                              child: Text('M'),
                            ),
                            const SizedBox(height: SydneySpacing.md),
                            Text(
                              _parsedIntent?['name']?.toString() ?? _agentName(widget.draft),
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: SydneySpacing.md),
                            Text(
                              '"${widget.draft.prompt}"',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: SydneyColors.onSurfaceVariant,
                                height: 1.45,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: SydneySpacing.md),
                      _InfoCard(
                        icon: Icons.assignment_outlined,
                        title: 'What it does',
                        child: Text(
                          _parsedIntent?['action']?.toString() ?? 'No description generated.',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: SydneyColors.onSurfaceVariant,
                            height: 1.35,
                          ),
                        ),
                      ),
                      const SizedBox(height: SydneySpacing.md),
                      _InfoCard(
                        icon: Icons.schedule_rounded,
                        title: 'When it runs',
                        child: Text(
                          _describeTiming(_parsedIntent),
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: SydneyColors.onSurfaceVariant,
                            height: 1.35,
                          ),
                        ),
                      ),
                      const SizedBox(height: SydneySpacing.md),
                      _InfoCard(
                        icon: Icons.lock_outline_rounded,
                        title: 'What it needs',
                        child: permissions.isEmpty
                            ? Text(
                                'No external permissions required.',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: SydneyColors.onSurfaceVariant,
                                  height: 1.35,
                                ),
                              )
                            : Wrap(
                                spacing: SydneySpacing.sm,
                                runSpacing: SydneySpacing.sm,
                                children: [
                                  for (final perm in permissions)
                                    _AccessPill(icon: _permissionIcon(perm), label: perm),
                                ],
                              ),
                      ),
                      const SizedBox(height: SydneySpacing.md),
                      _InfoCard(
                        icon: Icons.send_rounded,
                        title: 'What it sends',
                        child: Text(
                          _describeOutput(_parsedIntent),
                          style: const TextStyle(
                            color: SydneyColors.onSurfaceVariant,
                            fontSize: 12,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
      ),
      bottomNavigationBar: SydneyFooter(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FilledButton(
              onPressed: _creating ? null : _create,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
              child: Text(_creating ? 'Creating...' : 'Create agent'),
            ),
            const SizedBox(height: SydneySpacing.sm),
            OutlinedButton(
              onPressed: _creating ? null : () => Navigator.of(context).pop(),
              style: OutlinedButton.styleFrom(
                foregroundColor: SydneyColors.onSurface,
                minimumSize: const Size.fromHeight(44),
                textStyle: Theme.of(context).textTheme.labelSmall?.copyWith(
                  letterSpacing: 0.8,
                  fontWeight: FontWeight.w800,
                ),
              ),
              child: const Text('EDIT SENTENCE'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _create() async {
    setState(() => _creating = true);
    final navigator = Navigator.of(context);
    try {
      await ref
          .read(agentsProvider.notifier)
          .createAgent(
            CreateAgentRequest(
              prompt: widget.draft.prompt,
              templateId: widget.draft.templateId,
            ),
          );
      if (!mounted) {
        return;
      }
      navigator.popUntil((route) => route.isFirst);
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _creating = false);
      }
    }
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.icon,
    required this.title,
    required this.child,
  });

  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SydneyPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: SydneyColors.primary, size: 16),
              const SizedBox(width: SydneySpacing.sm),
              Text(
                title.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: SydneyColors.primary,
                  letterSpacing: 0.7,
                ),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.md),
          child,
        ],
      ),
    );
  }
}


class _AccessPill extends StatelessWidget {
  const _AccessPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: SydneyColors.onSurfaceVariant, size: 12),
          const SizedBox(width: SydneySpacing.xs),
          Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              fontSize: 10,
              letterSpacing: 0.4,
            ),
          ),
        ],
      ),
    );
  }
}

String _agentName(AgentCreationDraft draft) {
  if (draft.templateId == 'summary') {
    return 'Meeting Prep';
  }
  return draft.templateLabel;
}



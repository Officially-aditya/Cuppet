import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../providers/agents_provider.dart';
import '../../providers/timezone_provider.dart';
import '../../services/agent_service.dart';
import '../../widgets/workspace_primitives.dart';
import 'create_screen.dart';
import 'creation_workspace_widgets.dart';

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
      final parsed = await ref
          .read(agentServiceProvider)
          .parseAgentPrompt(widget.draft.prompt);
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

  String _describeTiming(
    Map<String, dynamic>? parsed, {
    required String? timeZone,
  }) {
    final cron = parsed?['schedule_cron']?.toString();
    if (cron == null) return 'Whenever you message it';

    String scheduled(String label) =>
        '$label · ${timeZone ?? 'your local time'}';

    final parts = cron.split(' ');
    if (parts.length < 5) return scheduled('Runs on schedule: $cron');

    final minuteStr = parts[0];
    final hourStr = parts[1];
    final dom = parts[2];
    final dow = parts[4];

    final minute = int.tryParse(minuteStr);
    final hour = int.tryParse(hourStr);
    if (minute == null || hour == null) {
      return scheduled('Runs on schedule: $cron');
    }

    final hourNum = hour == 0 || hour == 12 ? 12 : hour % 12;
    final ampm = hour < 12 ? 'AM' : 'PM';
    final minutePad = minute.toString().padLeft(2, '0');
    final timeStr = '$hourNum:$minutePad $ampm';

    if (dow == '1-5') {
      return scheduled('Weekdays at $timeStr');
    }

    if (dow == '*') {
      if (dom == '*') {
        return scheduled('Daily at $timeStr');
      } else {
        final suffix = _daySuffix(dom);
        return scheduled('Monthly on the $dom$suffix at $timeStr');
      }
    }

    final days = {
      '0': 'Sundays',
      '1': 'Mondays',
      '2': 'Tuesdays',
      '3': 'Wednesdays',
      '4': 'Thursdays',
      '5': 'Fridays',
      '6': 'Saturdays',
      '7': 'Sundays',
    };
    if (days.containsKey(dow)) {
      return scheduled('Weekly on ${days[dow]} at $timeStr');
    }

    return scheduled('Runs on schedule: $cron');
  }

  String _daySuffix(String dayStr) {
    final day = int.tryParse(dayStr);
    if (day == null) return '';
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  }

  IconData _permissionIcon(String perm) {
    final lower = perm.toLowerCase();
    if (lower.contains('calendar')) return Icons.calendar_month_outlined;
    if (lower.contains('gmail') || lower.contains('email')) {
      return Icons.mail_outline_rounded;
    }
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
      'dsa_question' =>
        'A daily practice DSA coding problem with examples and hints',
      'content_extractor' =>
        'A set of content creation ideas with tapable draft post generation',
      'portfolio_watch' => 'A custom stock portfolio tracker layout',
      _ => 'A detailed summary report',
    };
  }

  @override
  Widget build(BuildContext context) {
    final permissions =
        _parsedIntent?['permissions_needed'] is List
            ? List<String>.from(_parsedIntent?['permissions_needed'])
            : const <String>[];
    final timeZone =
        ref.watch(timezonePreferencesProvider).value?.displayedTimeZone;

    return Scaffold(
      key: const ValueKey('confirm-agent-screen'),
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: CreationBackAppBar(
        backButtonKey: const ValueKey('confirm-agent-back'),
        onBack: _creating ? null : () => Navigator.of(context).maybePop(),
      ),
      body: SafeArea(
        bottom: false,
        child:
            _loading
                ? const Center(
                  child: CircularProgressIndicator(
                    color: CuppetWorkspaceColors.primary,
                  ),
                )
                : _error != null
                ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(SydneySpacing.lg),
                    child: WorkspaceCard(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.error_outline_rounded,
                            color: SydneyColors.danger,
                          ),
                          const SizedBox(height: SydneySpacing.sm),
                          Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: CuppetWorkspaceColors.ink,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
                : ListView(
                  padding: const EdgeInsets.fromLTRB(
                    SydneySpacing.page,
                    SydneySpacing.xs,
                    SydneySpacing.page,
                    SydneySpacing.xl,
                  ),
                  children: [
                    Text(
                      'Final review',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: CuppetWorkspaceColors.primaryInk,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.2,
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.sm),
                    Text(
                      'Confirm your agent',
                      style: Theme.of(
                        context,
                      ).textTheme.headlineSmall?.copyWith(
                        color: CuppetWorkspaceColors.ink,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        height: 1.05,
                        letterSpacing: -0.7,
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.sm),
                    Text(
                      'Review what it will do, when it will run, and which services it needs.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: CuppetWorkspaceColors.muted,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.xl),
                    WorkspaceCard(
                      key: const ValueKey('agent-review-card'),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: CuppetWorkspaceColors.softSage,
                              borderRadius: BorderRadius.circular(
                                SydneyRadius.md,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: const Text(
                              'C',
                              style: TextStyle(
                                color: CuppetWorkspaceColors.primaryInk,
                                fontWeight: FontWeight.w800,
                                fontSize: 17,
                              ),
                            ),
                          ),
                          const SizedBox(width: SydneySpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _parsedIntent?['name']?.toString() ??
                                      _agentName(widget.draft),
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium?.copyWith(
                                    color: CuppetWorkspaceColors.ink,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: SydneySpacing.sm),
                                Text(
                                  widget.draft.prompt,
                                  maxLines: 5,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.bodySmall?.copyWith(
                                    color: CuppetWorkspaceColors.muted,
                                    height: 1.45,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.xl),
                    const WorkspaceSectionLabel('Agent details'),
                    const SizedBox(height: SydneySpacing.sm),
                    _InfoCard(
                      icon: Icons.assignment_outlined,
                      title: 'What it does',
                      child: Text(
                        _parsedIntent?['action']?.toString() ??
                            'No description generated.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: CuppetWorkspaceColors.muted,
                          height: 1.35,
                        ),
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.md),
                    _InfoCard(
                      icon: Icons.schedule_rounded,
                      title: 'When it runs',
                      child: Text(
                        _describeTiming(_parsedIntent, timeZone: timeZone),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: CuppetWorkspaceColors.muted,
                          height: 1.35,
                        ),
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.md),
                    _InfoCard(
                      icon: Icons.output_rounded,
                      title: 'Output layout',
                      child: Text(
                        _describeOutput(_parsedIntent),
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: CuppetWorkspaceColors.muted,
                          height: 1.35,
                        ),
                      ),
                    ),
                    if (permissions.isNotEmpty) ...[
                      const SizedBox(height: SydneySpacing.md),
                      _InfoCard(
                        icon: Icons.security_rounded,
                        title: 'Connected tools required',
                        child: Wrap(
                          spacing: SydneySpacing.sm,
                          runSpacing: SydneySpacing.sm,
                          children: [
                            for (final perm in permissions)
                              _AccessPill(
                                icon: _permissionIcon(perm),
                                label: perm,
                              ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
      ),
      bottomNavigationBar: CreationFooter(
        secondaryLabel: 'Back',
        onSecondary: _creating ? null : () => Navigator.of(context).maybePop(),
        primaryLabel: 'Create Agent',
        onPrimary: _creating ? null : _createAgent,
        primaryChild:
            _creating
                ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
                : null,
      ),
    );
  }

  Future<void> _createAgent() async {
    setState(() => _creating = true);
    try {
      await ref
          .read(agentsProvider.notifier)
          .createAgent(
            CreateAgentRequest(
              prompt: widget.draft.prompt,
              templateId: widget.draft.templateId,
            ),
          );

      if (!mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
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
    return WorkspaceCard(
      padding: const EdgeInsets.all(SydneySpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: CuppetWorkspaceColors.background,
              borderRadius: BorderRadius.circular(SydneyRadius.md),
            ),
            alignment: Alignment.center,
            child: Icon(
              icon,
              color: CuppetWorkspaceColors.primaryInk,
              size: 18,
            ),
          ),
          const SizedBox(width: SydneySpacing.md),
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
                const SizedBox(height: SydneySpacing.sm),
                DefaultTextStyle.merge(
                  style: const TextStyle(color: CuppetWorkspaceColors.muted),
                  child: child,
                ),
              ],
            ),
          ),
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: CuppetWorkspaceColors.background,
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        border: Border.all(color: CuppetWorkspaceColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: CuppetWorkspaceColors.primaryInk, size: 13),
          const SizedBox(width: SydneySpacing.xs),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: CuppetWorkspaceColors.ink,
              fontSize: 10,
              fontWeight: FontWeight.w700,
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

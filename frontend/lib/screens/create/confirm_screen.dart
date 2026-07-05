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

    final parts = cron.split(' ');
    if (parts.length < 5) return 'Runs on schedule: $cron';

    final minuteStr = parts[0];
    final hourStr = parts[1];
    final dom = parts[2];
    final dow = parts[4];

    final minute = int.tryParse(minuteStr);
    final hour = int.tryParse(hourStr);
    if (minute == null || hour == null) return 'Runs on schedule: $cron';

    final hourNum = hour == 0 || hour == 12 ? 12 : hour % 12;
    final ampm = hour < 12 ? 'AM' : 'PM';
    final minutePad = minute.toString().padLeft(2, '0');
    final timeStr = '$hourNum:$minutePad $ampm';

    if (dow == '1-5') {
      return 'Weekdays at $timeStr';
    }

    if (dow == '*') {
      if (dom == '*') {
        return 'Daily at $timeStr';
      } else {
        final suffix = _daySuffix(dom);
        return 'Monthly on the $dom$suffix at $timeStr';
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
      return 'Weekly on ${days[dow]} at $timeStr';
    }

    return 'Runs on schedule: $cron';
  }

  String _daySuffix(String dayStr) {
    final day = int.tryParse(dayStr);
    if (day == null) return '';
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
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
      'dsa_question' => 'A daily practice DSA coding problem with examples and hints',
      'content_extractor' => 'A set of content creation ideas with tapable draft post generation',
      'portfolio_watch' => 'A custom stock portfolio tracker layout',
      _ => 'A detailed summary report',
    };
  }

  @override
  Widget build(BuildContext context) {
    final permissions = _parsedIntent?['permissions_needed'] is List
        ? List<String>.from(_parsedIntent?['permissions_needed'])
        : const <String>[];

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
                onPressed: _creating ? null : () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_rounded, size: 18, color: SydneyColors.ink),
              ),
            ),
          ),
        ),
        titleSpacing: 12,
        title: Text(
          'Confirm',
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
                      SydneySpacing.md,
                      SydneySpacing.page,
                      140,
                    ),
                    children: [
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
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.bold,
                                  ),
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
                        icon: Icons.output_rounded,
                        title: 'Output layout',
                        child: Text(
                          _describeOutput(_parsedIntent),
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: SydneyColors.onSurfaceVariant,
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
      bottomNavigationBar: SydneyFooter(
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _creating ? null : () => Navigator.of(context).maybePop(),
                style: OutlinedButton.styleFrom(
                  foregroundColor: SydneyColors.ink,
                  side: const BorderSide(color: SydneyColors.line),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  minimumSize: const Size.fromHeight(48),
                ),
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(width: SydneySpacing.md),
            Expanded(
              child: FilledButton(
                onPressed: _creating ? null : _createAgent,
                style: FilledButton.styleFrom(
                  backgroundColor: SydneyColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  minimumSize: const Size.fromHeight(48),
                ),
                child: _creating
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Create Agent'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _createAgent() async {
    setState(() => _creating = true);
    try {
      await ref.read(agentsProvider.notifier).createAgent(
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
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
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
    return Container(
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
          Row(
            children: [
              Icon(icon, color: SydneyColors.primary, size: 16),
              const SizedBox(width: SydneySpacing.sm),
              Text(
                title.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: SydneyColors.primary,
                      fontWeight: FontWeight.bold,
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

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

  @override
  Widget build(BuildContext context) {
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
        child: ListView(
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
                    _agentName(widget.draft),
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
            const _InfoCard(
              icon: Icons.assignment_outlined,
              title: 'What it does',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Bullet('Reviews recent calendar events'),
                  _Bullet('Extracts key discussion points'),
                  _Bullet('Drafts a structured agenda for upcoming meetings'),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.md),
            _InfoCard(
              icon: Icons.schedule_rounded,
              title: 'When it runs',
              child: Text(
                widget.draft.responseTiming == 'daily'
                    ? 'A consolidated digest each day'
                    : 'Whenever you message it',
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
              child: Wrap(
                spacing: SydneySpacing.sm,
                runSpacing: SydneySpacing.sm,
                children: [
                  for (final tool in widget.draft.connectedTools)
                    _AccessPill(icon: _toolIcon(tool), label: '$tool Access'),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.md),
            const _InfoCard(
              icon: Icons.send_rounded,
              title: 'What it sends',
              child: Text(
                'A draft agenda and summary message',
                style: TextStyle(
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

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Icon(Icons.circle, size: 4, color: SydneyColors.mutedInk),
          ),
          const SizedBox(width: SydneySpacing.sm),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.onSurfaceVariant,
                height: 1.35,
              ),
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

IconData _toolIcon(String tool) {
  if (tool.toLowerCase().contains('calendar')) {
    return Icons.calendar_month_outlined;
  }
  if (tool.toLowerCase().contains('gmail')) {
    return Icons.mail_outline_rounded;
  }
  return Icons.description_outlined;
}

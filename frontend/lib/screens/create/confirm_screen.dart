import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/agents_provider.dart';
import '../../services/agent_service.dart';
import '../../widgets/surface_card.dart';
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
          onPressed: _creating ? null : () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        centerTitle: true,
        title: const Text('Confirm'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
        actions: [
          IconButton(
            tooltip: 'More',
            onPressed: () {},
            icon: const Icon(Icons.more_horiz_rounded),
          ),
          const SizedBox(width: SydneySpacing.sm),
        ],
      ),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.lg,
            SydneySpacing.page,
            SydneySpacing.actionFooterHeight + SydneySpacing.lg,
          ),
          children: [
            SurfaceCard(
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: const BoxDecoration(
                      color: SydneyColors.primarySoft,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'S',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: SydneyColors.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: SydneySpacing.sm),
                  Text('Sydney', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: SydneySpacing.sm),
                  Text(
                    '"${widget.draft.prompt}"',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: SydneyColors.mutedInk,
                      fontStyle: FontStyle.italic,
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
                'Whenever you message it',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: SydneyColors.onSurfaceVariant,
                ),
              ),
            ),
            const SizedBox(height: SydneySpacing.md),
            const _InfoCard(
              icon: Icons.vpn_key_outlined,
              title: 'What it needs',
              child: Wrap(
                spacing: SydneySpacing.sm,
                runSpacing: SydneySpacing.sm,
                children: [
                  _AccessPill(
                    icon: Icons.calendar_month_outlined,
                    label: 'Calendar Access',
                  ),
                  _AccessPill(
                    icon: Icons.description_outlined,
                    label: 'Notes Access',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.md,
            SydneySpacing.page,
            SydneySpacing.lg,
          ),
          decoration: const BoxDecoration(
            color: SydneyColors.surface,
            border: Border(top: BorderSide(color: SydneyColors.line)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FilledButton(
                onPressed: _creating ? null : _create,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(50),
                  backgroundColor: SydneyColors.primary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SydneyRadius.full),
                  ),
                ),
                child: Text(_creating ? 'Creating...' : 'Create agent'),
              ),
              const SizedBox(height: SydneySpacing.sm),
              OutlinedButton(
                onPressed: _creating ? null : () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(50),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SydneyRadius.full),
                  ),
                ),
                child: const Text('Edit sentence'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _create() async {
    setState(() => _creating = true);
    final navigator = Navigator.of(context);
    try {
      final agent = await ref
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
      await navigator.pushNamed(AppRoutes.thread, arguments: agent);
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
    return SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: SydneyColors.primary, size: 18),
              const SizedBox(width: SydneySpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: SydneyColors.ink,
                    letterSpacing: 0,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.md),
          Padding(
            padding: const EdgeInsets.only(left: SydneySpacing.xl),
            child: child,
          ),
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
      padding: const EdgeInsets.only(bottom: SydneySpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 4,
            height: 4,
            margin: const EdgeInsets.only(top: 8, right: SydneySpacing.sm),
            decoration: const BoxDecoration(
              color: SydneyColors.onSurfaceVariant,
              shape: BoxShape.circle,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: SydneyColors.onSurfaceVariant,
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
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.md,
        vertical: SydneySpacing.sm,
      ),
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainer,
        borderRadius: BorderRadius.circular(SydneyRadius.full),
        border: Border.all(color: SydneyColors.line),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: SydneyColors.primary, size: 16),
          const SizedBox(width: SydneySpacing.xs),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.onSurfaceVariant,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

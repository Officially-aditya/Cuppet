import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../../providers/agents_provider.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/inbox/agent_list_item.dart';

class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agents = ref.watch(agentsProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Menu',
          onPressed: () {},
          icon: const Icon(Icons.menu_rounded),
        ),
        title: const Text('Inbox'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
        actions: [
          IconButton(
            tooltip: 'Connectors',
            onPressed:
                () => Navigator.of(context).pushNamed(AppRoutes.connectors),
            icon: const Icon(Icons.hub_outlined),
          ),
          IconButton(
            tooltip: 'Settings',
            onPressed:
                () => Navigator.of(context).pushNamed(AppRoutes.settings),
            icon: const Icon(Icons.settings_outlined),
          ),
          const SizedBox(width: SydneySpacing.sm),
        ],
      ),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: SydneyColors.primary,
          onRefresh: () => ref.read(agentsProvider.notifier).refresh(),
          child: agents.when(
            data: (items) => _InboxList(agents: items),
            loading: () => const _InboxLoading(),
            error:
                (error, _) => _InboxError(
                  message: error.toString(),
                  onRetry: () => ref.read(agentsProvider.notifier).refresh(),
                ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).pushNamed(AppRoutes.create),
        icon: const Icon(Icons.add_rounded),
        label: const Text('New'),
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: 0,
        onSelected: (index) => _handleNav(context, ref, index),
      ),
    );
  }

  void _handleNav(BuildContext context, WidgetRef ref, int index) {
    if (index == 0) {
      return;
    }
    if (index == 1) {
      final agents = ref.read(agentsProvider).asData?.value ?? const <Agent>[];
      final scout = agents.firstWhere(
        (agent) => agent.threadId == 'thread_research',
        orElse: _researchFallback,
      );
      Navigator.of(context).pushNamed(AppRoutes.thread, arguments: scout);
      return;
    }
    if (index == 2) {
      Navigator.of(context).pushNamed(AppRoutes.connectors);
      return;
    }
    Navigator.of(context).pushNamed(AppRoutes.settings);
  }
}

class _InboxList extends StatelessWidget {
  const _InboxList({required this.agents});

  final List<Agent> agents;

  @override
  Widget build(BuildContext context) {
    final visibleAgents = agents.isEmpty ? [_assistantFallback()] : agents;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        SydneySpacing.lg,
        SydneySpacing.page,
        118,
      ),
      children: [
        const _SystemPill(),
        const SizedBox(height: SydneySpacing.lg),
        for (final agent in visibleAgents) ...[
          AgentListItem(
            agent: agent,
            onTap:
                () => Navigator.of(
                  context,
                ).pushNamed(AppRoutes.thread, arguments: agent),
          ),
          const SizedBox(height: SydneySpacing.md),
        ],
      ],
    );
  }
}

class _SystemPill extends StatelessWidget {
  const _SystemPill();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: SydneySpacing.lg,
          vertical: SydneySpacing.sm,
        ),
        decoration: BoxDecoration(
          color: SydneyColors.systemBubble,
          borderRadius: BorderRadius.circular(SydneyRadius.full),
        ),
        child: Text(
          'Assistant is pinned so you always have a place to start.',
          textAlign: TextAlign.center,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: SydneyColors.onSurfaceVariant),
        ),
      ),
    );
  }
}

class _InboxLoading extends StatelessWidget {
  const _InboxLoading();

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        SydneySpacing.lg,
        SydneySpacing.page,
        118,
      ),
      itemCount: 4,
      separatorBuilder: (_, _) => const SizedBox(height: SydneySpacing.md),
      itemBuilder: (context, index) {
        return Container(
          height: index == 0 ? 34 : 82,
          decoration: BoxDecoration(
            color:
                index == 0
                    ? SydneyColors.systemBubble
                    : SydneyColors.surfaceRaised,
            borderRadius: BorderRadius.circular(
              index == 0 ? SydneyRadius.full : SydneyRadius.sm,
            ),
            border: index == 0 ? null : Border.all(color: SydneyColors.line),
          ),
        );
      },
    );
  }
}

class _InboxError extends StatelessWidget {
  const _InboxError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(SydneySpacing.page),
      children: [
        Text(
          'Messages could not load',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: SydneySpacing.sm),
        Text(
          message,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: SydneyColors.mutedInk),
        ),
        const SizedBox(height: SydneySpacing.lg),
        FilledButton(onPressed: onRetry, child: const Text('Try again')),
      ],
    );
  }
}

Agent _assistantFallback() {
  return Agent(
    id: 'assistant',
    threadId: 'thread_assistant',
    name: 'Assistant',
    avatarInitials: 'S',
    description: 'Your home base for delegation.',
    lastMessagePreview: 'I can help you turn a sentence into a useful agent.',
    latestMessageAt: DateTime.now(),
    isAssistant: true,
    isPinned: true,
  );
}

Agent _researchFallback() {
  return Agent(
    id: 'agent_research',
    threadId: 'thread_research',
    name: 'Research Scout',
    avatarInitials: 'RS',
    description: 'Collects weekly market notes.',
    lastMessagePreview: 'I summarized the latest category shifts.',
    latestMessageAt: DateTime.now(),
    accentColor: 0xFF356C91,
  );
}

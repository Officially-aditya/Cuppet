import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../../providers/agents_provider.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/inbox/agent_list_item.dart';
import '../../widgets/sydney_primitives.dart';

class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agents = ref.watch(agentsProvider);

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: SydneyColors.surface,
        title: Text(
          'Sydney',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 20),
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
        actions: [
          IconButton(
            tooltip: 'Connectors',
            onPressed:
                () => Navigator.of(context).pushNamed(AppRoutes.connectors),
            icon: const Icon(Icons.public_rounded),
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
                (error, _) => SydneyErrorState(
                  title: 'Messages could not load',
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
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.md),
        ),
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
      Navigator.of(context).pushNamed(AppRoutes.connectors);
      return;
    }
    if (index == 2) {
      final agents = ref.read(agentsProvider).asData?.value ?? const <Agent>[];
      final scout = agents.firstWhere(
        (agent) => agent.threadId == 'thread_research',
        orElse: _researchFallback,
      );
      Navigator.of(context).pushNamed(AppRoutes.thread, arguments: scout);
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
        const SydneyNotice(
          text: 'Assistant is pinned so you always have a place to start.',
        ),
        const SizedBox(height: SydneySpacing.lg),
        for (final agent in visibleAgents) ...[
          AgentListItem(
            agent: agent,
            onTap:
                () => Navigator.of(
                  context,
                ).pushNamed(AppRoutes.thread, arguments: agent),
          ),
          const SizedBox(height: 10),
        ],
        const SizedBox(height: SydneySpacing.xl),
        const _StartSentencePrompt(),
      ],
    );
  }
}

class _StartSentencePrompt extends StatelessWidget {
  const _StartSentencePrompt();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: SydneySpacing.lg),
      child: Column(
        children: [
          Text(
            'Start with one sentence',
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontSize: 14),
          ),
          const SizedBox(height: SydneySpacing.xs),
          SizedBox(
            width: 280,
            child: Text(
              'Create an agent for something you want watched, summarized, or prepared.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.mutedInk,
                height: 1.35,
              ),
            ),
          ),
        ],
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
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        if (index == 0) {
          return const SydneyLoadingBlock(height: 44, radius: SydneyRadius.md);
        }
        return const SydneyLoadingBlock(height: 78, radius: SydneyRadius.md);
      },
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
    lastMessagePreview:
        'I can help you turn a sentence into a useful micro-agent.',
    latestMessageAt: DateTime.now(),
    isAssistant: true,
    isPinned: true,
    accentColor: 0xFF1D7A5C,
  );
}

Agent _researchFallback() {
  return Agent(
    id: 'research-scout',
    threadId: 'thread_research',
    name: 'Research Scout',
    avatarInitials: 'RS',
    description: 'Collects weekly market notes.',
    lastMessagePreview: 'I summarized the latest category shifts.',
    latestMessageAt: DateTime.now().subtract(const Duration(days: 1)),
    accentColor: 0xFF1E40AF,
  );
}

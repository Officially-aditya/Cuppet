import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../../providers/agents_provider.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/inbox/agent_list_item.dart';
import '../../widgets/sydney_primitives.dart';

class InboxScreen extends ConsumerStatefulWidget {
  const InboxScreen({super.key});

  @override
  ConsumerState<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends ConsumerState<InboxScreen> {
  bool _isExpanded = true;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() => _isExpanded = false);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final agents = ref.watch(agentsProvider);

    return Scaffold(
      backgroundColor: SydneyColors.surface,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: SydneyColors.surface.withValues(alpha: 0.95),
        scrolledUnderElevation: 0,
        elevation: 0,
        titleSpacing: SydneySpacing.page,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Cuppet',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: SydneyColors.ink,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              'Your delegation agents',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: SydneyColors.subtleInk,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: SydneyColors.primary,
          onRefresh: () => ref.read(agentsProvider.notifier).refresh(),
          child: agents.when(
            data: (items) => _InboxList(agents: items),
            loading: () => const _InboxLoading(),
            error: (error, _) => SydneyErrorState(
              title: 'Messages could not load',
              message: error.toString(),
              onRetry: () => ref.read(agentsProvider.notifier).refresh(),
            ),
          ),
        ),
      ),
      floatingActionButton: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        width: _isExpanded ? 132 : 48,
        height: 48,
        decoration: BoxDecoration(
          color: SydneyColors.primary,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: SydneyColors.primary.withValues(alpha: 0.25),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.15),
            width: 1,
          ),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(24),
            onTap: () => Navigator.of(context).pushNamed(AppRoutes.create),
            child: Center(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const NeverScrollableScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.add_rounded, color: Colors.white, size: 20),
                      if (_isExpanded) ...[
                        const SizedBox(width: 8),
                        const Text(
                          'New Agent',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            fontSize: 13,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: 0,
        onSelected: (index) => navigateToMainDestination(
          context,
          currentIndex: 0,
          selectedIndex: index,
        ),
      ),
    );
  }
}


class _InboxList extends StatelessWidget {
  const _InboxList({required this.agents});

  final List<Agent> agents;

  @override
  Widget build(BuildContext context) {
    final visibleAgents = agents.isEmpty ? [_assistantFallback()] : agents;
    final hasCreatedAgent = agents.any((agent) => !agent.isAssistant);

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        SydneySpacing.md,
        SydneySpacing.page,
        118,
      ),
      children: [
        if (!hasCreatedAgent) ...[
          const SydneyNotice(
            text: 'Assistant is pinned so you always have a place to start.',
          ),
          const SizedBox(height: SydneySpacing.md),
        ],
        for (final agent in visibleAgents) ...[
          AgentListItem(
            agent: agent,
            onTap: () => Navigator.of(context).pushNamed(AppRoutes.thread, arguments: agent),
          ),
          const SizedBox(height: 6),
        ],
        if (!hasCreatedAgent) ...[
          const SizedBox(height: SydneySpacing.xl),
          const _StartSentencePrompt(),
        ],
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
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontSize: 14),
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
      separatorBuilder: (_, _) => const SizedBox(height: 12),
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
    lastMessagePreview: 'I can help you turn a sentence into a useful micro-agent.',
    latestMessageAt: DateTime.now(),
    isAssistant: true,
    isPinned: true,
    accentColor: 0xFF1D7A5C,
  );
}

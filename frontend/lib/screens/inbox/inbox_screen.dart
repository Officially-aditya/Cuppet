import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../../models/message.dart';
import '../../models/thread_launch_request.dart';
import '../../providers/agents_provider.dart';
import '../../providers/messages_provider.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/inbox/agent_list_item.dart';
import '../../widgets/sydney_primitives.dart';
import '../../widgets/templates/briefing_card_template.dart';

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
    final briefings = ref.watch(briefingsProvider);

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
          onRefresh: () async {
            ref.invalidate(briefingsProvider);
            await ref.read(agentsProvider.notifier).refresh();
          },
          child: agents.when(
            data:
                (items) => _InboxList(
                  agents: items,
                  briefings: briefings.value ?? const [],
                  onOpenBriefing: _openBriefing,
                ),
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
                      const Icon(
                        Icons.add_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
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
        onSelected:
            (index) => navigateToMainDestination(
              context,
              currentIndex: 0,
              selectedIndex: index,
            ),
      ),
    );
  }

  Future<void> _openBriefing(Message briefing) async {
    try {
      final assistantId = await ref
          .read(messageServiceProvider)
          .handoffToAssistant(
            agentId: briefing.threadId,
            messageId: briefing.id,
          );
      ref.invalidate(briefingsProvider);
      ref.invalidate(agentsProvider);
      final agents = await ref.read(agentServiceProvider).listAgents();
      final assistant = agents.firstWhere((agent) => agent.id == assistantId);
      ref.invalidate(messagesProvider(assistant.threadId));
      if (!mounted) return;
      await Navigator.of(
        context,
      ).pushNamed(AppRoutes.thread, arguments: assistant);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }
}

class _InboxList extends StatelessWidget {
  const _InboxList({
    required this.agents,
    required this.briefings,
    required this.onOpenBriefing,
  });

  final List<Agent> agents;
  final List<Message> briefings;
  final ValueChanged<Message> onOpenBriefing;

  @override
  Widget build(BuildContext context) {
    final visibleAgents = agents.isEmpty ? [_assistantFallback()] : agents;
    final hasCreatedAgent = agents.any((agent) => !agent.isAssistant);
    Agent? assistant;
    for (final agent in agents) {
      if (agent.isAssistant) {
        assistant = agent;
        break;
      }
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        SydneySpacing.md,
        SydneySpacing.page,
        118,
      ),
      children: [
        if (briefings.isNotEmpty) ...[
          Row(
            children: [
              Text(
                'BRIEFINGS',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: SydneyColors.mutedInk,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.1,
                ),
              ),
              const Spacer(),
              Text(
                'Tap to explore with Assistant',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: SydneyColors.subtleInk,
                  fontSize: 10,
                ),
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.sm),
          for (final briefing in briefings) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(SydneySpacing.md),
              decoration: BoxDecoration(
                color: SydneyColors.agentBubble,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: SydneyColors.line),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0A000000),
                    blurRadius: 8,
                    offset: Offset(0, 3),
                  ),
                ],
              ),
              child: BriefingCardTemplate(
                data: briefing.data,
                compact: true,
                onOpen: () => onOpenBriefing(briefing),
              ),
            ),
            const SizedBox(height: SydneySpacing.md),
          ],
          const SizedBox(height: SydneySpacing.sm),
        ],
        if (!hasCreatedAgent && assistant != null) ...[
          _OnboardingSuggestions(assistant: assistant),
          const SizedBox(height: SydneySpacing.md),
        ],
        if (!hasCreatedAgent) ...[
          const SydneyNotice(
            text: 'Assistant is pinned so you always have a place to start.',
          ),
          const SizedBox(height: SydneySpacing.md),
        ],
        for (final agent in visibleAgents) ...[
          AgentListItem(
            agent: agent,
            onTap:
                () => Navigator.of(
                  context,
                ).pushNamed(AppRoutes.thread, arguments: agent),
          ),
          const SizedBox(height: 6),
        ],
      ],
    );
  }
}

class _OnboardingSuggestions extends StatelessWidget {
  const _OnboardingSuggestions({required this.assistant});

  final Agent assistant;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'TRY CUPPET',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: SydneyColors.mutedInk,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: SydneySpacing.sm),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (
              var index = 0;
              index < _onboardingSuggestions.length;
              index++
            ) ...[
              Expanded(
                child: AspectRatio(
                  aspectRatio: 1,
                  child: _OnboardingSuggestionCard(
                    suggestion: _onboardingSuggestions[index],
                    onTap:
                        () => Navigator.of(context).pushNamed(
                          AppRoutes.thread,
                          arguments: ThreadLaunchRequest(
                            agent: assistant,
                            initialMessage:
                                _onboardingSuggestions[index].prompt,
                          ),
                        ),
                  ),
                ),
              ),
              if (index != _onboardingSuggestions.length - 1)
                const SizedBox(width: SydneySpacing.sm),
            ],
          ],
        ),
      ],
    );
  }
}

class _OnboardingSuggestionCard extends StatelessWidget {
  const _OnboardingSuggestionCard({
    required this.suggestion,
    required this.onTap,
  });

  final _OnboardingSuggestion suggestion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: SydneyColors.agentBubble,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        key: ValueKey('onboarding_${suggestion.id}'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(SydneySpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: SydneyColors.line),
            boxShadow: const [
              BoxShadow(
                color: Color(0x08000000),
                blurRadius: 5,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: SydneyColors.primarySoft,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      suggestion.icon,
                      size: 17,
                      color: SydneyColors.primary,
                    ),
                  ),
                  const Spacer(),
                  const Icon(
                    Icons.arrow_forward_rounded,
                    size: 17,
                    color: SydneyColors.primary,
                  ),
                ],
              ),
              const SizedBox(height: SydneySpacing.sm),
              Text(
                suggestion.question,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: SydneyColors.ink,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                suggestion.answer,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: SydneyColors.mutedInk,
                  fontSize: 11,
                  height: 1.25,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OnboardingSuggestion {
  const _OnboardingSuggestion({
    required this.id,
    required this.icon,
    required this.question,
    required this.answer,
    required this.prompt,
  });

  final String id;
  final IconData icon;
  final String question;
  final String answer;
  final String prompt;
}

const _onboardingSuggestions = [
  _OnboardingSuggestion(
    id: 'daily_news',
    icon: Icons.newspaper_outlined,
    question: 'Want AI to deliver news every morning?',
    answer: 'Cuppet can create a daily technology briefing for you.',
    prompt:
        'Create an agent that delivers a concise technology news briefing every day at 8 AM.',
  ),
  _OnboardingSuggestion(
    id: 'daily_coding',
    icon: Icons.code_rounded,
    question: 'Want to sharpen your coding skills daily?',
    answer: 'Cuppet can prepare one practice problem every evening.',
    prompt:
        'Create an agent that gives me one DSA coding question every day at 7 PM.',
  ),
];

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
    lastMessagePreview:
        'I can help you turn a sentence into a useful micro-agent.',
    latestMessageAt: DateTime.now(),
    isAssistant: true,
    isPinned: true,
    accentColor: 0xFF1D7A5C,
  );
}

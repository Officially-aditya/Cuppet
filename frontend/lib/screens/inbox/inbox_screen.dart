import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../../models/message.dart';
import '../../models/thread_launch_request.dart';
import '../../providers/agents_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/messages_provider.dart';
import '../../providers/personalization_provider.dart';
import '../../services/api.dart';
import '../../widgets/inbox/agent_list_item.dart';
import '../../widgets/sydney_primitives.dart';
import '../../widgets/templates/briefing_card_template.dart';
import '../../widgets/workspace_primitives.dart';

class InboxScreen extends ConsumerStatefulWidget {
  const InboxScreen({super.key});

  @override
  ConsumerState<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends ConsumerState<InboxScreen> {
  bool _isExpanded = true;
  Timer? _timer;
  String? _personalizationPromptForUser;

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
    final dismissedIds = ref.watch(dismissedBriefingIdsProvider);
    final visibleBriefings = (briefings.value ?? const <Message>[])
        .where(
          (briefing) => !dismissedIds.contains(_briefingMessageKey(briefing)),
        )
        .toList(growable: false);

    final authState = ref.watch(authControllerProvider);
    final user = authState.asData?.value.user;
    final defaultDisplayName = user?.displayName ?? '';
    final preferredName = ref.watch(preferredNameProvider);
    final displayName =
        preferredName.isNotEmpty ? preferredName : defaultDisplayName;

    final loadedAgents = agents.value;
    if (user != null && loadedAgents != null) {
      final hasCreatedAgent = loadedAgents.any((agent) => !agent.isAssistant);
      final hasAssistant = loadedAgents.any((agent) => agent.isAssistant);
      if (!hasCreatedAgent && hasAssistant) {
        _schedulePersonalizationPrompt(user.id);
      }
    }

    final String eyebrowText;
    if (displayName.isEmpty || displayName == 'Cuppet User') {
      eyebrowText = 'Your workspace';
    } else {
      final displayNameParts = displayName.trim().split(RegExp(r'\s+'));
      final firstName =
          displayNameParts.isNotEmpty && displayNameParts.first.isNotEmpty
              ? displayNameParts.first
              : '';
      if (firstName.isEmpty) {
        eyebrowText = 'Your workspace';
      } else {
        final capitalizedFirstName =
            '${firstName[0].toUpperCase()}${firstName.substring(1)}';
        eyebrowText = "$capitalizedFirstName's Workspace";
      }
    }

    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: WorkspaceAppBar(
        eyebrow: eyebrowText,
        title: 'Cuppet',
        subtitle: 'Your delegation agents',
        showBrandMark: true,
      ),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: CuppetWorkspaceColors.primary,
          backgroundColor: CuppetWorkspaceColors.card,
          onRefresh: () async {
            ref.invalidate(briefingsProvider);
            await ref.read(agentsProvider.notifier).refresh();
          },
          child: agents.when(
            skipLoadingOnRefresh: true,
            skipLoadingOnReload: true,
            data:
                (items) => _InboxList(
                  agents: items,
                  briefings: visibleBriefings,
                  onOpenBriefing: _openBriefing,
                ),
            loading: () => const SizedBox.expand(),
            error:
                (error, _) => SydneyErrorState(
                  title: 'Messages could not load',
                  message: friendlyErrorMessage(
                    error,
                    fallback: 'Your inbox couldn’t be loaded right now.',
                  ),
                  onRetry: () => ref.read(agentsProvider.notifier).refresh(),
                ),
          ),
        ),
      ),
      floatingActionButton: Semantics(
        button: true,
        label: 'Create new agent',
        child: Tooltip(
          message: 'Create new agent',
          child: AnimatedContainer(
            key: const ValueKey('create_agent_fab'),
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            width: _isExpanded ? 132 : 48,
            height: 48,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: CuppetWorkspaceColors.primary,
              borderRadius: BorderRadius.circular(SydneyRadius.full),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(SydneyRadius.full),
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
                            color: CuppetWorkspaceColors.card,
                            size: 20,
                          ),
                          if (_isExpanded) ...[
                            const SizedBox(width: SydneySpacing.sm),
                            const Text(
                              'New Agent',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: CuppetWorkspaceColors.card,
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
        ),
      ),
    );
  }

  void _schedulePersonalizationPrompt(String userId) {
    if (_personalizationPromptForUser == userId) return;
    _personalizationPromptForUser = userId;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_showPersonalizationPrompt(userId));
    });
  }

  Future<void> _showPersonalizationPrompt(String userId) async {
    final storage = ref.read(secureStorageProvider);
    final storageKey = 'sydney.personalization_onboarding_prompted.$userId';
    if (await storage.read(key: storageKey) == 'true' || !mounted) return;

    final service = ref.read(personalizationServiceProvider);
    try {
      final profile = await service.loadProfile();
      if (!mounted) return;
      final hasSuggestionConsent =
          profile.consents
              .where(
                (item) =>
                    item.isGranted &&
                    (item.purpose == 'cuppet_activity' ||
                        item.purpose == 'explicit_feedback'),
              )
              .length ==
          2;
      if (profile.settings.enabled || hasSuggestionConsent) {
        await storage.write(key: storageKey, value: 'true');
        return;
      }
    } catch (_) {
      // Do not block onboarding when personalization status cannot be loaded.
      _personalizationPromptForUser = null;
      return;
    }

    final allow = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => const _PersonalizationOnboardingDialog(),
    );
    if (!mounted || allow == null) return;

    if (!allow) {
      await storage.write(key: storageKey, value: 'true');
      return;
    }

    try {
      final profile = await service.loadProfile();
      await service.grantConsent('cuppet_activity', source: 'onboarding');
      await service.grantConsent('explicit_feedback', source: 'onboarding');
      await service.updateSettings(
        profile.settings.copyWith(enabled: true, inChat: true),
      );
      await storage.write(key: storageKey, value: 'true');
      ref.invalidate(personalizationProvider);
    } catch (error) {
      _personalizationPromptForUser = null;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            friendlyErrorMessage(
              error,
              fallback: 'Personalized suggestions could not be enabled.',
            ),
          ),
        ),
      );
    }
  }

  Future<void> _openBriefing(Message briefing) async {
    final messageKey = _briefingMessageKey(briefing);
    final dismissed = ref.read(dismissedBriefingIdsProvider);
    if (dismissed.contains(messageKey)) return;

    // Optimistic hide survives tab switches while this handoff is in flight.
    final dismisser = ref.read(dismissedBriefingIdsProvider.notifier);
    dismisser.dismiss(messageKey);
    var handoffCompleted = false;

    try {
      final assistantId = await ref
          .read(messageServiceProvider)
          .handoffToAssistant(
            agentId: briefing.threadId,
            messageId: briefing.id,
          );
      handoffCompleted = true;
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
      final canRetryHandoff =
          !handoffCompleted &&
          error is ApiException &&
          error.statusCode != null &&
          error.retryable;
      if (canRetryHandoff) {
        dismisser.restore(messageKey);
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            friendlyErrorMessage(
              error,
              fallback: 'That briefing couldn’t be opened right now.',
            ),
          ),
        ),
      );
    }
  }
}

class _PersonalizationOnboardingDialog extends StatelessWidget {
  const _PersonalizationOnboardingDialog();

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      key: const ValueKey('personalization-onboarding-dialog'),
      title: const Text('Make suggestions more useful'),
      content: const SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'With your permission, Cuppet can learn from repeated Assistant activity and feedback you give it. It can then suggest useful automations and follow-ups.',
            ),
            SizedBox(height: SydneySpacing.md),
            WorkspacePrivacyPanel(
              title: 'You stay in control',
              message:
                  'This enables in-chat suggestions using Cuppet activity and direct feedback. Connected accounts, browser activity, proactive suggestions, and push notifications stay off until you enable them later in Settings.',
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          key: const ValueKey('personalization-onboarding-not-now'),
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Not now'),
        ),
        FilledButton(
          key: const ValueKey('personalization-onboarding-allow'),
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Allow suggestions'),
        ),
      ],
    );
  }
}

String _briefingMessageKey(Message briefing) {
  if (briefing.id.isNotEmpty) return 'msg:${briefing.id}';
  return 'msg:${briefing.threadId}:${briefing.createdAt.toIso8601String()}';
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
          WorkspaceSectionLabel(
            'Briefings',
            trailing: Text(
              'Tap to explore with Assistant',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: CuppetWorkspaceColors.muted,
                fontSize: 10,
              ),
            ),
          ),
          const SizedBox(height: SydneySpacing.sm),
          for (final briefing in briefings) ...[
            WorkspaceCard(
              key: ValueKey('home_briefing_${briefing.id}'),
              padding: const EdgeInsets.all(SydneySpacing.md),
              onTap: () => onOpenBriefing(briefing),
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
          const WorkspaceCard(
            padding: EdgeInsets.symmetric(
              horizontal: SydneySpacing.lg,
              vertical: SydneySpacing.md,
            ),
            color: CuppetWorkspaceColors.softSage,
            borderColor: CuppetWorkspaceColors.panelBorder,
            child: Row(
              children: [
                Icon(
                  Icons.push_pin_outlined,
                  color: CuppetWorkspaceColors.primaryInk,
                  size: 16,
                ),
                SizedBox(width: SydneySpacing.sm),
                Expanded(
                  child: Text(
                    'Assistant is pinned so you always have a place to start.',
                    style: TextStyle(
                      color: CuppetWorkspaceColors.muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
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
        const WorkspaceSectionLabel('Try Cuppet'),
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
    return WorkspaceCard(
      key: ValueKey('onboarding_${suggestion.id}'),
      onTap: onTap,
      padding: const EdgeInsets.all(SydneySpacing.md),
      radius: SydneyRadius.md,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: CuppetWorkspaceColors.softSage,
                  borderRadius: BorderRadius.circular(SydneyRadius.sm),
                  border: Border.all(color: CuppetWorkspaceColors.panelBorder),
                ),
                child: Icon(
                  suggestion.icon,
                  size: 17,
                  color: CuppetWorkspaceColors.primaryInk,
                ),
              ),
              const Spacer(),
              const Icon(
                Icons.arrow_forward_rounded,
                size: 17,
                color: CuppetWorkspaceColors.primaryInk,
              ),
            ],
          ),
          const SizedBox(height: SydneySpacing.sm),
          Text(
            suggestion.question,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: CuppetWorkspaceColors.ink,
              fontWeight: FontWeight.w800,
              fontSize: 13,
              height: 1.2,
            ),
          ),
          const SizedBox(height: SydneySpacing.xs),
          Text(
            suggestion.answer,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: CuppetWorkspaceColors.muted,
              fontSize: 11,
              height: 1.25,
            ),
          ),
        ],
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
    accentColor: 0xFF006046,
  );
}

import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../cuppet_logo.dart';
import '../workspace_primitives.dart';

class AgentListItem extends StatelessWidget {
  const AgentListItem({required this.agent, required this.onTap, super.key});

  final Agent agent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final active = agent.availability == AgentAvailability.thinking;

    return WorkspaceCard(
      key: ValueKey('agent_${agent.id}'),
      onTap: onTap,
      padding: const EdgeInsets.all(SydneySpacing.lg),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _AgentAvatar(agent: agent),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        agent.name,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: CuppetWorkspaceColors.ink,
                        ),
                      ),
                    ),
                    if (agent.isPinned) ...[
                      const SizedBox(width: SydneySpacing.sm),
                      const Icon(
                        Icons.push_pin_outlined,
                        color: CuppetWorkspaceColors.muted,
                        size: 14,
                      ),
                    ],
                    const SizedBox(width: SydneySpacing.sm),
                    Text(
                      _formatTimestamp(agent),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontSize: 10.5,
                        color: CuppetWorkspaceColors.muted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SydneySpacing.xs),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        agent.lastMessagePreview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color:
                              agent.hasUnread
                                  ? CuppetWorkspaceColors.ink
                                  : CuppetWorkspaceColors.muted,
                          fontWeight:
                              agent.hasUnread
                                  ? FontWeight.w700
                                  : FontWeight.w400,
                          height: 1.35,
                        ),
                      ),
                    ),
                    if (active || agent.hasUnread) ...[
                      const SizedBox(width: SydneySpacing.sm),
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: CuppetWorkspaceColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AgentAvatar extends StatelessWidget {
  const _AgentAvatar({required this.agent});

  final Agent agent;

  @override
  Widget build(BuildContext context) {
    if (agent.isAssistant) {
      return CuppetAssistantAvatar(
        key: ValueKey('assistant-avatar-${agent.id}'),
        size: 44,
      );
    }

    final paletteIndex = _agentAvatarPaletteIndex(agent.id);
    final background =
        CuppetWorkspaceColors.agentAvatarBackgrounds[paletteIndex];
    final foreground =
        CuppetWorkspaceColors.agentAvatarForegrounds[paletteIndex];

    return Container(
      key: ValueKey('agent-avatar-${agent.id}'),
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(color: background),
      ),
      alignment: Alignment.center,
      child: Text(
        agent.avatarInitials,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: foreground,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

int _agentAvatarPaletteIndex(String agentId) {
  var total = 0;
  for (final codeUnit in agentId.codeUnits) {
    total += codeUnit;
  }
  return total % CuppetWorkspaceColors.agentAvatarBackgrounds.length;
}

String _formatTimestamp(Agent agent) {
  if (agent.isAssistant) {
    return 'Pinned';
  }

  final now = DateTime.now();
  final local = agent.latestMessageAt.toLocal();
  final sameDay =
      now.year == local.year &&
      now.month == local.month &&
      now.day == local.day;
  if (sameDay) {
    final hour =
        local.hour == 0
            ? 12
            : local.hour > 12
            ? local.hour - 12
            : local.hour;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }

  final yesterday = now.subtract(const Duration(days: 1));
  if (yesterday.year == local.year &&
      yesterday.month == local.month &&
      yesterday.day == local.day) {
    return 'Yesterday';
  }

  return '${local.month}/${local.day}';
}

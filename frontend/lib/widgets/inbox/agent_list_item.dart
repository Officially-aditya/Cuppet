import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../sydney_primitives.dart';

class AgentListItem extends StatelessWidget {
  const AgentListItem({required this.agent, required this.onTap, super.key});

  final Agent agent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = Color(agent.accentColor);
    final active = agent.availability == AgentAvailability.thinking;

    return SydneyPanel(
      onTap: onTap,
      padding: const EdgeInsets.all(SydneySpacing.lg),
      child: Stack(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _AgentAvatar(agent: agent, accent: accent),
              const SizedBox(width: 14),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(right: 30),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Expanded(
                            child: Text(
                              agent.name,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(
                                context,
                              ).textTheme.titleSmall?.copyWith(fontSize: 14),
                            ),
                          ),
                          const SizedBox(width: SydneySpacing.sm),
                          Text(
                            _formatTimestamp(agent),
                            style: Theme.of(
                              context,
                            ).textTheme.bodySmall?.copyWith(
                              fontSize: 11,
                              color: SydneyColors.mutedInk,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: SydneySpacing.xs),
                      Text(
                        agent.lastMessagePreview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: SydneyColors.onSurfaceVariant,
                          fontWeight:
                              agent.hasUnread
                                  ? FontWeight.w700
                                  : FontWeight.w400,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          Positioned(
            right: 0,
            top: 0,
            bottom: 0,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (agent.isPinned)
                  const Icon(
                    Icons.push_pin_rounded,
                    color: SydneyColors.outline,
                    size: 16,
                  ),
                if (active || agent.hasUnread) ...[
                  if (agent.isPinned) const SizedBox(width: SydneySpacing.sm),
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: SydneyColors.primary,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: SydneyColors.primarySoft.withValues(alpha: 1),
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AgentAvatar extends StatelessWidget {
  const _AgentAvatar({required this.agent, required this.accent});

  final Agent agent;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final background =
        agent.isAssistant ? SydneyColors.primaryContainer : accent;
    final foreground =
        agent.isAssistant ? SydneyColors.onPrimaryContainer : Colors.white;

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
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

String _formatTimestamp(Agent agent) {
  if (agent.isAssistant) {
    return 'Permanent';
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

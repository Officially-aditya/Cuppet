import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/agent.dart';

class AgentListItem extends StatelessWidget {
  const AgentListItem({required this.agent, required this.onTap, super.key});

  final Agent agent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = Color(agent.accentColor);
    final active = agent.availability == AgentAvailability.thinking;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          // Neumorphic dark shadow (bottom-right)
          BoxShadow(
            color: const Color(0xFF17201C).withValues(alpha: 0.05),
            offset: const Offset(4, 4),
            blurRadius: 8,
          ),
          // Neumorphic light shadow (top-left)
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
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Stack(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _AgentAvatar(agent: agent, accent: accent),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 32),
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
                                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800,
                                      color: SydneyColors.ink,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: SydneySpacing.sm),
                                Text(
                                  _formatTimestamp(agent),
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    fontSize: 10.5,
                                    color: SydneyColors.subtleInk,
                                    fontWeight: FontWeight.w500,
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
                                color: agent.hasUnread
                                    ? SydneyColors.ink
                                    : SydneyColors.onSurfaceVariant,
                                fontWeight: agent.hasUnread
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
                          color: SydneyColors.subtleInk,
                          size: 14,
                        ),
                      if (active || agent.hasUnread) ...[
                        if (agent.isPinned) const SizedBox(width: SydneySpacing.sm),
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: SydneyColors.primary,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: SydneyColors.primary.withValues(alpha: 0.15),
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
          ),
        ),
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
    final background = agent.isAssistant ? SydneyColors.primaryContainer : accent;
    final foreground = agent.isAssistant ? SydneyColors.onPrimaryContainer : Colors.white;

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: background,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: background.withValues(alpha: 0.12),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
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
    return 'Pinned';
  }

  final now = DateTime.now();
  final local = agent.latestMessageAt.toLocal();
  final sameDay =
      now.year == local.year && now.month == local.month && now.day == local.day;
  if (sameDay) {
    final hour = local.hour == 0
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

import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/agent.dart';
import 'unread_badge.dart';

class AgentTile extends StatelessWidget {
  const AgentTile({required this.agent, required this.onTap, super.key});

  final Agent agent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = Color(agent.accentColor);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: SydneySpacing.md),
          child: Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: accent.withValues(alpha: 0.12),
                child: Text(
                  agent.avatarInitials,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(color: accent),
                ),
              ),
              const SizedBox(width: SydneySpacing.md),
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
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        const SizedBox(width: SydneySpacing.sm),
                        Text(
                          _formatTimestamp(agent.latestMessageAt),
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(
                            color:
                                agent.hasUnread
                                    ? SydneyColors.primary
                                    : SydneyColors.subtleInk,
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
                            style: Theme.of(
                              context,
                            ).textTheme.bodyMedium?.copyWith(
                              color:
                                  agent.hasUnread
                                      ? SydneyColors.ink
                                      : SydneyColors.mutedInk,
                              fontWeight:
                                  agent.hasUnread
                                      ? FontWeight.w600
                                      : FontWeight.w400,
                            ),
                          ),
                        ),
                        const SizedBox(width: SydneySpacing.sm),
                        UnreadBadge(count: agent.unreadCount),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _formatTimestamp(DateTime value) {
  final now = DateTime.now();
  final local = value.toLocal();
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

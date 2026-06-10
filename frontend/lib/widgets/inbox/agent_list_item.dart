import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../models/agent.dart';
import '../surface_card.dart';

class AgentListItem extends StatelessWidget {
  const AgentListItem({required this.agent, required this.onTap, super.key});

  final Agent agent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = Color(agent.accentColor);
    return SurfaceCard(
      onTap: onTap,
      padding: const EdgeInsets.all(SydneySpacing.lg),
      child: Stack(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: accent,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  agent.avatarInitials,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: SydneySpacing.lg),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    right: agent.isPinned ? SydneySpacing.xl : 0,
                  ),
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
                          if (agent.hasUnread)
                            Container(
                              width: 11,
                              height: 11,
                              margin: const EdgeInsets.only(
                                left: SydneySpacing.sm,
                              ),
                              decoration: const BoxDecoration(
                                color: SydneyColors.primary,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: SydneySpacing.xs),
                      Text(
                        agent.lastMessagePreview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color:
                              agent.hasUnread
                                  ? SydneyColors.ink
                                  : SydneyColors.onSurfaceVariant,
                          fontWeight:
                              agent.hasUnread
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: SydneySpacing.xxs),
                      Text(
                        agent.description,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: SydneyColors.mutedInk,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (agent.isPinned)
            const Positioned(
              top: 0,
              right: 0,
              child: Icon(
                Icons.push_pin_rounded,
                color: SydneyColors.primaryDark,
                size: 17,
              ),
            ),
        ],
      ),
    );
  }
}

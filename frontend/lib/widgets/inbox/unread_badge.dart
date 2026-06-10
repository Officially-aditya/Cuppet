import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class UnreadBadge extends StatelessWidget {
  const UnreadBadge({required this.count, super.key});

  final int count;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) {
      return const SizedBox.shrink();
    }
    final label = count > 99 ? '99+' : count.toString();
    return Container(
      constraints: const BoxConstraints(minWidth: 22, minHeight: 22),
      padding: const EdgeInsets.symmetric(horizontal: SydneySpacing.xs),
      decoration: BoxDecoration(
        color: SydneyColors.primary,
        borderRadius: BorderRadius.circular(SydneyRadius.full),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelMedium?.copyWith(color: Colors.white, fontSize: 11),
      ),
    );
  }
}

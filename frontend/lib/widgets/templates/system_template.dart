import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class SystemTemplate extends StatelessWidget {
  const SystemTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final text =
        data['text']?.toString() ??
        data['message']?.toString() ??
        'System update';
    return Text(
      text,
      textAlign: TextAlign.left,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: SydneyColors.onSurfaceVariant,
        fontWeight: FontWeight.w500,
        fontSize: 11,
      ),
    );
  }
}

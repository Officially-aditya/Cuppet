import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class PlainTextTemplate extends StatelessWidget {
  const PlainTextTemplate({required this.data, this.textColor, super.key});

  final Map<String, dynamic> data;
  final Color? textColor;

  @override
  Widget build(BuildContext context) {
    final text =
        data['text']?.toString() ??
        data['body']?.toString() ??
        'No message content was provided.';
    return Text(
      text,
      style: Theme.of(
        context,
      ).textTheme.bodyMedium?.copyWith(color: textColor ?? SydneyColors.ink),
    );
  }
}

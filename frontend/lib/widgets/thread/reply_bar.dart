import 'package:flutter/material.dart';

import '../../design/tokens.dart';

class ReplyBar extends StatefulWidget {
  const ReplyBar({required this.onSend, super.key});

  final Future<void> Function(String text) onSend;

  @override
  State<ReplyBar> createState() => _ReplyBarState();
}

class _ReplyBarState extends State<ReplyBar> {
  final _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: SydneyColors.surfaceContainerLowest,
        border: Border(top: BorderSide(color: SydneyColors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(SydneySpacing.lg),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: SydneyColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(SydneyRadius.md),
                  border: Border.all(color: SydneyColors.line),
                ),
                child: TextField(
                  controller: _controller,
                  minLines: 1,
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    hintText: 'Message agent',
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: SydneySpacing.lg,
                      vertical: 14,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: SydneySpacing.md),
            SizedBox(
              width: 48,
              height: 48,
              child: FilledButton(
                onPressed: _sending ? null : _send,
                style: FilledButton.styleFrom(
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(SydneyRadius.md),
                  ),
                ),
                child: Icon(
                  _sending ? Icons.more_horiz_rounded : Icons.send_rounded,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty) {
      return;
    }
    setState(() => _sending = true);
    try {
      await widget.onSend(text);
      _controller.clear();
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }
}

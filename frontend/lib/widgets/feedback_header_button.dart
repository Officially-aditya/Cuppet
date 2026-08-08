import 'dart:ui';

import 'package:flutter/material.dart';

import '../design/tokens.dart';

/// A compact translucent action that keeps the inbox header feeling light.
class FeedbackHeaderButton extends StatelessWidget {
  const FeedbackHeaderButton({required this.onPressed, super.key});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(SydneyRadius.full);

    return Semantics(
      button: true,
      label: 'Open feedback',
      child: Tooltip(
        message: 'Share feedback',
        child: ClipRRect(
          borderRadius: borderRadius,
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xD9FFFFFF), Color(0xA6E4F3EC)],
                ),
                borderRadius: borderRadius,
                border: Border.all(color: const Color(0x806B9B84)),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x141C1A17),
                    blurRadius: 12,
                    offset: Offset(0, 4),
                  ),
                  BoxShadow(
                    color: Color(0x66FFFFFF),
                    blurRadius: 2,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onPressed,
                  borderRadius: borderRadius,
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                    child: Text(
                      'Feedback',
                      style: TextStyle(
                        color: CuppetWorkspaceColors.primaryInk,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.1,
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
}

import 'package:flutter/material.dart';

/// Palette sampled from the workspace setup reference.
///
/// These colors are intentionally scoped to the three main destinations so
/// message threads and report templates retain their established treatment.
class CuppetWorkspaceColors {
  const CuppetWorkspaceColors._();

  static const background = Color(0xFFF5F3EE);
  static const card = Color(0xFFFCFBFA);

  /// Soft green wash for chips, selected pills, and quiet surfaces.
  static const softSage = Color(0xFFE4F3EC);

  /// Global brand green - matches [SydneyColors.primary].
  static const primary = Color(0xFF006046);

  /// Secondary green for supporting accents.
  static const secondary = Color(0xFF3F7D57);

  /// Alias for secondary (legacy name used in workspace widgets).
  static const sage = secondary;

  /// Dark green ink for icons/text on soft green fills.
  static const primaryInk = Color(0xFF004D39);

  /// Full-color logo gradients used for distinct agent avatar treatments.
  static const agentAvatarGradients = <List<Color>>[
    [Color(0xFFFF9A7F), Color(0xFFC94F66)],
    [Color(0xFF5D579D), Color(0xFF29264F)],
    [Color(0xFF0B625B), Color(0xFF2BA898)],
    [Color(0xFFF4C66D), Color(0xFFDB8833)],
  ];

  /// Foreground colors with sufficient contrast for each logo gradient.
  static const agentAvatarForegrounds = <Color>[
    Color(0xFF17201C),
    Color(0xFFF5F3EE),
    Color(0xFFF5F3EE),
    Color(0xFF17201C),
  ];

  static const ink = Color(0xFF1C1A17);
  static const muted = Color(0xFF706E6A);
  static const border = Color(0xFFEAE9E8);
  static const panelBorder = Color(0xFFD4D9D2);
}

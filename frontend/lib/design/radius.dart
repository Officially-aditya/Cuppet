import 'package:flutter/material.dart';

class SydneyRadius {
  const SydneyRadius._();

  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 28;
  static const double full = 999;

  static const BorderRadius card = BorderRadius.all(Radius.circular(sm));

  static const BorderRadius bubbleAgent = BorderRadius.only(
    topLeft: Radius.circular(lg),
    topRight: Radius.circular(lg),
    bottomLeft: Radius.circular(xs),
    bottomRight: Radius.circular(lg),
  );

  static const BorderRadius bubbleUser = BorderRadius.only(
    topLeft: Radius.circular(lg),
    topRight: Radius.circular(lg),
    bottomLeft: Radius.circular(lg),
    bottomRight: Radius.circular(xs),
  );
}

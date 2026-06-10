import 'package:flutter/material.dart';

import 'colors.dart';
import 'radius.dart';
import 'spacing.dart';
import 'typography.dart';

class SydneyTheme {
  const SydneyTheme._();

  static ThemeData get light {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: SydneyColors.primary,
      brightness: Brightness.light,
      primary: SydneyColors.primary,
      onPrimary: SydneyColors.onPrimary,
      surface: SydneyColors.surface,
      onSurface: SydneyColors.onSurface,
      error: SydneyColors.danger,
    );

    return ThemeData(
      useMaterial3: true,
      fontFamily: SydneyTypography.fontFamily,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: SydneyColors.surface,
      textTheme: SydneyTypography.textTheme,
      dividerColor: SydneyColors.line,
      visualDensity: VisualDensity.standard,
      appBarTheme: const AppBarTheme(
        backgroundColor: SydneyColors.surface,
        foregroundColor: SydneyColors.ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        toolbarHeight: SydneySpacing.appBarHeight,
        titleTextStyle: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: SydneyColors.ink,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: SydneyColors.surfaceContainerLowest,
        hintStyle: SydneyTypography.textTheme.bodyMedium?.copyWith(
          color: SydneyColors.subtleInk,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.md),
          borderSide: const BorderSide(color: SydneyColors.line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.md),
          borderSide: const BorderSide(color: SydneyColors.line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.md),
          borderSide: const BorderSide(color: SydneyColors.primary, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.md),
          borderSide: const BorderSide(color: SydneyColors.danger),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: SydneySpacing.lg,
          vertical: SydneySpacing.md,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: SydneyColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SydneyRadius.md),
          ),
          textStyle: SydneyTypography.textTheme.labelLarge,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: SydneyColors.primary,
          side: const BorderSide(color: SydneyColors.primary),
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SydneyRadius.md),
          ),
          textStyle: SydneyTypography.textTheme.labelLarge,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: SydneyColors.primary,
          textStyle: SydneyTypography.textTheme.labelLarge,
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: SydneyColors.primary,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(SydneyRadius.full),
          ),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: SydneyColors.primary,
        foregroundColor: Colors.white,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.md),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: SydneyColors.surfaceContainerLowest,
        selectedColor: SydneyColors.primarySoft,
        disabledColor: SydneyColors.surfaceContainer,
        labelStyle: SydneyTypography.textTheme.bodySmall,
        secondaryLabelStyle: SydneyTypography.textTheme.bodySmall?.copyWith(
          color: SydneyColors.primary,
        ),
        side: const BorderSide(color: SydneyColors.line),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.sm),
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected)
              ? Colors.white
              : SydneyColors.surfaceRaised;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          return states.contains(WidgetState.selected)
              ? SydneyColors.primary
              : SydneyColors.surfaceContainerHighest;
        }),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: SydneyColors.ink,
        contentTextStyle: SydneyTypography.textTheme.bodyMedium?.copyWith(
          color: Colors.white,
        ),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(SydneyRadius.sm),
        ),
      ),
    );
  }
}

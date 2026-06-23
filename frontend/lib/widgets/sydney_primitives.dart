import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:url_launcher/url_launcher.dart';

import '../design/tokens.dart';

class SydneyPanel extends StatelessWidget {
  const SydneyPanel({
    required this.child,
    this.padding = const EdgeInsets.all(SydneySpacing.lg),
    this.color = SydneyColors.surfaceContainerLowest,
    this.borderColor = SydneyColors.line,
    this.radius = SydneyRadius.md,
    this.onTap,
    this.shadow = true,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color color;
  final Color borderColor;
  final double radius;
  final VoidCallback? onTap;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(radius);
    final decorated = AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: borderRadius,
        border: Border.all(color: borderColor),
        boxShadow:
            shadow
                ? const [
                  BoxShadow(
                    color: Color(0x08000000),
                    blurRadius: 6,
                    offset: Offset(0, 2),
                  ),
                ]
                : null,
      ),
      child: child,
    );

    if (onTap == null) {
      return decorated;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: borderRadius,
        onTap: onTap,
        child: decorated,
      ),
    );
  }
}

class SydneyNotice extends StatelessWidget {
  const SydneyNotice({
    required this.text,
    this.icon = Icons.info_outline_rounded,
    this.iconColor = SydneyColors.primary,
    this.backgroundColor = SydneyColors.surfaceContainerLow,
    this.borderColor = SydneyColors.line,
    this.textColor = SydneyColors.onSurfaceVariant,
    super.key,
  });

  final String text;
  final IconData icon;
  final Color iconColor;
  final Color backgroundColor;
  final Color borderColor;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.lg,
        vertical: SydneySpacing.md,
      ),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: iconColor),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: textColor,
                fontWeight: FontWeight.w500,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class SydneySectionLabel extends StatelessWidget {
  const SydneySectionLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: SydneySpacing.xs, bottom: 6),
      child: Text(
        text.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          fontSize: 9,
          color: SydneyColors.mutedInk,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class SydneyIconBadge extends StatelessWidget {
  const SydneyIconBadge({
    required this.child,
    this.size = 40,
    this.color = SydneyColors.primarySoft,
    this.foregroundColor = SydneyColors.primary,
    this.radius = SydneyRadius.md,
    this.borderColor,
    super.key,
  });

  final Widget child;
  final double size;
  final Color color;
  final Color foregroundColor;
  final double radius;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return IconTheme.merge(
      data: IconThemeData(color: foregroundColor),
      child: DefaultTextStyle.merge(
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: foregroundColor,
          fontWeight: FontWeight.w800,
        ),
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(radius),
            border:
                borderColor == null ? null : Border.all(color: borderColor!),
          ),
          alignment: Alignment.center,
          child: child,
        ),
      ),
    );
  }
}

class SydneyFooter extends StatelessWidget {
  const SydneyFooter({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.all(SydneySpacing.lg),
        decoration: const BoxDecoration(
          color: SydneyColors.surfaceContainerLowest,
          border: Border(top: BorderSide(color: SydneyColors.line)),
        ),
        child: child,
      ),
    );
  }
}

class SydneyEmptyState extends StatelessWidget {
  const SydneyEmptyState({
    required this.title,
    required this.message,
    this.icon = Icons.inbox_outlined,
    super.key,
  });

  final String title;
  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SydneySpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SydneyIconBadge(
              size: 48,
              color: SydneyColors.surfaceContainerLow,
              foregroundColor: SydneyColors.primary,
              borderColor: SydneyColors.line,
              child: Icon(icon, size: 24),
            ),
            const SizedBox(height: SydneySpacing.md),
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: SydneySpacing.xs),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
            ),
          ],
        ),
      ),
    );
  }
}

class SydneyErrorState extends StatelessWidget {
  const SydneyErrorState({
    required this.title,
    required this.message,
    required this.onRetry,
    super.key,
  });

  final String title;
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(SydneySpacing.page),
      children: [
        SydneyPanel(
          borderColor: SydneyColors.dangerSoft,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: SydneySpacing.sm),
              Text(
                message,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
              ),
              const SizedBox(height: SydneySpacing.lg),
              FilledButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ),
        ),
      ],
    );
  }
}

class SydneyLoadingBlock extends StatelessWidget {
  const SydneyLoadingBlock({
    this.height = 72,
    this.radius = SydneyRadius.md,
    this.width,
    super.key,
  });

  final double height;
  final double radius;
  final double? width;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: SydneyColors.line),
      ),
    );
  }
}

class MarkdownText extends StatefulWidget {
  const MarkdownText({
    required this.text,
    this.style,
    this.textColor,
    this.bold = false,
    super.key,
  });

  final String text;
  final TextStyle? style;
  final Color? textColor;
  final bool bold;

  @override
  State<MarkdownText> createState() => _MarkdownTextState();
}

class _MarkdownTextState extends State<MarkdownText> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();

    final baseStyle = widget.style ?? Theme.of(context).textTheme.bodyMedium;
    final color =
        widget.textColor ?? baseStyle?.color ?? SydneyColors.onSurface;

    return Text.rich(_parseMarkdown(widget.text, context, color, baseStyle));
  }

  TextSpan _parseMarkdown(
    String value,
    BuildContext context,
    Color defaultColor,
    TextStyle? baseStyle,
  ) {
    final children = <InlineSpan>[];
    final lines = value.split('\n');

    for (var i = 0; i < lines.length; i++) {
      final rawLine = lines[i];
      final trimmed = rawLine.trim();

      // Check for headings
      final headingMatch = RegExp(r'^(#{1,6})\s+(.+)$').firstMatch(trimmed);
      if (headingMatch != null) {
        final level = headingMatch.group(1)!.length;
        final headingText = headingMatch.group(2)!;

        // Heading size multiplier
        double sizeScale = 1.0;
        switch (level) {
          case 1:
            sizeScale = 1.35;
            break;
          case 2:
            sizeScale = 1.25;
            break;
          case 3:
            sizeScale = 1.15;
            break;
          case 4:
          default:
            sizeScale = 1.08;
            break;
        }

        final headingStyle = (baseStyle ?? Theme.of(context).textTheme.bodyMedium)?.copyWith(
          fontWeight: FontWeight.w800,
          fontSize: baseStyle?.fontSize != null ? baseStyle!.fontSize! * sizeScale : null,
          color: SydneyColors.onSurface,
        );

        children.add(
          TextSpan(
            children: _parseLineSegments(headingText, defaultColor, headingStyle),
          ),
        );
      } else {
        children.addAll(
          _parseLineSegments(rawLine, defaultColor, baseStyle),
        );
      }

      if (i < lines.length - 1) {
        children.add(const TextSpan(text: '\n'));
      }
    }

    return TextSpan(children: children);
  }

  List<InlineSpan> _parseLineSegments(
    String line,
    Color defaultColor,
    TextStyle? baseStyle,
  ) {
    final spans = <InlineSpan>[];
    final pattern = RegExp(
      r'\[([^\]]+)\]\(([^)]+)\)|(https?://[^\s]+)',
      caseSensitive: false,
    );

    var cursor = 0;

    for (final match in pattern.allMatches(line)) {
      if (match.start > cursor) {
        spans.addAll(
          _parseInlineFormatting(
            line.substring(cursor, match.start),
            defaultColor,
            baseStyle,
          ),
        );
      }

      if (match.group(1) != null && match.group(2) != null) {
        final title = match.group(1)!;
        final url = match.group(2)!;
        final tapRecognizer =
            TapGestureRecognizer()
              ..onTap = () async {
                final uri = Uri.tryParse(url);
                if (uri != null && await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              };
        _recognizers.add(tapRecognizer);

        spans.add(
          TextSpan(
            text: title,
            style: baseStyle?.copyWith(
              color: SydneyColors.primary,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.underline,
            ),
            recognizer: tapRecognizer,
          ),
        );
      } else if (match.group(3) != null) {
        final url = match.group(3)!;
        final tapRecognizer =
            TapGestureRecognizer()
              ..onTap = () async {
                final uri = Uri.tryParse(url);
                if (uri != null && await canLaunchUrl(uri)) {
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                }
              };
        _recognizers.add(tapRecognizer);

        spans.add(
          TextSpan(
            text: url,
            style: baseStyle?.copyWith(
              color: SydneyColors.primary,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.underline,
            ),
            recognizer: tapRecognizer,
          ),
        );
      }

      cursor = match.end;
    }

    if (cursor < line.length) {
      spans.addAll(
        _parseInlineFormatting(
          line.substring(cursor),
          defaultColor,
          baseStyle,
        ),
      );
    }

    return spans;
  }

  List<InlineSpan> _parseInlineFormatting(
    String value,
    Color defaultColor,
    TextStyle? baseStyle,
  ) {
    final spans = <InlineSpan>[];
    final buffer = StringBuffer();
    var bold = false;
    var italic = false;

    void flush() {
      if (buffer.isEmpty) return;
      spans.add(
        TextSpan(
          text: buffer.toString(),
          style: baseStyle?.copyWith(
            color: defaultColor,
            fontWeight:
                bold || widget.bold ? FontWeight.w800 : baseStyle.fontWeight,
            fontStyle: italic ? FontStyle.italic : baseStyle.fontStyle,
          ),
        ),
      );
      buffer.clear();
    }

    var index = 0;
    while (index < value.length) {
      if (value.startsWith('**', index)) {
        final hasClosingMarker = value.indexOf('**', index + 2) != -1;
        if (!bold && !hasClosingMarker) {
          if (buffer.isNotEmpty &&
              !_endsWithWhitespace(buffer.toString()) &&
              index > 0 &&
              value[index - 1].trim().isEmpty) {
            buffer.write(' ');
          }
          index += 2;
          continue;
        }
        flush();
        bold = !bold;
        index += 2;
        continue;
      }

      if (value[index] == '*') {
        final hasClosingMarker = value.indexOf('*', index + 1) != -1;
        if (!italic && !hasClosingMarker) {
          if (buffer.isNotEmpty &&
              !_endsWithWhitespace(buffer.toString()) &&
              index > 0 &&
              value[index - 1].trim().isEmpty) {
            buffer.write(' ');
          }
          index += 1;
          continue;
        }
        flush();
        italic = !italic;
        index += 1;
        continue;
      }

      buffer.write(value[index]);
      index += 1;
    }

    flush();
    return spans;
  }

  bool _endsWithWhitespace(String value) {
    return value.isNotEmpty && value.codeUnitAt(value.length - 1) <= 32;
  }
}

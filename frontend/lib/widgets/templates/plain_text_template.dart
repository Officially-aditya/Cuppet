import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';

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
    final blocks = _parseBlocks(text);
    final color = textColor ?? SydneyColors.ink;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var index = 0; index < blocks.length; index++) ...[
          _PlainTextBlockView(block: blocks[index], textColor: color),
          if (index < blocks.length - 1)
            SizedBox(height: blocks[index].spacingAfter),
        ],
      ],
    );
  }
}

enum _PlainTextBlockType { heading, paragraph, bullet, numbered, image }

class _PlainTextBlock {
  const _PlainTextBlock({required this.type, required this.text, this.number});

  final _PlainTextBlockType type;
  final String text;
  final String? number;

  double get spacingAfter {
    return switch (type) {
      _PlainTextBlockType.heading => SydneySpacing.sm,
      _PlainTextBlockType.paragraph => SydneySpacing.md,
      _PlainTextBlockType.bullet ||
      _PlainTextBlockType.numbered => SydneySpacing.sm,
      _PlainTextBlockType.image => SydneySpacing.md,
    };
  }
}

class _PlainTextBlockView extends StatelessWidget {
  const _PlainTextBlockView({required this.block, required this.textColor});

  final _PlainTextBlock block;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return switch (block.type) {
      _PlainTextBlockType.heading => MarkdownText(
        text: block.text,
        textColor: textColor,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(height: 1.25),
        bold: true,
      ),
      _PlainTextBlockType.paragraph => MarkdownText(
        text: block.text,
        textColor: textColor,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.38),
      ),
      _PlainTextBlockType.bullet => _IndentedLine(
        marker: '•',
        text: block.text,
        textColor: textColor,
      ),
      _PlainTextBlockType.numbered => _IndentedLine(
        marker: '${block.number ?? '1'}.',
        text: block.text,
        textColor: textColor,
      ),
      _PlainTextBlockType.image => Padding(
        padding: const EdgeInsets.symmetric(vertical: SydneySpacing.sm),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(SydneyRadius.md),
          child: Image.network(
            block.text,
            fit: BoxFit.cover,
            loadingBuilder: (context, child, loadingProgress) {
              if (loadingProgress == null) return child;
              return Container(
                height: 180,
                color: SydneyColors.surfaceContainerLow,
                alignment: Alignment.center,
                child: const CircularProgressIndicator(),
              );
            },
            errorBuilder: (context, error, stackTrace) {
              return Container(
                height: 100,
                color: SydneyColors.surfaceContainerLow,
                alignment: Alignment.center,
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.broken_image_outlined, color: SydneyColors.mutedInk),
                    SizedBox(width: 8),
                    Text('Failed to load image', style: TextStyle(color: SydneyColors.mutedInk)),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    };
  }
}

class _IndentedLine extends StatelessWidget {
  const _IndentedLine({
    required this.marker,
    required this.text,
    required this.textColor,
  });

  final String marker;
  final String text;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: marker == '•' ? 14 : 24,
          child: Text(
            marker,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: SydneyColors.primary,
              fontWeight: FontWeight.w800,
              height: 1.35,
            ),
          ),
        ),
        Expanded(
          child: MarkdownText(
            text: text,
            textColor: textColor,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.35),
          ),
        ),
      ],
    );
  }
}

List<_PlainTextBlock> _parseBlocks(String value) {
  final blocks = <_PlainTextBlock>[];
  final paragraphLines = <String>[];

  void flushParagraph() {
    if (paragraphLines.isEmpty) return;
    blocks.add(
      _PlainTextBlock(
        type: _PlainTextBlockType.paragraph,
        text: paragraphLines.join(' ').trim(),
      ),
    );
    paragraphLines.clear();
  }

  for (final rawLine in value.split('\n')) {
    final trimmed = rawLine.trim();
    if (trimmed.isEmpty) {
      flushParagraph();
      continue;
    }

    final image = RegExp(r'^!\[([^\]]*)\]\(([^)]+)\)$').firstMatch(trimmed);
    if (image != null) {
      flushParagraph();
      blocks.add(
        _PlainTextBlock(
          type: _PlainTextBlockType.image,
          text: image.group(2) ?? '',
        ),
      );
      continue;
    }

    final heading = _headingText(trimmed);
    if (heading != null) {
      flushParagraph();
      blocks.add(
        _PlainTextBlock(type: _PlainTextBlockType.heading, text: heading),
      );
      continue;
    }

    final bullet = RegExp(r'^[•*\-]\s+(.+)$').firstMatch(trimmed);
    if (bullet != null) {
      flushParagraph();
      blocks.add(
        _PlainTextBlock(
          type: _PlainTextBlockType.bullet,
          text: _cleanInline(bullet.group(1) ?? ''),
        ),
      );
      continue;
    }

    final numbered = RegExp(r'^(\d{1,2})[.)]\s+(.+)$').firstMatch(trimmed);
    if (numbered != null) {
      flushParagraph();
      blocks.add(
        _PlainTextBlock(
          type: _PlainTextBlockType.numbered,
          number: numbered.group(1),
          text: _cleanInline(numbered.group(2) ?? ''),
        ),
      );
      continue;
    }

    paragraphLines.add(_cleanInline(trimmed));
  }

  flushParagraph();
  return blocks.isEmpty
      ? [_PlainTextBlock(type: _PlainTextBlockType.paragraph, text: value)]
      : blocks;
}

String? _headingText(String value) {
  final markdown = RegExp(r'^#{1,6}\s+(.+)$').firstMatch(value);
  if (markdown != null) return _cleanInline(markdown.group(1) ?? '');

  final boldOnly = RegExp(r'^\*\*([^*]+)\*\*:?\s*$').firstMatch(value);
  if (boldOnly != null) return _cleanInline(boldOnly.group(1) ?? '');

  final clean = _cleanInline(value);
  if (clean.endsWith(':') && clean.length <= 70) {
    return clean.substring(0, clean.length - 1);
  }

  return null;
}



String _cleanInline(String value) {
  return value
      .replaceFirst(RegExp(r'^#{1,6}\s*'), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';
import '../../models/attachment.dart';

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
    final sections = _groupIntoSections(blocks);
    final attachments = (data['attachments'] is List
            ? data['attachments'] as List
            : const <dynamic>[])
        .whereType<Map>()
        .map(
          (item) => MessageAttachment.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var index = 0; index < sections.length; index++) ...[
          if (sections[index].heading == null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < sections[index].blocks.length; i++) ...[
                  _PlainTextBlockView(
                    block: sections[index].blocks[i],
                    textColor: color,
                  ),
                  if (i < sections[index].blocks.length - 1)
                    SizedBox(height: sections[index].blocks[i].spacingAfter),
                ],
              ],
            )
          else
            _SectionCard(section: sections[index], textColor: color),
          if (index < sections.length - 1 && sections[index].heading == null)
            const SizedBox(height: SydneySpacing.md),
        ],
        if (attachments.isNotEmpty) ...[
          if (blocks.isNotEmpty) const SizedBox(height: SydneySpacing.md),
          Wrap(
            spacing: SydneySpacing.sm,
            runSpacing: SydneySpacing.sm,
            children: [
              for (final attachment in attachments)
                Container(
                  key: ValueKey('message-attachment-${attachment.id}'),
                  constraints: const BoxConstraints(maxWidth: 240),
                  padding: const EdgeInsets.symmetric(
                    horizontal: SydneySpacing.md,
                    vertical: SydneySpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: SydneyColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(SydneyRadius.md),
                    border: Border.all(color: SydneyColors.outlineVariant),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        attachment.mimeType.startsWith('image/')
                            ? Icons.image_outlined
                            : Icons.description_outlined,
                        size: 17,
                        color: SydneyColors.primary,
                      ),
                      const SizedBox(width: SydneySpacing.sm),
                      Flexible(
                        child: Text(
                          attachment.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.labelMedium,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

enum _PlainTextBlockType { heading, paragraph, bullet, numbered, image, code }

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
      _PlainTextBlockType.code => SydneySpacing.md,
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
      _PlainTextBlockType.code => _CodeBlockView(text: block.text),
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
                    Icon(
                      Icons.broken_image_outlined,
                      color: SydneyColors.mutedInk,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'This image couldn’t be loaded. Please try again.',
                      style: TextStyle(color: SydneyColors.mutedInk),
                    ),
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
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.35),
          ),
        ),
      ],
    );
  }
}

List<_PlainTextBlock> _parseBlocks(String value) {
  final blocks = <_PlainTextBlock>[];
  final paragraphLines = <String>[];
  final codeLines = <String>[];
  var inCodeBlock = false;

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

  void flushCode() {
    if (codeLines.isEmpty) return;
    blocks.add(
      _PlainTextBlock(
        type: _PlainTextBlockType.code,
        text: codeLines.join('\n'),
      ),
    );
    codeLines.clear();
  }

  for (final rawLine in value.split('\n')) {
    final trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        flushParagraph();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.add(rawLine);
      continue;
    }

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
  flushCode();

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

class _CodeBlockView extends StatelessWidget {
  const _CodeBlockView({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: SydneyColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: SydneyColors.line, width: 0.8),
        boxShadow: const [
          BoxShadow(
            color: Color(0x04000000),
            blurRadius: 3,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: SydneySpacing.md,
              vertical: 6,
            ),
            decoration: const BoxDecoration(
              color: SydneyColors.surfaceContainerLow,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(12),
                topRight: Radius.circular(12),
              ),
              border: Border(
                bottom: BorderSide(color: SydneyColors.line, width: 0.8),
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.description_outlined,
                  size: 14,
                  color: SydneyColors.mutedInk,
                ),
                const SizedBox(width: SydneySpacing.xs),
                Text(
                  'DRAFT POST',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: SydneyColors.mutedInk,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
                const Spacer(),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(4),
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: text));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Draft copied to clipboard!'),
                          duration: Duration(seconds: 2),
                        ),
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.copy_rounded,
                            size: 12,
                            color: SydneyColors.primary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Copy',
                            style: Theme.of(
                              context,
                            ).textTheme.labelSmall?.copyWith(
                              color: SydneyColors.primary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(SydneySpacing.md),
            child: SelectionArea(
              child: Text(
                text,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: SydneyColors.ink,
                  fontFamily: 'monospace',
                  height: 1.4,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlainTextSection {
  _PlainTextSection({this.heading, required this.blocks});
  final _PlainTextBlock? heading;
  final List<_PlainTextBlock> blocks;
}

List<_PlainTextSection> _groupIntoSections(List<_PlainTextBlock> blocks) {
  final sections = <_PlainTextSection>[];
  if (blocks.isEmpty) return sections;

  List<_PlainTextBlock>? currentBlocks;

  for (final block in blocks) {
    if (block.type == _PlainTextBlockType.heading) {
      currentBlocks = [];
      sections.add(_PlainTextSection(heading: block, blocks: currentBlocks));
    } else {
      if (currentBlocks == null) {
        currentBlocks = [];
        sections.add(_PlainTextSection(heading: null, blocks: currentBlocks));
      }
      currentBlocks.add(block);
    }
  }
  return sections;
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.section, required this.textColor});

  final _PlainTextSection section;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: SydneySpacing.md),
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: SydneyColors.line.withValues(alpha: 0.8),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF17201C).withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (section.heading != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                horizontal: SydneySpacing.md,
                vertical: 10,
              ),
              decoration: BoxDecoration(
                color: SydneyColors.surfaceContainerLow,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(16),
                  topRight: Radius.circular(16),
                ),
                border: Border(
                  bottom: BorderSide(
                    color: SydneyColors.line.withValues(alpha: 0.8),
                    width: 0.8,
                  ),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.dashboard_customize_outlined,
                    size: 14,
                    color: SydneyColors.primary,
                  ),
                  const SizedBox(width: SydneySpacing.xs),
                  Expanded(
                    child: Text(
                      section.heading!.text.toUpperCase(),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: SydneyColors.primary,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (section.blocks.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(SydneySpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < section.blocks.length; i++) ...[
                    _PlainTextBlockView(
                      block: section.blocks[i],
                      textColor: textColor,
                    ),
                    if (i < section.blocks.length - 1)
                      SizedBox(height: section.blocks[i].spacingAfter),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../sydney_primitives.dart';
import 'digest_report_primitives.dart';
import 'template_utils.dart';

class GmailDigestTemplate extends StatelessWidget {
  const GmailDigestTemplate({required this.data, super.key});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title']?.toString() ?? 'Mailbox highlights';
    final intro = data['text']?.toString();
    final footer = data['footer']?.toString();
    final metrics = templateMaps(data['metrics']);
    final messages = templateMaps(data['messages']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_hasContent(intro)) ...[
          MarkdownText(
            text: intro!,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: SydneyColors.onSurface,
              height: 1.4,
            ),
          ),
          const SizedBox(height: SydneySpacing.md),
        ],
        Row(
          children: [
            const Icon(
              Icons.check_circle_rounded,
              color: SydneyColors.primary,
              size: 17,
            ),
            const SizedBox(width: SydneySpacing.xs),
            Text(
              'GMAIL DIGEST',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: SydneyColors.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
        const SizedBox(height: SydneySpacing.md),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(SydneySpacing.md),
          decoration: BoxDecoration(
            color: SydneyColors.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(SydneyRadius.md),
            border: Border.all(color: SydneyColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title.toUpperCase(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: SydneyColors.onSurface,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.mark_email_unread_outlined,
                    color: SydneyColors.primary,
                    size: 22,
                  ),
                ],
              ),
              if (metrics.isNotEmpty) ...[
                const SizedBox(height: SydneySpacing.md),
                DigestMetricStrip(metrics: metrics),
              ],
              const SizedBox(height: SydneySpacing.md),
              const Divider(height: 1, color: SydneyColors.line),
              const SizedBox(height: SydneySpacing.md),
              if (messages.isEmpty)
                Text(
                  data['summary']?.toString() ??
                      data['message']?.toString() ??
                      'There’s nothing to show for this update.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.onSurfaceVariant,
                    height: 1.35,
                  ),
                )
              else
                for (var index = 0; index < messages.length; index++)
                  _GmailMessageItem(
                    message: messages[index],
                    isLast: index == messages.length - 1,
                  ),
              if (_hasContent(footer)) ...[
                const SizedBox(height: SydneySpacing.sm),
                const Divider(height: 1, color: SydneyColors.line),
                const SizedBox(height: SydneySpacing.sm),
                Text(
                  footer!,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: SydneyColors.mutedInk,
                    height: 1.3,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _GmailMessageItem extends StatefulWidget {
  const _GmailMessageItem({required this.message, required this.isLast});

  final Map<String, dynamic> message;
  final bool isLast;

  @override
  State<_GmailMessageItem> createState() => _GmailMessageItemState();
}

class _GmailMessageItemState extends State<_GmailMessageItem> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final message = widget.message;
    final id = message['id']?.toString() ?? message['subject']?.toString();
    final subject = message['subject']?.toString() ?? 'Gmail message';
    final sender = message['sender']?.toString() ?? 'Unknown sender';
    final preview = message['preview']?.toString();
    final timestamp = _gmailTimestamp(message['timestamp']);
    final category = _categoryLabel(message['category']);
    final canExpand = _hasContent(preview);

    return InkWell(
      key: ValueKey('gmail-message-$id'),
      onTap:
          canExpand
              ? () => setState(() {
                _expanded = !_expanded;
              })
              : null,
      borderRadius: BorderRadius.circular(SydneyRadius.sm),
      child: Padding(
        padding: const EdgeInsets.only(bottom: SydneySpacing.sm),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                width: 22,
                child: Column(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        color: SydneyColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                    if (!widget.isLast)
                      Expanded(
                        child: Container(
                          width: 2,
                          color: SydneyColors.primarySoft,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: SydneySpacing.sm),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: SydneySpacing.sm),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: SydneySpacing.xs,
                        runSpacing: SydneySpacing.xs,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (_hasContent(timestamp))
                            Text(
                              timestamp!,
                              style: Theme.of(
                                context,
                              ).textTheme.labelSmall?.copyWith(
                                color: SydneyColors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: SydneySpacing.xs,
                              vertical: SydneySpacing.xxs,
                            ),
                            decoration: BoxDecoration(
                              color: SydneyColors.surfaceContainerHigh,
                              borderRadius: BorderRadius.circular(
                                SydneyRadius.full,
                              ),
                            ),
                            child: Text(
                              category.toUpperCase(),
                              style: Theme.of(
                                context,
                              ).textTheme.labelSmall?.copyWith(
                                color: SydneyColors.onSurfaceVariant,
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: SydneySpacing.xs),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  subject,
                                  maxLines: _expanded ? null : 2,
                                  overflow:
                                      _expanded
                                          ? TextOverflow.visible
                                          : TextOverflow.ellipsis,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.bodySmall?.copyWith(
                                    color: SydneyColors.onSurface,
                                    fontWeight: FontWeight.w700,
                                    height: 1.3,
                                  ),
                                ),
                                const SizedBox(height: SydneySpacing.xxs),
                                Text(
                                  sender,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.labelSmall?.copyWith(
                                    color: SydneyColors.mutedInk,
                                    height: 1.25,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (canExpand)
                            AnimatedRotation(
                              turns: _expanded ? 0.5 : 0,
                              duration: const Duration(milliseconds: 160),
                              child: const Padding(
                                padding: EdgeInsets.only(
                                  left: SydneySpacing.xs,
                                ),
                                child: Icon(
                                  Icons.expand_more_rounded,
                                  color: SydneyColors.mutedInk,
                                  size: 17,
                                ),
                              ),
                            ),
                        ],
                      ),
                      if (_expanded && canExpand) ...[
                        const SizedBox(height: SydneySpacing.sm),
                        Text(
                          preview!,
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(
                            color: SydneyColors.onSurfaceVariant,
                            height: 1.35,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

bool _hasContent(String? value) => value != null && value.trim().isNotEmpty;

String _categoryLabel(Object? value) {
  return switch (value?.toString()) {
    'attention' => 'Attention',
    'reply' => 'Reply',
    'finance' => 'Finance',
    'system' => 'System',
    _ => 'Update',
  };
}

String? _gmailTimestamp(Object? raw) {
  final value = raw?.toString();
  if (!_hasContent(value)) return null;
  final parsed = DateTime.tryParse(value!);
  if (parsed == null) return value;
  final local = parsed.toLocal();
  final hour =
      local.hour == 0 ? 12 : (local.hour > 12 ? local.hour - 12 : local.hour);
  final minute = local.minute.toString().padLeft(2, '0');
  final period = local.hour >= 12 ? 'PM' : 'AM';
  return '$hour:$minute $period';
}

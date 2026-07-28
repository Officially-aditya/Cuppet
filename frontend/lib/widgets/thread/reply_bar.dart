import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/message.dart';
import '../../models/attachment.dart';
import '../../providers/auth_provider.dart';
import '../../services/api.dart';
import 'media_attachment_panel.dart';

class ReplyBar extends ConsumerStatefulWidget {
  const ReplyBar({
    required this.onSend,
    this.replyToMessage,
    this.onCancelReply,
    this.showRunNowHint = true,
    super.key,
  });

  final Future<void> Function(String text, List<ComposerAttachment> attachments)
  onSend;
  final Message? replyToMessage;
  final VoidCallback? onCancelReply;
  final bool showRunNowHint;

  @override
  ConsumerState<ReplyBar> createState() => _ReplyBarState();
}

class _ReplyBarState extends ConsumerState<ReplyBar> {
  final _controller = TextEditingController();
  Timer? _hintTimer;
  bool _showRunNowHint = false;
  bool _sending = false;
  final List<ComposerAttachment> _attachments = [];

  @override
  void initState() {
    super.initState();
    if (widget.showRunNowHint) {
      _startRunNowHintTimer();
    }
  }

  @override
  void didUpdateWidget(covariant ReplyBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.showRunNowHint == oldWidget.showRunNowHint) {
      return;
    }

    _hintTimer?.cancel();
    _hintTimer = null;
    if (mounted) {
      setState(() => _showRunNowHint = false);
    }
    if (widget.showRunNowHint) {
      _startRunNowHintTimer();
    }
  }

  void _startRunNowHintTimer() {
    _hintTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted) {
        setState(() => _showRunNowHint = !_showRunNowHint);
      }
    });
  }

  @override
  void dispose() {
    _hintTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      key: const ValueKey('thread-composer'),
      decoration: const BoxDecoration(
        color: CuppetWorkspaceColors.background,
        border: Border(
          top: BorderSide(color: CuppetWorkspaceColors.panelBorder),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (widget.replyToMessage != null) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                SydneySpacing.lg,
                SydneySpacing.sm,
                SydneySpacing.lg,
                0,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: CuppetWorkspaceColors.softSage,
                  borderRadius: BorderRadius.circular(SydneyRadius.md),
                  border: Border.all(color: CuppetWorkspaceColors.panelBorder),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 4,
                      height: 48,
                      decoration: const BoxDecoration(
                        color: CuppetWorkspaceColors.primary,
                        borderRadius: BorderRadius.horizontal(
                          left: Radius.circular(SydneyRadius.sm),
                        ),
                      ),
                    ),
                    const SizedBox(width: SydneySpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.replyToMessage!.sender == MessageSender.user
                                ? 'Replying to your message'
                                : 'Replying to agent',
                            style: Theme.of(
                              context,
                            ).textTheme.labelSmall?.copyWith(
                              color: CuppetWorkspaceColors.primaryInk,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.replyToMessage!.preview,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: CuppetWorkspaceColors.muted),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(
                        Icons.close_rounded,
                        size: 16,
                        color: CuppetWorkspaceColors.muted,
                      ),
                      onPressed: widget.onCancelReply,
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (_attachments.isNotEmpty)
            Padding(
              key: const ValueKey('attachment-chip-list'),
              padding: const EdgeInsets.fromLTRB(
                SydneySpacing.lg,
                SydneySpacing.sm,
                SydneySpacing.lg,
                0,
              ),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Wrap(
                  spacing: SydneySpacing.sm,
                  runSpacing: SydneySpacing.sm,
                  children: [
                    for (final attachment in _attachments)
                      InputChip(
                        key: ValueKey('attachment-chip-${attachment.id}'),
                        avatar: Icon(
                          attachment.isImage
                              ? Icons.image_outlined
                              : Icons.description_outlined,
                          size: 17,
                          color: CuppetWorkspaceColors.primaryInk,
                        ),
                        label: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 180),
                          child: Text(
                            attachment.name,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        onDeleted:
                            _sending
                                ? null
                                : () => setState(
                                  () => _attachments.remove(attachment),
                                ),
                        backgroundColor: CuppetWorkspaceColors.softSage,
                        side: const BorderSide(
                          color: CuppetWorkspaceColors.panelBorder,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(SydneySpacing.lg),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: CuppetWorkspaceColors.card,
                      borderRadius: BorderRadius.circular(SydneyRadius.lg),
                      border: Border.all(color: CuppetWorkspaceColors.border),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x0A1C1A17),
                          blurRadius: 8,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    child: TextField(
                      key: const ValueKey('message-agent-field'),
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: CuppetWorkspaceColors.ink,
                        height: 1.4,
                      ),
                      decoration: InputDecoration(
                        hint: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 300),
                          layoutBuilder:
                              (currentChild, previousChildren) => Stack(
                                alignment: Alignment.centerLeft,
                                children: [
                                  ...previousChildren,
                                  if (currentChild != null) currentChild,
                                ],
                              ),
                          transitionBuilder: (child, animation) {
                            final slide = Tween<Offset>(
                              begin: const Offset(0, 0.3),
                              end: Offset.zero,
                            ).animate(animation);
                            return FadeTransition(
                              opacity: animation,
                              child: SlideTransition(
                                position: slide,
                                child: child,
                              ),
                            );
                          },
                          child: Text(
                            widget.showRunNowHint && _showRunNowHint
                                ? "Try 'Run Now'"
                                : 'Message agent',
                            key: ValueKey(_showRunNowHint),
                          ),
                        ),
                        hintStyle: const TextStyle(
                          color: CuppetWorkspaceColors.muted,
                        ),
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        prefixIcon: IconButton(
                          tooltip: 'Add attachment',
                          icon: const Icon(
                            Icons.add_rounded,
                            color: CuppetWorkspaceColors.primaryInk,
                            size: 22,
                          ),
                          onPressed:
                              _sending
                                  ? null
                                  : () => _showAttachmentOptions(context),
                        ),
                        prefixIconConstraints: const BoxConstraints(
                          minWidth: 44,
                          minHeight: 44,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: SydneySpacing.md,
                          vertical: 13,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: SydneySpacing.sm),
                SizedBox(
                  width: 48,
                  height: 48,
                  child: FilledButton(
                    onPressed: _sending ? null : _send,
                    style: FilledButton.styleFrom(
                      backgroundColor: CuppetWorkspaceColors.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: CuppetWorkspaceColors.softSage,
                      disabledForegroundColor: CuppetWorkspaceColors.muted,
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(SydneyRadius.lg),
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
        ],
      ),
    );
  }

  void _showAttachmentOptions(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return IntegratedMediaAttachmentPanel(
          onFilesPicked: (files, storeInDrive) {
            _uploadPickedFiles(files, storeInDrive);
          },
        );
      },
    );
  }

  Future<void> _uploadPickedFiles(
    List<PickedAttachmentItem> files,
    bool storeInDrive,
  ) async {
    try {
      if (files.isEmpty) return;

      setState(() => _sending = true);
      final remaining = 4 - _attachments.length;
      if (remaining <= 0) {
        throw const ApiException(
          'You can attach up to four files at a time. Choose fewer files and try again.',
        );
      }
      final selected = files.take(remaining).toList();
      final uploaded = <ComposerAttachment>[];
      for (final file in selected) {
        if (file.size > 15 * 1024 * 1024) {
          throw ApiException(
            '${file.name} is larger than 15 MB. Choose a smaller file and try again.',
          );
        }
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Uploading ${file.name}...')));
        final formData = FormData.fromMap({
          'file': MultipartFile.fromBytes(file.bytes, filename: file.name),
          'store_in_drive': storeInDrive ? 'true' : 'false',
        });
        final response = await ref
            .read(apiClientProvider)
            .post<Map<String, dynamic>>(
              '/uploads',
              data: formData,
              queryParameters: {
                'store_in_drive': storeInDrive ? 'true' : 'false',
              },
            );
        final raw = response.data?['file'];
        if (raw is! Map || raw['id'] == null) {
          throw ApiException(
            '${file.name} couldn’t be prepared right now. Please try again.',
          );
        }
        uploaded.add(
          ComposerAttachment(
            id: raw['id'].toString(),
            name: raw['name']?.toString() ?? file.name,
            mimeType:
                raw['mime_type']?.toString() ?? 'application/octet-stream',
            size: int.tryParse(raw['size']?.toString() ?? '') ?? file.size,
          ),
        );
      }
      if (!mounted) return;
      setState(() => _attachments.addAll(uploaded));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            uploaded.length == 1
                ? 'Attachment ready to send.'
                : '${uploaded.length} attachments ready to send.',
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              friendlyErrorMessage(
                e,
                fallback: 'That attachment couldn’t be uploaded.',
              ),
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty && _attachments.isEmpty) {
      return;
    }
    setState(() => _sending = true);
    try {
      await widget.onSend(
        text,
        List<ComposerAttachment>.unmodifiable(_attachments),
      );
      _controller.clear();
      if (mounted) setState(_attachments.clear);
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }
}

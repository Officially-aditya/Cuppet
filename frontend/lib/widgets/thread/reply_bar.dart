import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/message.dart';
import '../../models/attachment.dart';
import '../../providers/auth_provider.dart';

class ReplyBar extends ConsumerStatefulWidget {
  const ReplyBar({
    required this.onSend,
    this.replyToMessage,
    this.onCancelReply,
    super.key,
  });

  final Future<void> Function(
    String text,
    List<ComposerAttachment> attachments,
  ) onSend;
  final Message? replyToMessage;
  final VoidCallback? onCancelReply;

  @override
  ConsumerState<ReplyBar> createState() => _ReplyBarState();
}

class _ReplyBarState extends ConsumerState<ReplyBar> {
  final _controller = TextEditingController();
  bool _sending = false;
  final List<ComposerAttachment> _attachments = [];

  @override
  void dispose() {
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
                IconButton(
                  icon: const Icon(
                    Icons.add_circle_outline_rounded,
                    color: CuppetWorkspaceColors.primaryInk,
                    size: 28,
                  ),
                  style: IconButton.styleFrom(
                    backgroundColor: CuppetWorkspaceColors.card,
                    disabledBackgroundColor: CuppetWorkspaceColors.border,
                    side: const BorderSide(color: CuppetWorkspaceColors.border),
                  ),
                  onPressed:
                      _sending ? null : () => _showAttachmentOptions(context),
                ),
                const SizedBox(width: SydneySpacing.xs),
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
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        hintText: 'Message agent',
                        hintStyle: TextStyle(
                          color: CuppetWorkspaceColors.muted,
                        ),
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
      backgroundColor: Colors.transparent,
      builder: (context) {
        return _AttachmentSheet(
          onPickFile: (storeInDrive) => _pickAndUploadFile(storeInDrive, false),
          onPickPhoto: (storeInDrive) => _pickAndUploadFile(storeInDrive, true),
        );
      },
    );
  }

  Future<void> _pickAndUploadFile(bool storeInDrive, bool isPhotoOnly) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions:
            isPhotoOnly
                ? const ['jpg', 'jpeg', 'png', 'webp']
                : const [
                  'jpg',
                  'jpeg',
                  'png',
                  'webp',
                  'pdf',
                  'txt',
                  'md',
                  'markdown',
                  'csv',
                  'json',
                ],
        allowMultiple: true,
        withData: true,
      );

      if (!mounted) return;
      if (result == null || result.files.isEmpty) {
        return;
      }

      setState(() => _sending = true);
      final remaining = 4 - _attachments.length;
      if (remaining <= 0) {
        throw Exception('A message can include at most four attachments.');
      }
      final selected = result.files.take(remaining).toList();
      final uploaded = <ComposerAttachment>[];
      for (final file in selected) {
        if (file.bytes == null) {
          throw Exception('Could not read ${file.name}.');
        }
        if (file.size > 15 * 1024 * 1024) {
          throw Exception('${file.name} is larger than 15 MB.');
        }
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Uploading ${file.name}...')));
        final formData = FormData.fromMap({
          'file': MultipartFile.fromBytes(file.bytes!, filename: file.name),
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
          throw Exception('Invalid response for ${file.name}.');
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
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
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

class _AttachmentSheet extends StatefulWidget {
  const _AttachmentSheet({required this.onPickFile, required this.onPickPhoto});

  final ValueChanged<bool> onPickFile;
  final ValueChanged<bool> onPickPhoto;

  @override
  State<_AttachmentSheet> createState() => _AttachmentSheetState();
}

class _AttachmentSheetState extends State<_AttachmentSheet> {
  bool _saveToDrive = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: CuppetWorkspaceColors.background,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(SydneyRadius.lg),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(
        SydneySpacing.page,
        SydneySpacing.md,
        SydneySpacing.page,
        SydneySpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 38,
              height: 4,
              margin: const EdgeInsets.only(bottom: SydneySpacing.lg),
              decoration: BoxDecoration(
                color: CuppetWorkspaceColors.panelBorder,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text(
            'Add Attachment',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: SydneySpacing.md),
          SwitchListTile.adaptive(
            title: const Text(
              'Save backup copy to Google Drive',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
            subtitle: const Text(
              'Requires linked Google Drive connector',
              style: TextStyle(fontSize: 12),
            ),
            value: _saveToDrive,
            onChanged: (val) {
              setState(() => _saveToDrive = val);
            },
            activeTrackColor: CuppetWorkspaceColors.primary,
          ),
          const Divider(color: CuppetWorkspaceColors.panelBorder),
          ListTile(
            leading: const Icon(
              Icons.photo_library_outlined,
              color: CuppetWorkspaceColors.primaryInk,
            ),
            title: const Text(
              'Upload Photo',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            onTap: () {
              Navigator.pop(context);
              widget.onPickPhoto(_saveToDrive);
            },
          ),
          ListTile(
            leading: const Icon(
              Icons.description_outlined,
              color: CuppetWorkspaceColors.primaryInk,
            ),
            title: const Text(
              'Upload Document / File',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            onTap: () {
              Navigator.pop(context);
              widget.onPickFile(_saveToDrive);
            },
          ),
        ],
      ),
    );
  }
}

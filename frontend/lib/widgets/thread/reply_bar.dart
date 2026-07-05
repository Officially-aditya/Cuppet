import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../models/message.dart';
import '../../providers/auth_provider.dart';

class ReplyBar extends ConsumerStatefulWidget {
  const ReplyBar({
    required this.onSend,
    this.replyToMessage,
    this.onCancelReply,
    super.key,
  });

  final Future<void> Function(String text) onSend;
  final Message? replyToMessage;
  final VoidCallback? onCancelReply;

  @override
  ConsumerState<ReplyBar> createState() => _ReplyBarState();
}

class _ReplyBarState extends ConsumerState<ReplyBar> {
  final _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: SydneyColors.surfaceContainerLowest,
        border: Border(top: BorderSide(color: SydneyColors.line)),
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
                  color: SydneyColors.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(SydneyRadius.sm),
                  border: Border.all(color: SydneyColors.line),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 4,
                      height: 48,
                      decoration: const BoxDecoration(
                        color: SydneyColors.primary,
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
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: SydneyColors.primary,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            widget.replyToMessage!.preview,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: SydneyColors.subtleInk,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 16, color: SydneyColors.mutedInk),
                      onPressed: widget.onCancelReply,
                    ),
                  ],
                ),
              ),
            ),
          ],
          Padding(
            padding: const EdgeInsets.all(SydneySpacing.lg),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                IconButton(
                  icon: const Icon(
                    Icons.add_circle_outline_rounded,
                    color: SydneyColors.mutedInk,
                    size: 28,
                  ),
                  onPressed: _sending ? null : () => _showAttachmentOptions(context),
                ),
                const SizedBox(width: SydneySpacing.xs),
                Expanded(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: SydneyColors.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(SydneyRadius.md),
                      border: Border.all(color: SydneyColors.line),
                    ),
                    child: TextField(
                      controller: _controller,
                      minLines: 1,
                      maxLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        hintText: 'Message agent',
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
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(SydneyRadius.md),
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
        type: isPhotoOnly ? FileType.image : FileType.any,
        withData: true,
      );

      if (!mounted) return;
      if (result == null || result.files.isEmpty) {
        return;
      }

      final file = result.files.first;
      if (file.bytes == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not read file data.')),
        );
        return;
      }

      setState(() => _sending = true);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Uploading ${file.name}...')),
      );

      final multipartFile = MultipartFile.fromBytes(
        file.bytes!,
        filename: file.name,
      );

      final formData = FormData.fromMap({
        'file': multipartFile,
        'store_in_drive': storeInDrive ? 'true' : 'false',
      });

      final api = ref.read(apiClientProvider);
      final response = await api.post<Map<String, dynamic>>(
        '/uploads',
        data: formData,
        queryParameters: {'store_in_drive': storeInDrive ? 'true' : 'false'},
      );

      if (!mounted) return;
      final fileData = response.data?['file'];
      if (fileData == null || fileData['url'] == null) {
        throw Exception('Invalid response from server.');
      }

      final fileUrl = fileData['url'] as String;
      final isImage = isPhotoOnly || 
          (file.extension != null && 
           ['jpg', 'jpeg', 'png', 'gif', 'webp'].contains(file.extension!.toLowerCase()));

      String markdown;
      if (isImage) {
        markdown = '![${file.name}]($fileUrl)';
      } else {
        markdown = '📎 [${file.name}]($fileUrl)';
      }

      final currentText = _controller.text;
      if (currentText.trim().isEmpty) {
        _controller.text = markdown;
      } else {
        _controller.text = '$currentText\n$markdown';
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Upload complete! Press send to post.')),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
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
    if (text.isEmpty) {
      return;
    }
    setState(() => _sending = true);
    try {
      await widget.onSend(text);
      _controller.clear();
    } finally {
      if (mounted) {
        setState(() => _sending = false);
      }
    }
  }
}

class _AttachmentSheet extends StatefulWidget {
  const _AttachmentSheet({
    required this.onPickFile,
    required this.onPickPhoto,
  });

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
        color: SydneyColors.surface,
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
                color: SydneyColors.outlineVariant.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Text(
            'Add Attachment',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
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
            activeTrackColor: SydneyColors.primary,
          ),
          const Divider(color: SydneyColors.line),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined, color: SydneyColors.primary),
            title: const Text('Upload Photo', style: TextStyle(fontWeight: FontWeight.w600)),
            onTap: () {
              Navigator.pop(context);
              widget.onPickPhoto(_saveToDrive);
            },
          ),
          ListTile(
            leading: const Icon(Icons.description_outlined, color: SydneyColors.primary),
            title: const Text('Upload Document / File', style: TextStyle(fontWeight: FontWeight.w600)),
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

import 'message.dart';

class MessageArchiveState {
  const MessageArchiveState({
    required this.enabled,
    required this.status,
    required this.actionRequired,
    this.folderLink,
    this.lastSuccessAt,
    this.errorCode,
  });

  final bool enabled;
  final String status;
  final bool actionRequired;
  final Uri? folderLink;
  final DateTime? lastSuccessAt;
  final String? errorCode;

  factory MessageArchiveState.fromJson(Map<String, dynamic> json) {
    final folder = json['folder_link']?.toString();
    return MessageArchiveState(
      enabled: json['enabled'] == true,
      status: json['status']?.toString() ?? 'disabled',
      actionRequired: json['action_required'] == true,
      folderLink:
          folder == null || folder.isEmpty ? null : Uri.tryParse(folder),
      lastSuccessAt: DateTime.tryParse(
        json['last_success_at']?.toString() ?? '',
      ),
      errorCode: json['error_code']?.toString(),
    );
  }
}

class ArchivedMessagePage {
  const ArchivedMessagePage({
    required this.messages,
    required this.filesRead,
    this.nextCursor,
  });

  final List<Message> messages;
  final int filesRead;
  final String? nextCursor;
}

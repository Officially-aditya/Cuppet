import 'template_payload_recovery.dart';

enum MessageSender { user, agent, system }

enum MessageDeliveryState { sending, sent, failed }

class Message {
  const Message({
    required this.id,
    required this.threadId,
    required this.sender,
    required this.createdAt,
    required this.content,
    this.deliveryState = MessageDeliveryState.sent,
    this.driveBacked = false,
    this.readOnly = false,
  });

  final String id;
  final String threadId;
  final MessageSender sender;
  final DateTime createdAt;
  final Map<String, dynamic> content;
  final MessageDeliveryState deliveryState;
  final bool driveBacked;
  final bool readOnly;

  String get template => content['template']?.toString() ?? 'plain_text';

  Map<String, dynamic> get data {
    final raw = content['data'];
    if (raw is Map<String, dynamic>) {
      return recoverTemplatePayload(template, raw);
    }
    if (raw is Map) {
      return recoverTemplatePayload(template, Map<String, dynamic>.from(raw));
    }
    return const {};
  }

  Map<String, dynamic> get presentation {
    final raw = content['presentation'];
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return const {};
  }

  String? get groupId {
    final value = presentation['group_id']?.toString().trim();
    return value == null || value.isEmpty ? null : value;
  }

  int get partIndex =>
      int.tryParse(presentation['part_index']?.toString() ?? '') ?? 0;

  int get partCount {
    final value =
        int.tryParse(presentation['part_count']?.toString() ?? '') ?? 1;
    return value < 1 ? 1 : value;
  }

  int get itemOffset =>
      int.tryParse(presentation['item_offset']?.toString() ?? '') ?? 0;

  bool get isMultipart => groupId != null && partCount > 1;

  bool get isFirstPart => !isMultipart || partIndex <= 0;

  bool get isLastPart => !isMultipart || partIndex >= partCount - 1;

  String get preview {
    final text = data['text']?.toString() ?? content['text']?.toString();
    if (text != null && text.trim().isNotEmpty) {
      return text.trim();
    }
    final body = data['body']?.toString();
    if (body != null && body.trim().isNotEmpty) {
      return body.trim();
    }
    return switch (template) {
      'progress_tracker' => data['title']?.toString() ?? 'Progress update',
      'urgency_list' => data['title']?.toString() ?? 'Priority update',
      'data_summary' => data['title']?.toString() ?? 'Summary ready',
      'checklist' => data['title']?.toString() ?? 'Checklist update',
      'daily_task' => data['title']?.toString() ?? 'Daily task',
      'agent_selection' => data['question']?.toString() ?? 'Choose an agent',
      'action_confirmation' =>
        data['action_label']?.toString() ?? 'Confirm an action',
      'streak_counter' => data['label']?.toString() ?? 'Streak update',
      'comparison' => data['title']?.toString() ?? 'Comparison update',
      'briefing_card' => data['title']?.toString() ?? 'Briefing ready',
      'system' =>
        data['text']?.toString() ??
            data['message']?.toString() ??
            data['detail']?.toString() ??
            'System update',
      _ => 'New message',
    };
  }

  factory Message.plainText({
    required String id,
    required String threadId,
    required MessageSender sender,
    required String text,
    DateTime? createdAt,
  }) {
    return Message(
      id: id,
      threadId: threadId,
      sender: sender,
      createdAt: createdAt ?? DateTime.now(),
      content: {
        'template': 'plain_text',
        'data': {'text': text},
      },
    );
  }

  factory Message.system({
    required String id,
    required String threadId,
    required String text,
    DateTime? createdAt,
  }) {
    return Message(
      id: id,
      threadId: threadId,
      sender: MessageSender.system,
      createdAt: createdAt ?? DateTime.now(),
      content: {
        'template': 'system',
        'data': {'text': text},
      },
    );
  }

  factory Message.fromJson(Map<String, dynamic> json) {
    final rawContent = json['content'];
    Map<String, dynamic> parsedContent;

    if (rawContent is Map) {
      parsedContent = Map<String, dynamic>.from(rawContent);
    } else if (rawContent is String && rawContent.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(rawContent.trim());
        if (decoded is Map) {
          parsedContent = Map<String, dynamic>.from(decoded);
        } else {
          parsedContent = {'template': 'plain_text', 'data': {'text': rawContent}};
        }
      } catch (_) {
        parsedContent = {'template': 'plain_text', 'data': {'text': rawContent}};
      }
    } else {
      parsedContent = <String, dynamic>{'template': 'plain_text', 'data': {}};
    }

    parsedContent = recoverMessageContentPayload(parsedContent);
    final archivedAttachments = json['attachments'];
    if (json['drive_backed'] == true && archivedAttachments is List) {
      final data =
          parsedContent['data'] is Map
              ? Map<String, dynamic>.from(parsedContent['data'] as Map)
              : <String, dynamic>{};
      data['attachments'] = [
        for (var index = 0; index < archivedAttachments.length; index++)
          if (archivedAttachments[index] is Map)
            {
              'id': '${json['id'] ?? json['message_id']}-archive-$index',
              'name':
                  (archivedAttachments[index] as Map)['filename']?.toString() ??
                  'attachment',
              'mime_type':
                  (archivedAttachments[index] as Map)['mime_type']
                      ?.toString() ??
                  'application/octet-stream',
              'size':
                  int.tryParse(
                    (archivedAttachments[index] as Map)['size']?.toString() ??
                        '',
                  ) ??
                  0,
            },
      ];
      parsedContent['data'] = data;
    }
    return Message(
      id: (json['id'] ?? json['message_id'])?.toString() ?? '',
      threadId:
          json['threadId']?.toString() ??
          json['thread_id']?.toString() ??
          json['agent_id']?.toString() ??
          '',
      sender: _senderFromString((json['sender'] ?? json['role'])?.toString()),
      createdAt: _parseDate(
        json['createdAt'] ?? json['created_at'] ?? json['timestamp'],
      ),
      content: parsedContent,
      deliveryState: _deliveryStateFromString(
        (json['deliveryState'] ?? json['delivery_state'])?.toString(),
      ),
      driveBacked: json['drive_backed'] == true,
      readOnly: json['read_only'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'threadId': threadId,
      'sender': sender.name,
      'createdAt': createdAt.toIso8601String(),
      'content': content,
      'deliveryState': deliveryState.name,
      'drive_backed': driveBacked,
      'read_only': readOnly,
    };
  }
}

DateTime _parseDate(Object? value) {
  if (value is DateTime) {
    return value;
  }
  if (value is String) {
    return DateTime.tryParse(value) ?? DateTime.now();
  }
  return DateTime.now();
}

MessageSender _senderFromString(String? value) {
  final normalized =
      value?.replaceAll('_', '').replaceAll('-', '').toLowerCase();
  if (normalized == 'assistant') {
    return MessageSender.agent;
  }
  return MessageSender.values.firstWhere(
    (sender) => sender.name.toLowerCase() == normalized,
    orElse: () => MessageSender.agent,
  );
}

MessageDeliveryState _deliveryStateFromString(String? value) {
  final normalized =
      value?.replaceAll('_', '').replaceAll('-', '').toLowerCase();
  return MessageDeliveryState.values.firstWhere(
    (state) => state.name.toLowerCase() == normalized,
    orElse: () => MessageDeliveryState.sent,
  );
}

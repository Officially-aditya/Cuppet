class MessageFeedback {
  const MessageFeedback({
    required this.messageId,
    required this.feedbackType,
    required this.createdAt,
  });

  final String messageId;
  final String feedbackType;
  final DateTime createdAt;

  factory MessageFeedback.fromJson(Map<String, dynamic> json) {
    return MessageFeedback(
      messageId: json['message_id']?.toString() ?? '',
      feedbackType: json['feedback_type']?.toString() ?? '',
      createdAt:
          DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

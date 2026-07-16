class ComposerAttachment {
  const ComposerAttachment({
    required this.id,
    required this.name,
    required this.mimeType,
    required this.size,
  });

  final String id;
  final String name;
  final String mimeType;
  final int size;

  bool get isImage => mimeType.startsWith('image/');
}

class MessageAttachment {
  const MessageAttachment({
    required this.id,
    required this.name,
    required this.mimeType,
    required this.size,
    this.analysisStatus,
  });

  final String id;
  final String name;
  final String mimeType;
  final int size;
  final String? analysisStatus;

  factory MessageAttachment.fromJson(Map<String, dynamic> json) {
    return MessageAttachment(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Attachment',
      mimeType:
          json['mime_type']?.toString() ??
          json['mimeType']?.toString() ??
          'application/octet-stream',
      size: int.tryParse(json['size']?.toString() ?? '') ?? 0,
      analysisStatus:
          json['analysis_status']?.toString() ??
          json['analysisStatus']?.toString(),
    );
  }
}

enum AgentAvailability { ready, thinking, paused }

class Agent {
  const Agent({
    required this.id,
    required this.threadId,
    required this.name,
    required this.avatarInitials,
    required this.description,
    required this.lastMessagePreview,
    required this.latestMessageAt,
    this.unreadCount = 0,
    this.isAssistant = false,
    this.isPinned = false,
    this.availability = AgentAvailability.ready,
    this.accentColor = 0xFF1D7A5C,
    this.parsedIntent,
  });

  final String id;
  final String threadId;
  final String name;
  final String avatarInitials;
  final String description;
  final String lastMessagePreview;
  final DateTime latestMessageAt;
  final int unreadCount;
  final bool isAssistant;
  final bool isPinned;
  final AgentAvailability availability;
  final int accentColor;
  final Map<String, dynamic>? parsedIntent;

  bool get hasUnread => unreadCount > 0;

  Agent copyWith({
    String? id,
    String? threadId,
    String? name,
    String? avatarInitials,
    String? description,
    String? lastMessagePreview,
    DateTime? latestMessageAt,
    int? unreadCount,
    bool? isAssistant,
    bool? isPinned,
    AgentAvailability? availability,
    int? accentColor,
    Map<String, dynamic>? parsedIntent,
  }) {
    return Agent(
      id: id ?? this.id,
      threadId: threadId ?? this.threadId,
      name: name ?? this.name,
      avatarInitials: avatarInitials ?? this.avatarInitials,
      description: description ?? this.description,
      lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
      latestMessageAt: latestMessageAt ?? this.latestMessageAt,
      unreadCount: unreadCount ?? this.unreadCount,
      isAssistant: isAssistant ?? this.isAssistant,
      isPinned: isPinned ?? this.isPinned,
      availability: availability ?? this.availability,
      accentColor: accentColor ?? this.accentColor,
      parsedIntent: parsedIntent ?? this.parsedIntent,
    );
  }

  factory Agent.fromJson(Map<String, dynamic> json) {
    final parsedMap =
        json['parsed_intent'] != null && json['parsed_intent'] is Map
            ? Map<String, dynamic>.from(json['parsed_intent'])
            : null;

    return Agent(
      id: json['id']?.toString() ?? '',
      threadId:
          json['threadId']?.toString() ??
          json['thread_id']?.toString() ??
          json['agent_id']?.toString() ??
          json['id']?.toString() ??
          '',
      name: json['name']?.toString() ?? 'Agent',
      avatarInitials:
          json['avatarInitials']?.toString() ??
          json['avatar_initials']?.toString() ??
          _initialsFromName(json['name']?.toString()) ??
          'A',
      description:
          json['description']?.toString() ??
          _parsedIntentText(json['parsed_intent'], 'action') ??
          json['last_message_preview']?.toString() ??
          json['lastMessagePreview']?.toString() ??
          json['prompt']?.toString() ??
          '',
      lastMessagePreview:
          json['lastMessagePreview']?.toString() ??
          json['last_message_preview']?.toString() ??
          json['latest_message_preview']?.toString() ??
          _parsedIntentText(json['parsed_intent'], 'action') ??
          json['prompt']?.toString() ??
          '',
      latestMessageAt: _parseDate(
        json['latestMessageAt'] ??
            json['latest_message_at'] ??
            json['last_message_at'] ??
            json['updated_at'] ??
            json['created_at'],
      ),
      unreadCount: _parseInt(json['unreadCount'] ?? json['unread_count']),
      isAssistant: json['isAssistant'] == true || json['is_assistant'] == true,
      isPinned:
          json['isPinned'] == true ||
          json['is_pinned'] == true ||
          json['is_assistant'] == true,
      availability: _availabilityFromString(
        (json['availability'] ?? json['status'])?.toString(),
      ),
      accentColor: _parseInt(
        json['accentColor'] ?? json['accent_color'],
        fallback: 0xFF1D7A5C,
      ),
      parsedIntent: parsedMap,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'threadId': threadId,
      'name': name,
      'avatarInitials': avatarInitials,
      'description': description,
      'lastMessagePreview': lastMessagePreview,
      'latestMessageAt': latestMessageAt.toIso8601String(),
      'unreadCount': unreadCount,
      'isAssistant': isAssistant,
      'isPinned': isPinned,
      'availability': availability.name,
      'accentColor': accentColor,
      'parsed_intent': parsedIntent,
    };
  }

  static List<Agent> sortForInbox(List<Agent> agents) {
    final sorted = [...agents];
    sorted.sort((a, b) {
      if (a.hasUnread != b.hasUnread) {
        return a.hasUnread ? -1 : 1;
      }
      if (a.unreadCount != b.unreadCount) {
        return b.unreadCount.compareTo(a.unreadCount);
      }
      final latestComparison = b.latestMessageAt.compareTo(a.latestMessageAt);
      if (latestComparison != 0) {
        return latestComparison;
      }
      if (a.isPinned != b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      if (a.isAssistant != b.isAssistant) {
        return a.isAssistant ? -1 : 1;
      }
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });
    return sorted;
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

int _parseInt(Object? value, {int fallback = 0}) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? fallback;
  }
  return fallback;
}

AgentAvailability _availabilityFromString(String? value) {
  final normalized =
      value?.replaceAll('_', '').replaceAll('-', '').toLowerCase();
  if (normalized == 'active') {
    return AgentAvailability.ready;
  }
  if (normalized == 'error') {
    return AgentAvailability.paused;
  }
  return AgentAvailability.values.firstWhere(
    (availability) => availability.name.toLowerCase() == normalized,
    orElse: () => AgentAvailability.ready,
  );
}

String? _initialsFromName(String? value) {
  final words =
      value
          ?.trim()
          .split(RegExp(r'\s+'))
          .where((word) => word.isNotEmpty)
          .toList() ??
      const [];
  if (words.isEmpty) {
    return null;
  }
  return words.take(2).map((word) => word[0].toUpperCase()).join();
}

String? _parsedIntentText(Object? value, String key) {
  if (value is Map<String, dynamic>) {
    return value[key]?.toString();
  }
  if (value is Map) {
    return value[key]?.toString();
  }
  return null;
}

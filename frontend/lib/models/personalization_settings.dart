class PersonalizationSettings {
  const PersonalizationSettings({
    required this.enabled,
    required this.learningPaused,
    required this.frequency,
    required this.inChat,
    this.proactive = false,
    this.push = false,
    this.quietHoursStart = '21:00',
    this.quietHoursEnd = '08:00',
  });

  const PersonalizationSettings.defaults()
    : enabled = false,
      learningPaused = false,
      frequency = 'balanced',
      inChat = true,
      proactive = false,
      push = false,
      quietHoursStart = '21:00',
      quietHoursEnd = '08:00';

  final bool enabled;
  final bool learningPaused;
  final String frequency;
  final bool inChat;
  final bool proactive;
  final bool push;
  final String quietHoursStart;
  final String quietHoursEnd;

  factory PersonalizationSettings.fromJson(Map<String, dynamic> json) {
    return PersonalizationSettings(
      enabled: json['enabled'] == true,
      learningPaused: json['learning_paused'] == true,
       frequency: switch (json['frequency']?.toString()) {
         'low' => 'low',
         'high' => 'high',
         _ => 'balanced',
       },
      inChat: json['in_chat'] != false,
      proactive: json['proactive'] == true,
      push: json['push'] == true,
      quietHoursStart: _timePart(json['quiet_hours_start'], '21:00'),
      quietHoursEnd: _timePart(json['quiet_hours_end'], '08:00'),
    );
  }

  PersonalizationSettings copyWith({
    bool? enabled,
    bool? learningPaused,
    String? frequency,
    bool? inChat,
    bool? proactive,
    bool? push,
    String? quietHoursStart,
    String? quietHoursEnd,
  }) {
    return PersonalizationSettings(
      enabled: enabled ?? this.enabled,
      learningPaused: learningPaused ?? this.learningPaused,
      frequency: frequency ?? this.frequency,
      inChat: inChat ?? this.inChat,
      proactive: proactive ?? this.proactive,
      push: push ?? this.push,
      quietHoursStart: quietHoursStart ?? this.quietHoursStart,
      quietHoursEnd: quietHoursEnd ?? this.quietHoursEnd,
    );
  }

  Map<String, dynamic> toJson() => {
    'enabled': enabled,
    'learning_paused': learningPaused,
    'frequency': frequency,
    'in_chat': inChat,
    'proactive': proactive,
    'push': push,
    'quiet_hours_start': quietHoursStart,
    'quiet_hours_end': quietHoursEnd,
  };
}

String _timePart(Object? value, String fallback) {
  final text = value?.toString() ?? '';
  return text.length >= 5 && RegExp(r'^\d{2}:\d{2}').hasMatch(text)
      ? text.substring(0, 5)
      : fallback;
}

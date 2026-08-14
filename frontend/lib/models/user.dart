class User {
  const User({
    required this.id,
    required this.email,
    required this.displayName,
    this.avatarUrl,
    this.avatar,
  });

  final String id;
  final String email;
  final String displayName;
  final String? avatarUrl;
  final int? avatar;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      displayName:
          json['displayName']?.toString() ??
          json['display_name']?.toString() ??
          json['name']?.toString() ??
          'Cuppet user',
      avatarUrl:
          json['avatarUrl']?.toString() ??
          json['avatar_url']?.toString() ??
          json['image']?.toString(),
      avatar: _avatarNumber(json['avatar'] ?? json['avatar_number']),
    );
  }

  User copyWith({
    String? id,
    String? email,
    String? displayName,
    String? avatarUrl,
    int? avatar,
  }) {
    return User(
      id: id ?? this.id,
      email: email ?? this.email,
      displayName: displayName ?? this.displayName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      avatar: avatar ?? this.avatar,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'displayName': displayName,
      'avatarUrl': avatarUrl,
      'avatar': avatar,
    };
  }
}

int? _avatarNumber(Object? value) {
  final number =
      value is num ? value.toInt() : int.tryParse(value?.toString() ?? '');
  if (number == null || number < 1 || number > 9) return null;
  return number;
}

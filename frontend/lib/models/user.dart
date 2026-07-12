class User {
  const User({
    required this.id,
    required this.email,
    required this.displayName,
    this.avatarUrl,
  });

  final String id;
  final String email;
  final String displayName;
  final String? avatarUrl;

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
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'displayName': displayName,
      'avatarUrl': avatarUrl,
    };
  }
}

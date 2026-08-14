import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/user.dart';
import 'package:sydney/widgets/user_avatar.dart';

void main() {
  test('maps the persisted avatar number to the matching asset', () {
    final user = User.fromJson({
      'id': 'user-1',
      'email': 'user@example.com',
      'name': 'User',
      'avatar': 3,
    });

    expect(user.avatar, 3);
    expect(userAvatarIconPath(user), kUserAvatarIcons[2]);
    expect(userAvatarNumberForPath(kUserAvatarIcons[2]), 3);
  });

  test('ignores invalid persisted avatar numbers', () {
    final user = User.fromJson({
      'id': 'user-1',
      'email': 'user@example.com',
      'name': 'User',
      'avatar': 10,
    });

    expect(user.avatar, isNull);
  });
}

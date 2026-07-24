import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/tokens.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';

const List<String> kUserAvatarIcons = [
  'assets/icons/bear.png',
  'assets/icons/capybara.png',
  'assets/icons/fox_black.png',
  'assets/icons/koala.png',
  'assets/icons/owl.png',
  'assets/icons/panda.png',
  'assets/icons/pingu.png',
  'assets/icons/porcu.png',
  'assets/icons/slowpoke.png',
];

String userAvatarIconPath(User? user, {String? preferredAvatar}) {
  if (preferredAvatar != null && preferredAvatar.isNotEmpty) {
    return preferredAvatar;
  }
  if (user == null) return kUserAvatarIcons[0];
  if (user.avatarUrl != null && user.avatarUrl!.startsWith('assets/icons/')) {
    return user.avatarUrl!;
  }
  final key = user.id.isNotEmpty ? user.id : user.email;
  if (key.isEmpty) return kUserAvatarIcons[0];
  final index = key.hashCode.abs() % kUserAvatarIcons.length;
  return kUserAvatarIcons[index];
}

class UserAvatar extends ConsumerWidget {
  const UserAvatar({
    required this.user,
    this.size = 64,
    super.key,
  });

  final User? user;
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preferredAvatar = ref.watch(preferredAvatarProvider);
    final assetPath = userAvatarIconPath(user, preferredAvatar: preferredAvatar);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: CuppetWorkspaceColors.softSage,
        shape: BoxShape.circle,
        border: Border.all(
          color: CuppetWorkspaceColors.panelBorder,
          width: 1.5,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Image.asset(
        assetPath,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) {
          final initials = user?.displayName.isNotEmpty == true
              ? user!.displayName[0].toUpperCase()
              : '?';
          return Center(
            child: Text(
              initials,
              style: TextStyle(
                color: CuppetWorkspaceColors.primaryInk,
                fontWeight: FontWeight.w800,
                fontSize: size * 0.35,
              ),
            ),
          );
        },
      ),
    );
  }
}

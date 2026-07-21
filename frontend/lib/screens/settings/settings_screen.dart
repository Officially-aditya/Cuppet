import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
import '../../providers/timezone_provider.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/workspace_primitives.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _pushEnabled = false;
  bool _pushLoading = true;

  @override
  void initState() {
    super.initState();
    _checkPushStatus();
  }

  Future<void> _checkPushStatus() async {
    try {
      final messaging = FirebaseMessaging.instance;
      final settings = await messaging.getNotificationSettings();
      final token = await messaging.getToken();
      final enabled =
          (settings.authorizationStatus == AuthorizationStatus.authorized ||
              settings.authorizationStatus ==
                  AuthorizationStatus.provisional) &&
          token != null &&
          token.isNotEmpty;
      if (mounted) {
        setState(() {
          _pushEnabled = enabled;
          _pushLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _pushLoading = false);
      }
    }
  }

  Future<void> _togglePush(bool enable) async {
    setState(() => _pushLoading = true);
    try {
      if (enable) {
        final result = await ref.read(pushServiceProvider).configure();
        if (mounted) {
          setState(() {
            _pushEnabled = result.isEnabled;
            _pushLoading = false;
          });
        }
      } else {
        await FirebaseMessaging.instance.deleteToken();
        if (mounted) {
          setState(() {
            _pushEnabled = false;
            _pushLoading = false;
          });
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() => _pushLoading = false);
      }
    }
  }

  Future<void> _toggleAutomaticTimeZone(bool enable) async {
    final updated = await ref
        .read(timezonePreferencesProvider.notifier)
        .setFollowDeviceTimeZone(enable);
    if (!updated && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Could not update the time zone. We will try again when you are online.',
          ),
        ),
      );
    }
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final user = authState.asData?.value.user;
    final displayName = user?.displayName ?? 'Cuppet User';
    final email = user?.email ?? '';
    final initials = _initials(displayName);
    final timeZoneAsync = ref.watch(timezonePreferencesProvider);
    final timeZoneState = timeZoneAsync.value;
    final displayedTimeZone = timeZoneState?.displayedTimeZone;
    final followsDevice = timeZoneState?.followDeviceTimeZone;
    final timeZoneBusy =
        timeZoneAsync.isLoading || timeZoneState?.isUpdating == true;

    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: const WorkspaceAppBar(
        eyebrow: 'Your account',
        title: 'Settings',
        subtitle: 'Preferences, security and scheduling.',
      ),
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.md,
            SydneySpacing.page,
            SydneySpacing.xl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const WorkspaceSectionLabel('Profile'),
              const SizedBox(height: SydneySpacing.sm),
              WorkspaceCard(
                key: const ValueKey('settings-profile-card'),
                onTap: () => Navigator.of(context).pushNamed(AppRoutes.profile),
                child: Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      decoration: const BoxDecoration(
                        color: CuppetWorkspaceColors.softSage,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        initials,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          color: CuppetWorkspaceColors.primaryInk,
                          fontWeight: FontWeight.w800,
                          fontSize: 20,
                        ),
                      ),
                    ),
                    const SizedBox(width: SydneySpacing.lg),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            displayName,
                            style: Theme.of(
                              context,
                            ).textTheme.titleSmall?.copyWith(
                              color: CuppetWorkspaceColors.ink,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (email.isNotEmpty) ...[
                            const SizedBox(height: SydneySpacing.xs),
                            Text(
                              email,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(
                                context,
                              ).textTheme.bodySmall?.copyWith(
                                color: CuppetWorkspaceColors.muted,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: SydneySpacing.md),
                    const Icon(
                      Icons.chevron_right_rounded,
                      color: CuppetWorkspaceColors.primaryInk,
                      size: 20,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.xl),
              _SettingsGroup(
                title: 'Preferences',
                children: [
                  _SettingsTile(
                    key: const ValueKey('settings-push-card'),
                    title: 'Push notifications',
                    description: _pushEnabled
                        ? 'Message and agent status alerts are active.'
                        : 'Enable message and agent status alerts.',
                    icon: Icons.notifications_outlined,
                    trailing: ConstrainedBox(
                      constraints: const BoxConstraints(
                        minWidth: 48,
                        minHeight: 48,
                      ),
                      child: Center(
                        child: _pushLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: CuppetWorkspaceColors.primary,
                                ),
                              )
                            : Switch.adaptive(
                                value: _pushEnabled,
                                activeTrackColor: CuppetWorkspaceColors.primary,
                                activeThumbColor: Colors.white,
                                onChanged: _togglePush,
                              ),
                      ),
                    ),
                  ),
                  _SettingsTile(
                    key: const ValueKey('settings-timezone-card'),
                    title: followsDevice == false
                        ? 'Fixed time zone'
                        : 'Automatic time zone',
                    description: _timeZoneDescription(
                      displayedTimeZone: displayedTimeZone,
                      followsDevice: followsDevice,
                      syncPending: timeZoneState?.syncPending == true,
                    ),
                    icon: Icons.public_rounded,
                    trailing: ConstrainedBox(
                      constraints: const BoxConstraints(
                        minWidth: 48,
                        minHeight: 48,
                      ),
                      child: Center(
                        child: timeZoneBusy
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: CuppetWorkspaceColors.primary,
                                ),
                              )
                            : Switch.adaptive(
                                key: const ValueKey(
                                  'automatic-timezone-switch',
                                ),
                                value: followsDevice ?? true,
                                activeTrackColor: CuppetWorkspaceColors.primary,
                                activeThumbColor: Colors.white,
                                onChanged:
                                    timeZoneState?.preferencesLoaded == true
                                        ? _toggleAutomaticTimeZone
                                        : null,
                              ),
                      ),
                    ),
                  ),
                  _SettingsTile(
                    key: const ValueKey('settings-memory-card'),
                    title: 'Memory',
                    description: 'Review confirmed details remembered by Assistant.',
                    icon: Icons.psychology_alt_outlined,
                    trailing: const Icon(
                      Icons.chevron_right_rounded,
                      color: CuppetWorkspaceColors.primaryInk,
                      size: 20,
                    ),
                    onTap: () => Navigator.of(context).pushNamed(AppRoutes.memory),
                  ),
                  _SettingsTile(
                    key: const ValueKey('settings-storage-card'),
                    title: 'Storage',
                    description: 'Manage 30-day history and Google Drive archives.',
                    icon: Icons.storage_outlined,
                    trailing: const Icon(
                      Icons.chevron_right_rounded,
                      color: CuppetWorkspaceColors.primaryInk,
                      size: 20,
                    ),
                    onTap: () => Navigator.of(context).pushNamed(AppRoutes.storage),
                  ),
                ],
              ),
              const SizedBox(height: SydneySpacing.xl),
              _SettingsGroup(
                title: 'Security',
                children: [
                  _SettingsTile(
                    key: const ValueKey('settings-connectors-card'),
                    title: 'Connectors',
                    description: 'Review accounts approved for backend access.',
                    icon: Icons.hub_outlined,
                    trailing: const Icon(
                      Icons.chevron_right_rounded,
                      color: CuppetWorkspaceColors.primaryInk,
                      size: 20,
                    ),
                    onTap: () => Navigator.of(context).pushNamed(AppRoutes.connectors),
                  ),
                ],
              ),
              const SizedBox(height: SydneySpacing.xl),
              const _SettingsGroup(
                title: 'Privacy',
                children: [
                  _SettingsTile(
                    key: ValueKey('settings-privacy-card'),
                    title: 'Session storage',
                    description: 'Cuppet stores only your session token on this device. No browser fingerprints or passive scripts are injected.',
                    icon: Icons.shield_outlined,
                  ),
                ],
              ),
              const SizedBox(height: SydneySpacing.xl),
            ],
          ),
        ),
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: 2,
        onSelected:
            (index) => navigateToMainDestination(
              context,
              currentIndex: 2,
              selectedIndex: index,
            ),
      ),
    );
  }

  String _timeZoneDescription({
    required String? displayedTimeZone,
    required bool? followsDevice,
    required bool syncPending,
  }) {
    final timeZone = displayedTimeZone ?? 'Detecting your device time zone';
    if (syncPending) {
      return '$timeZone · Sync pending until Cuppet is online.';
    }
    if (followsDevice == false) {
      return '$timeZone · Turn on automatic to follow this device.';
    }
    return '$timeZone · Follows this device when it changes.';
  }
}

class _SettingsIcon extends StatelessWidget {
  const _SettingsIcon({
    required this.icon,
  });

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: CuppetWorkspaceColors.softSage,
        borderRadius: BorderRadius.circular(SydneyRadius.md),
      ),
      alignment: Alignment.center,
      child: Icon(
        icon,
        size: 19,
        color: CuppetWorkspaceColors.primaryInk,
      ),
    );
  }
}

class _SettingsCopy extends StatelessWidget {
  const _SettingsCopy({required this.title, required this.description});

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleSmall?.copyWith(
            color: CuppetWorkspaceColors.ink,
            fontSize: 14,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: SydneySpacing.xs),
        Text(
          description,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: CuppetWorkspaceColors.muted,
            fontWeight: FontWeight.w500,
            height: 1.4,
          ),
        ),
      ],
    );
  }
}

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({
    required this.title,
    required this.children,
  });

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        WorkspaceSectionLabel(title),
        const SizedBox(height: SydneySpacing.sm),
        WorkspaceCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (int i = 0; i < children.length; i++) ...[
                children[i],
                if (i < children.length - 1)
                  const Divider(
                    height: 1,
                    thickness: 1,
                    color: CuppetWorkspaceColors.border,
                    indent: SydneySpacing.lg + 40 + SydneySpacing.md,
                  ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _SettingsTile extends StatelessWidget {
  const _SettingsTile({
    required this.title,
    required this.description,
    required this.icon,
    this.trailing,
    this.onTap,
    super.key,
  });

  final String title;
  final String description;
  final IconData icon;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tileContent = Padding(
      padding: const EdgeInsets.all(SydneySpacing.lg),
      child: Row(
        children: [
          _SettingsIcon(
            icon: icon,
          ),
          const SizedBox(width: SydneySpacing.md),
          Expanded(
            child: _SettingsCopy(
              title: title,
              description: description,
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: SydneySpacing.sm),
            trailing!,
          ],
        ],
      ),
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        child: tileContent,
      );
    }
    return tileContent;
  }
}

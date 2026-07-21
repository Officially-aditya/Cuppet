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

  Future<void> _showDeleteAccountConfirmation() async {
    final confirmed = await showAdaptiveDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog.adaptive(
          title: Text(
            'Delete your account?',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: CuppetWorkspaceColors.ink,
            ),
          ),
          content: Text(
            'This action is permanent and cannot be undone. All your agents, active schedules, chat history, memories, and connected configurations will be deleted immediately.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: CuppetWorkspaceColors.muted,
              height: 1.4,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text(
                'Cancel',
                style: TextStyle(
                  color: CuppetWorkspaceColors.muted,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text(
                'Delete permanently',
                style: TextStyle(
                  color: SydneyColors.danger,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        );
      },
    );

    if (confirmed == true && mounted) {
      final doubleConfirmed = await showAdaptiveDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (context) {
          return AlertDialog.adaptive(
            title: Text(
              'Are you absolutely sure?',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
                color: SydneyColors.danger,
              ),
            ),
            content: Text(
              'This is the final warning. This action cannot be undone. Once deleted, your account and all stored data are gone forever.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: CuppetWorkspaceColors.muted,
                height: 1.4,
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text(
                  'Go back',
                  style: TextStyle(
                    color: CuppetWorkspaceColors.muted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text(
                  'Yes, delete forever',
                  style: TextStyle(
                    color: SydneyColors.danger,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          );
        },
      );

      if (doubleConfirmed == true && mounted) {
        _deleteAccount();
      }
    }
  }

  Future<void> _deleteAccount() async {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(
          color: CuppetWorkspaceColors.primary,
        ),
      ),
    );

    try {
      await ref.read(authControllerProvider.notifier).deleteAccount();
      if (mounted) {
        Navigator.of(context).pop(); // Dismiss loading indicator
        Navigator.of(context).pushNamedAndRemoveUntil(
          AppRoutes.signIn,
          (route) => false,
        );
      }
    } catch (error) {
      if (mounted) {
        Navigator.of(context).pop(); // Dismiss loading indicator
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: SydneyColors.danger,
            content: Text(
              readableAuthError(error),
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        );
      }
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
                child: Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: const BoxDecoration(
                        color: CuppetWorkspaceColors.softSage,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        initials,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: CuppetWorkspaceColors.primaryInk,
                          fontWeight: FontWeight.w800,
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
                              fontSize: 15,
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
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.xl),
              const WorkspaceSectionLabel('Preferences'),
              const SizedBox(height: SydneySpacing.sm),
              WorkspaceCard(
                key: const ValueKey('settings-push-card'),
                child: Row(
                  children: [
                    const _SettingsIcon(icon: Icons.notifications_outlined),
                    const SizedBox(width: SydneySpacing.md),
                    Expanded(
                      child: _SettingsCopy(
                        title: 'Push notifications',
                        description:
                            _pushEnabled
                                ? 'Message and agent status alerts are active.'
                                : 'Enable message and agent status alerts.',
                      ),
                    ),
                    const SizedBox(width: SydneySpacing.sm),
                    ConstrainedBox(
                      constraints: const BoxConstraints(
                        minWidth: 48,
                        minHeight: 48,
                      ),
                      child: Center(
                        child:
                            _pushLoading
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
                                  activeTrackColor:
                                      CuppetWorkspaceColors.primary,
                                  activeThumbColor: Colors.white,
                                  onChanged: _togglePush,
                                ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.md),
              WorkspaceCard(
                key: const ValueKey('settings-timezone-card'),
                child: Row(
                  children: [
                    const _SettingsIcon(icon: Icons.public_rounded),
                    const SizedBox(width: SydneySpacing.md),
                    Expanded(
                      child: _SettingsCopy(
                        title:
                            followsDevice == false
                                ? 'Fixed time zone'
                                : 'Automatic time zone',
                        description: _timeZoneDescription(
                          displayedTimeZone: displayedTimeZone,
                          followsDevice: followsDevice,
                          syncPending: timeZoneState?.syncPending == true,
                        ),
                      ),
                    ),
                    const SizedBox(width: SydneySpacing.sm),
                    ConstrainedBox(
                      constraints: const BoxConstraints(
                        minWidth: 48,
                        minHeight: 48,
                      ),
                      child: Center(
                        child:
                            timeZoneBusy
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
                                  activeTrackColor:
                                      CuppetWorkspaceColors.primary,
                                  activeThumbColor: Colors.white,
                                  onChanged:
                                      timeZoneState?.preferencesLoaded == true
                                          ? _toggleAutomaticTimeZone
                                          : null,
                                ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.md),
              WorkspaceCard(
                key: const ValueKey('settings-memory-card'),
                onTap: () => Navigator.of(context).pushNamed(AppRoutes.memory),
                child: const Row(
                  children: [
                    _SettingsIcon(icon: Icons.psychology_alt_outlined),
                    SizedBox(width: SydneySpacing.md),
                    Expanded(
                      child: _SettingsCopy(
                        title: 'Memory',
                        description:
                            'Review confirmed details remembered by Assistant.',
                      ),
                    ),
                    SizedBox(width: SydneySpacing.md),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: CuppetWorkspaceColors.primaryInk,
                      size: 20,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.md),
              WorkspaceCard(
                key: const ValueKey('settings-storage-card'),
                onTap: () => Navigator.of(context).pushNamed(AppRoutes.storage),
                child: const Row(
                  children: [
                    _SettingsIcon(icon: Icons.storage_outlined),
                    SizedBox(width: SydneySpacing.md),
                    Expanded(
                      child: _SettingsCopy(
                        title: 'Storage',
                        description:
                            'Manage 30-day history and Google Drive archives.',
                      ),
                    ),
                    SizedBox(width: SydneySpacing.md),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: CuppetWorkspaceColors.primaryInk,
                      size: 20,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.xl),
              const WorkspaceSectionLabel('Security'),
              const SizedBox(height: SydneySpacing.sm),
              WorkspaceCard(
                key: const ValueKey('settings-connectors-card'),
                onTap:
                    () => Navigator.of(context).pushNamed(AppRoutes.connectors),
                child: const Row(
                  children: [
                    _SettingsIcon(icon: Icons.hub_outlined),
                    SizedBox(width: SydneySpacing.md),
                    Expanded(
                      child: _SettingsCopy(
                        title: 'Connectors',
                        description:
                            'Review accounts approved for backend access.',
                      ),
                    ),
                    SizedBox(width: SydneySpacing.md),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: CuppetWorkspaceColors.primaryInk,
                      size: 20,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.xl),
              const WorkspaceSectionLabel('Privacy'),
              const SizedBox(height: SydneySpacing.sm),
              const WorkspaceCard(
                key: ValueKey('settings-privacy-card'),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SettingsIcon(icon: Icons.shield_outlined),
                    SizedBox(width: SydneySpacing.md),
                    Expanded(
                      child: _SettingsCopy(
                        title: 'Session storage',
                        description:
                            'Cuppet stores only your session token on this device. No browser fingerprints or passive scripts are injected.',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.xl),
              const WorkspaceSectionLabel('Account Actions'),
              const SizedBox(height: SydneySpacing.sm),
              WorkspaceCard(
                key: const ValueKey('settings-delete-account-card'),
                onTap: _showDeleteAccountConfirmation,
                child: const Row(
                  children: [
                    _SettingsIcon(
                      icon: Icons.delete_forever_outlined,
                      backgroundColor: SydneyColors.dangerSoft,
                      iconColor: SydneyColors.danger,
                    ),
                    SizedBox(width: SydneySpacing.md),
                    Expanded(
                      child: _SettingsCopy(
                        title: 'Delete my account',
                        description:
                            'Permanently remove your profile and all associated data.',
                      ),
                    ),
                    SizedBox(width: SydneySpacing.md),
                    Icon(
                      Icons.chevron_right_rounded,
                      color: SydneyColors.danger,
                      size: 20,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            color: CuppetWorkspaceColors.background,
            padding: const EdgeInsets.fromLTRB(
              SydneySpacing.page,
              SydneySpacing.sm,
              SydneySpacing.page,
              SydneySpacing.md,
            ),
            child: OutlinedButton.icon(
              key: const ValueKey('settings-sign-out'),
              onPressed: () async {
                await ref.read(authControllerProvider.notifier).signOut();
                if (context.mounted) {
                  Navigator.of(
                    context,
                  ).pushNamedAndRemoveUntil(AppRoutes.signIn, (route) => false);
                }
              },
              icon: const Icon(Icons.logout_rounded, size: 18),
              label: const Text('Sign out'),
              style: OutlinedButton.styleFrom(
                foregroundColor: SydneyColors.danger,
                backgroundColor: CuppetWorkspaceColors.card,
                side: const BorderSide(color: SydneyColors.danger),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(SydneyRadius.md),
                ),
                minimumSize: const Size.fromHeight(48),
                textStyle: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
          AppBottomNav(
            currentIndex: 2,
            onSelected:
                (index) => navigateToMainDestination(
                  context,
                  currentIndex: 2,
                  selectedIndex: index,
                ),
          ),
        ],
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
    this.backgroundColor,
    this.iconColor,
  });

  final IconData icon;
  final Color? backgroundColor;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: backgroundColor ?? CuppetWorkspaceColors.softSage,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Icon(
        icon,
        size: 19,
        color: iconColor ?? CuppetWorkspaceColors.primaryInk,
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

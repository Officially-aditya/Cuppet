import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
import '../../providers/timezone_provider.dart';
import '../../widgets/app_bottom_nav.dart';
import '../../widgets/sydney_primitives.dart';

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
      final enabled = (settings.authorizationStatus == AuthorizationStatus.authorized ||
              settings.authorizationStatus == AuthorizationStatus.provisional) &&
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
      backgroundColor: SydneyColors.surface,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: SydneyColors.surface.withValues(alpha: 0.95),
        scrolledUnderElevation: 0,
        elevation: 0,
        titleSpacing: SydneySpacing.page,
        title: Text(
          'Settings',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: SydneyColors.ink,
                letterSpacing: -0.5,
              ),
        ),
      ),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.md,
            SydneySpacing.page,
            112,
          ),
          children: [
            Container(
              decoration: BoxDecoration(
                color: SydneyColors.surface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF17201C).withValues(alpha: 0.05),
                    offset: const Offset(4, 4),
                    blurRadius: 8,
                  ),
                  const BoxShadow(
                    color: Colors.white,
                    offset: Offset(-4, -4),
                    blurRadius: 8,
                  ),
                ],
                border: Border.all(
                  color: SydneyColors.line.withValues(alpha: 0.35),
                  width: 0.8,
                ),
              ),
              padding: const EdgeInsets.all(SydneySpacing.lg),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: SydneyColors.primarySoft,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: SydneyColors.line.withValues(alpha: 0.35),
                        width: 0.8,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      initials,
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: SydneyColors.primary,
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
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: SydneyColors.ink,
                              ),
                        ),
                        if (email.isNotEmpty) ...[
                          const SizedBox(height: SydneySpacing.xs),
                          Text(
                            email,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: SydneyColors.mutedInk,
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
            const SizedBox(height: SydneySpacing.lg),
            const SydneySectionLabel('Preferences'),
            const SizedBox(height: SydneySpacing.sm),
            Container(
              decoration: BoxDecoration(
                color: SydneyColors.surface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF17201C).withValues(alpha: 0.05),
                    offset: const Offset(4, 4),
                    blurRadius: 8,
                  ),
                  const BoxShadow(
                    color: Colors.white,
                    offset: Offset(-4, -4),
                    blurRadius: 8,
                  ),
                ],
                border: Border.all(
                  color: SydneyColors.line.withValues(alpha: 0.35),
                  width: 0.8,
                ),
              ),
              padding: const EdgeInsets.all(SydneySpacing.lg),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Push notifications',
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                color: SydneyColors.ink,
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _pushEnabled
                              ? 'Message and agent status alerts are active.'
                              : 'Enable to receive message and agent alerts.',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: SydneyColors.mutedInk,
                                fontWeight: FontWeight.w400,
                                height: 1.35,
                              ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: SydneySpacing.md),
                  SizedBox(
                    height: 24,
                    child: _pushLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: SydneyColors.primary,
                            ),
                          )
                        : Switch.adaptive(
                            value: _pushEnabled,
                            activeTrackColor: SydneyColors.primary,
                            onChanged: _togglePush,
                          ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.lg),
            Container(
              key: const ValueKey('settings-timezone-card'),
              decoration: BoxDecoration(
                color: SydneyColors.surface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF17201C).withValues(alpha: 0.05),
                    offset: const Offset(4, 4),
                    blurRadius: 8,
                  ),
                  const BoxShadow(
                    color: Colors.white,
                    offset: Offset(-4, -4),
                    blurRadius: 8,
                  ),
                ],
                border: Border.all(
                  color: SydneyColors.line.withValues(alpha: 0.35),
                  width: 0.8,
                ),
              ),
              padding: const EdgeInsets.all(SydneySpacing.lg),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: SydneyColors.primarySoft,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: SydneyColors.line.withValues(alpha: 0.35),
                        width: 0.8,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(
                      Icons.public_rounded,
                      size: 18,
                      color: SydneyColors.primary,
                    ),
                  ),
                  const SizedBox(width: SydneySpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          followsDevice == false
                              ? 'Fixed time zone'
                              : 'Automatic time zone',
                          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                color: SydneyColors.ink,
                                fontWeight: FontWeight.bold,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _timeZoneDescription(
                            displayedTimeZone: displayedTimeZone,
                            followsDevice: followsDevice,
                            syncPending: timeZoneState?.syncPending == true,
                          ),
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: SydneyColors.mutedInk,
                                fontWeight: FontWeight.w400,
                                height: 1.35,
                              ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: SydneySpacing.md),
                  if (timeZoneBusy)
                    const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: SydneyColors.primary,
                      ),
                    )
                  else
                    Switch.adaptive(
                      key: const ValueKey('automatic-timezone-switch'),
                      value: followsDevice ?? true,
                      activeTrackColor: SydneyColors.primary,
                      onChanged: timeZoneState?.preferencesLoaded == true
                          ? _toggleAutomaticTimeZone
                          : null,
                    ),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.lg),
            const SydneySectionLabel('Security'),
            const SizedBox(height: SydneySpacing.sm),
            Container(
              decoration: BoxDecoration(
                color: SydneyColors.surface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF17201C).withValues(alpha: 0.05),
                    offset: const Offset(4, 4),
                    blurRadius: 8,
                  ),
                  const BoxShadow(
                    color: Colors.white,
                    offset: Offset(-4, -4),
                    blurRadius: 8,
                  ),
                ],
                border: Border.all(
                  color: SydneyColors.line.withValues(alpha: 0.35),
                  width: 0.8,
                ),
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => Navigator.of(context).pushNamed(AppRoutes.connectors),
                  child: Padding(
                    padding: const EdgeInsets.all(SydneySpacing.lg),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Connectors',
                                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                                      color: SydneyColors.ink,
                                      fontWeight: FontWeight.bold,
                                    ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Review accounts approved for backend access.',
                                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                      color: SydneyColors.mutedInk,
                                      fontWeight: FontWeight.w400,
                                      height: 1.35,
                                    ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(
                          Icons.chevron_right_rounded,
                          color: SydneyColors.subtleInk,
                          size: 18,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: SydneySpacing.lg),
            const SydneySectionLabel('Privacy'),
            const SizedBox(height: SydneySpacing.sm),
            Container(
              decoration: BoxDecoration(
                color: SydneyColors.surface,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF17201C).withValues(alpha: 0.05),
                    offset: const Offset(4, 4),
                    blurRadius: 8,
                  ),
                  const BoxShadow(
                    color: Colors.white,
                    offset: Offset(-4, -4),
                    blurRadius: 8,
                  ),
                ],
                border: Border.all(
                  color: SydneyColors.line.withValues(alpha: 0.35),
                  width: 0.8,
                ),
              ),
              padding: const EdgeInsets.all(SydneySpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Session storage',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                          color: SydneyColors.ink,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'This app stores only your Cuppet session token on device. No browser fingerprints or passive scripts are injected.',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: SydneyColors.mutedInk,
                          fontWeight: FontWeight.w400,
                          height: 1.45,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SydneyFooter(
            child: OutlinedButton.icon(
              onPressed: () async {
                await ref.read(authControllerProvider.notifier).signOut();
                if (context.mounted) {
                  Navigator.of(context).pushNamedAndRemoveUntil(
                    AppRoutes.signIn,
                    (route) => false,
                  );
                }
              },
              icon: const Icon(Icons.logout_rounded, size: 16),
              label: const Text('Sign out'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFDC2626),
                side: const BorderSide(color: Color(0xFFFEE2E2)),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                minimumSize: const Size.fromHeight(48),
                textStyle: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
          ),
          AppBottomNav(
            currentIndex: 2,
            onSelected: (index) => navigateToMainDestination(
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

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
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
    final displayName = user?.displayName ?? 'Sydney User';
    final email = user?.email ?? '';
    final initials = _initials(displayName);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
        ),
        title: const Text('Settings'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
      ),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.lg,
            SydneySpacing.page,
            112,
          ),
          children: [
            SydneyPanel(
              child: Row(
                children: [
                  SydneyIconBadge(
                    size: 48,
                    radius: SydneyRadius.md,
                    color: SydneyColors.primarySoft,
                    foregroundColor: SydneyColors.primary,
                    child: Text(initials),
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
                          ).textTheme.titleSmall?.copyWith(fontSize: 14),
                        ),
                        if (email.isNotEmpty) ...[
                          const SizedBox(height: SydneySpacing.xs),
                          Text(
                            email,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: SydneyColors.mutedInk),
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
            SydneyPanel(
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Push notifications',
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(color: SydneyColors.onSurface),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _pushEnabled
                              ? 'Message and agent status alerts are active.'
                              : 'Enable to receive message and agent alerts.',
                          style: Theme.of(
                            context,
                          ).textTheme.labelSmall?.copyWith(
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
            const SydneySectionLabel('Security'),
            SydneyPanel(
              onTap:
                  () => Navigator.of(context).pushNamed(AppRoutes.connectors),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Connectors',
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(color: SydneyColors.onSurface),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Review accounts approved for backend access.',
                          style: Theme.of(
                            context,
                          ).textTheme.labelSmall?.copyWith(
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
                    color: SydneyColors.outlineVariant,
                    size: 18,
                  ),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.lg),
            const SydneySectionLabel('Privacy'),
            SydneyPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Session storage',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: SydneyColors.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'This app stores only your Sydney session token on device. No browser fingerprints or passive scripts are injected.',
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
      bottomNavigationBar: SydneyFooter(
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
            side: const BorderSide(color: Color(0xFFFECACA)),
            minimumSize: const Size.fromHeight(48),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/personalization_provider.dart';
import '../../services/api.dart';
import '../../widgets/auth/auth_widgets.dart';
import '../../widgets/sydney_primitives.dart';
import '../../widgets/workspace_primitives.dart';

class PersonalizationOnboardingScreen extends ConsumerStatefulWidget {
  const PersonalizationOnboardingScreen({super.key});

  @override
  ConsumerState<PersonalizationOnboardingScreen> createState() =>
      _PersonalizationOnboardingScreenState();
}

class _PersonalizationOnboardingScreenState
    extends ConsumerState<PersonalizationOnboardingScreen> {
  bool _busy = false;
  Object? _error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                SydneySpacing.page,
                SydneySpacing.xxl,
                SydneySpacing.page,
                SydneySpacing.xl,
              ),
              children: [
                const AuthLogo(),
                const SizedBox(height: SydneySpacing.lg),
                Text(
                  'One last choice',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: CuppetWorkspaceColors.primaryInk,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                  ),
                ),
                const SizedBox(height: SydneySpacing.sm),
                Text(
                  'Make suggestions more useful',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: CuppetWorkspaceColors.ink,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    height: 1.05,
                    letterSpacing: -0.7,
                  ),
                ),
                const SizedBox(height: SydneySpacing.sm),
                Text(
                  'With your permission, Cuppet can learn from repeated Assistant activity and feedback you give it. It can then suggest useful automations and follow-ups.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: CuppetWorkspaceColors.muted,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: SydneySpacing.xl),
                WorkspaceCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'What this enables',
                        style: TextStyle(
                          color: CuppetWorkspaceColors.ink,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: SydneySpacing.sm),
                      Text(
                        'In-chat suggestions based on activity inside Cuppet and direct feedback such as Useful or Not useful.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: CuppetWorkspaceColors.muted,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: SydneySpacing.md),
                const WorkspacePrivacyPanel(
                  title: 'You stay in control',
                  message:
                      'Connected accounts, browser activity, proactive suggestions, and push notifications stay off until you enable them later in Settings. You can change this choice at any time.',
                ),
                if (_error != null) ...[
                  const SizedBox(height: SydneySpacing.md),
                  SydneyNotice(
                    text: friendlyErrorMessage(
                      _error!,
                      fallback:
                          'Personalized suggestions could not be enabled.',
                    ),
                    icon: Icons.error_outline_rounded,
                    iconColor: SydneyColors.danger,
                    backgroundColor: SydneyColors.dangerSoft,
                    borderColor: SydneyColors.dangerSoft,
                    textColor: SydneyColors.danger,
                  ),
                ],
                const SizedBox(height: SydneySpacing.xl),
                AuthPrimaryButton(
                  key: const ValueKey('personalization-onboarding-allow'),
                  label: _busy ? 'Enabling...' : 'Allow suggestions',
                  onPressed: _busy ? null : _allow,
                ),
                const SizedBox(height: SydneySpacing.sm),
                TextButton(
                  key: const ValueKey('personalization-onboarding-not-now'),
                  onPressed: _busy ? null : _skip,
                  child: const Text('Not now'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _allow() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final service = ref.read(personalizationServiceProvider);
      final profile = await service.loadProfile();
      final hasConsent =
          profile.consentGranted('cuppet_activity') &&
          profile.consentGranted('explicit_feedback');
      if (!profile.settings.enabled && !hasConsent) {
        await service.grantConsent('cuppet_activity', source: 'onboarding');
        await service.grantConsent('explicit_feedback', source: 'onboarding');
        await service.updateSettings(
          profile.settings.copyWith(enabled: true, inChat: true),
        );
      }
      if (!mounted) return;
      ref.invalidate(personalizationProvider);
      _finish();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = error;
      });
    }
  }

  void _skip() => _finish();

  void _finish() {
    Navigator.of(
      context,
    ).pushNamedAndRemoveUntil(AppRoutes.inbox, (route) => false);
  }
}

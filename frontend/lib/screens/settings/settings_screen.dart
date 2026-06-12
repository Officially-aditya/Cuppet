import 'package:flutter/material.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../widgets/sydney_primitives.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
                  const SydneyIconBadge(
                    size: 48,
                    radius: SydneyRadius.md,
                    color: SydneyColors.primarySoft,
                    foregroundColor: SydneyColors.primary,
                    child: Text('AU'),
                  ),
                  const SizedBox(width: SydneySpacing.lg),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Authenticated User',
                          style: Theme.of(
                            context,
                          ).textTheme.titleSmall?.copyWith(fontSize: 14),
                        ),
                        const SizedBox(height: SydneySpacing.xs),
                        Text(
                          'user@session.local',
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: SydneyColors.mutedInk),
                        ),
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
                          'Enable message and agent status alerts.',
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
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: SydneySpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: SydneyColors.surface,
                      borderRadius: BorderRadius.circular(SydneyRadius.full),
                      border: Border.all(color: SydneyColors.line),
                    ),
                    child: Text(
                      'Not configured',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: SydneyColors.outline,
                        fontWeight: FontWeight.w800,
                      ),
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
          onPressed:
              () => Navigator.of(
                context,
              ).pushNamedAndRemoveUntil(AppRoutes.signIn, (route) => false),
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

import 'package:flutter/material.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../widgets/surface_card.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _pushNotifications = true;

  @override
  Widget build(BuildContext context) {
    const email = 'elementary221b@gmail.com';
    const displayName = 'John Doe';

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        title: const Text('Settings'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SydneySpacing.page),
          children: [
            SurfaceCard(
              child: Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: const BoxDecoration(
                      color: SydneyColors.primarySoft,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'EL',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: SydneyColors.primary,
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
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: SydneySpacing.xs),
                        Text(
                          email,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.xl),
            const _SectionLabel('Preferences'),
            _SettingsGroup(
              children: [
                _SettingsRow(
                  title: 'Push notifications',
                  body: 'Enable message and agent status alerts.',
                  trailing: Switch(
                    value: _pushNotifications,
                    onChanged:
                        (value) => setState(() => _pushNotifications = value),
                  ),
                ),
              ],
            ),
            const SizedBox(height: SydneySpacing.xl),
            const _SectionLabel('Security'),
            _SettingsGroup(
              children: [
                _SettingsRow(
                  title: 'Connectors',
                  body: 'Review accounts approved for backend access.',
                  trailing: const Icon(
                    Icons.chevron_right_rounded,
                    color: SydneyColors.outline,
                  ),
                  onTap:
                      () =>
                          Navigator.of(context).pushNamed(AppRoutes.connectors),
                ),
              ],
            ),
            const SizedBox(height: SydneySpacing.xl),
            const _SectionLabel('Privacy'),
            const _SettingsGroup(
              children: [
                _SettingsRow(
                  title: 'Session storage',
                  body:
                      'This app stores only your Sydney session token on device.',
                ),
              ],
            ),
            const SizedBox(height: SydneySpacing.xxl),
            OutlinedButton.icon(
              onPressed: _signOut,
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Sign out'),
              style: OutlinedButton.styleFrom(
                foregroundColor: SydneyColors.danger,
                side: const BorderSide(color: SydneyColors.dangerSoft),
                minimumSize: const Size.fromHeight(50),
              ),
            ),
            const SizedBox(height: SydneySpacing.xxl),
            Text(
              'Sydney Agent v1.2.4\nEncryption active',
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: SydneyColors.subtleInk),
            ),
          ],
        ),
      ),
    );
  }

  void _signOut() {
    Navigator.of(
      context,
    ).pushNamedAndRemoveUntil(AppRoutes.signIn, (route) => false);
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        left: SydneySpacing.xs,
        bottom: SydneySpacing.sm,
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: SydneyColors.primary,
          letterSpacing: 0,
        ),
      ),
    );
  }
}

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      padding: EdgeInsets.zero,
      child: Column(mainAxisSize: MainAxisSize.min, children: children),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.title,
    required this.body,
    this.trailing,
    this.onTap,
  });

  final String title;
  final String body;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: const EdgeInsets.all(SydneySpacing.lg),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: SydneySpacing.xs),
                Text(
                  body,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: SydneyColors.mutedInk),
                ),
              ],
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: SydneySpacing.md),
            trailing!,
          ],
        ],
      ),
    );

    if (onTap == null) {
      return content;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(onTap: onTap, child: content),
    );
  }
}

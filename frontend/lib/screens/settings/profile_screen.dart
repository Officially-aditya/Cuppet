import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/workspace_primitives.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  late final TextEditingController _nameController;

  @override
  void initState() {
    super.initState();
    final initialName = ref.read(preferredNameProvider);
    _nameController = TextEditingController(text: initialName);
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
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
    final navigator = Navigator.of(context);
    final scaffoldMessenger = ScaffoldMessenger.of(context);

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
      navigator.pop(); // Dismiss loading indicator
      navigator.pushNamedAndRemoveUntil(
        AppRoutes.signIn,
        (route) => false,
      );
    } catch (error) {
      if (mounted) {
        navigator.pop(); // Dismiss loading indicator
        scaffoldMessenger.showSnackBar(
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

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final user = authState.asData?.value.user;
    final defaultDisplayName = user?.displayName ?? 'Cuppet User';
    final preferredName = ref.watch(preferredNameProvider);
    final displayName = preferredName.isNotEmpty ? preferredName : defaultDisplayName;
    final email = user?.email ?? '';
    final initials = _initials(displayName);

    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: AppBar(
        backgroundColor: CuppetWorkspaceColors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        foregroundColor: CuppetWorkspaceColors.ink,
        title: Text(
          'Profile',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: CuppetWorkspaceColors.ink,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: SydneySpacing.page,
            vertical: SydneySpacing.md,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              WorkspaceCard(
                child: Column(
                  children: [
                    Container(
                      width: 80,
                      height: 80,
                      decoration: const BoxDecoration(
                        color: CuppetWorkspaceColors.softSage,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        initials,
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          color: CuppetWorkspaceColors.primaryInk,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(height: SydneySpacing.md),
                    Text(
                      displayName,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: CuppetWorkspaceColors.ink,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (email.isNotEmpty) ...[
                      const SizedBox(height: SydneySpacing.xs),
                      Text(
                        email,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: CuppetWorkspaceColors.muted,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.xl),
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'PREFERRED NAME',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: CuppetWorkspaceColors.primaryInk,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.9,
                    ),
                  ),
                  const SizedBox(height: SydneySpacing.sm),
                  WorkspaceCard(
                    padding: const EdgeInsets.all(SydneySpacing.lg),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'What should cuppet call you',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: CuppetWorkspaceColors.ink,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: SydneySpacing.md),
                        TextField(
                          controller: _nameController,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: CuppetWorkspaceColors.ink,
                            height: 1.4,
                          ),
                          cursorColor: CuppetWorkspaceColors.primary,
                          onChanged: (val) {
                            ref.read(preferredNameProvider.notifier).setPreferredName(val.trim());
                          },
                          decoration: InputDecoration(
                            hintText: defaultDisplayName,
                            fillColor: CuppetWorkspaceColors.background,
                            filled: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: SydneySpacing.md,
                              vertical: 14,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(SydneyRadius.md),
                              borderSide: const BorderSide(color: CuppetWorkspaceColors.border),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(SydneyRadius.md),
                              borderSide: const BorderSide(color: CuppetWorkspaceColors.border),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(SydneyRadius.md),
                              borderSide: const BorderSide(
                                color: CuppetWorkspaceColors.primary,
                                width: 1.4,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: SydneySpacing.xl),
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'ACCOUNT ACTIONS',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: CuppetWorkspaceColors.primaryInk,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.9,
                    ),
                  ),
                  const SizedBox(height: SydneySpacing.sm),
                  WorkspaceCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        InkWell(
                          key: const ValueKey('settings-delete-account-card'),
                          onTap: _showDeleteAccountConfirmation,
                          child: Padding(
                            padding: const EdgeInsets.all(SydneySpacing.lg),
                            child: Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: SydneyColors.dangerSoft,
                                    borderRadius: BorderRadius.circular(SydneyRadius.md),
                                  ),
                                  alignment: Alignment.center,
                                  child: const Icon(
                                    Icons.delete_forever_outlined,
                                    size: 19,
                                    color: SydneyColors.danger,
                                  ),
                                ),
                                const SizedBox(width: SydneySpacing.md),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'Delete my account',
                                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                          color: SydneyColors.danger,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      const SizedBox(height: SydneySpacing.xs),
                                      Text(
                                        'Permanently remove your profile and all associated data.',
                                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                          color: CuppetWorkspaceColors.muted,
                                          fontWeight: FontWeight.w500,
                                          height: 1.4,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: SydneySpacing.sm),
                                const Icon(
                                  Icons.chevron_right_rounded,
                                  color: SydneyColors.danger,
                                  size: 20,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

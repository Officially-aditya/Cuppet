import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/auth/auth_widgets.dart';
import '../../widgets/sydney_primitives.dart';
import '../../widgets/workspace_primitives.dart';
class SignInScreen extends ConsumerStatefulWidget {
const SignInScreen({super.key});
@override
ConsumerState<SignInScreen> createState() => _SignInScreenState();
}
class _SignInScreenState extends ConsumerState<SignInScreen> {
// NOTE: The email sign-in form is now navigated to a separate screen (AppRoutes.signInWithEmail).
// The state variables and methods related to the inline email form have been removed.
@override
Widget build(BuildContext context) {
final auth = ref.watch(authControllerProvider);
final loading = auth.isLoading;
return Scaffold(
backgroundColor: CuppetWorkspaceColors.background,
body: SafeArea(
child: Center(
child: ConstrainedBox(
constraints: const BoxConstraints(maxWidth: 420),
child: ListView(
padding: const EdgeInsets.fromLTRB(
SydneySpacing.page,
SydneySpacing.xxl,
SydneySpacing.page,
SydneySpacing.xl,
),
children: [
const SizedBox(height: SydneySpacing.xl),
const AuthLogo(),
const SizedBox(height: SydneySpacing.lg),
Text(
'Welcome back',
textAlign: TextAlign.center,
style: Theme.of(context).textTheme.headlineSmall?.copyWith(
fontSize: 28,
fontWeight: FontWeight.w800,
color: CuppetWorkspaceColors.ink,
height: 1.05,
letterSpacing: -0.7,
),
),
const SizedBox(height: SydneySpacing.sm),
Text(
'Delegate work through conversations with agents you trust.',
textAlign: TextAlign.center,
style: Theme.of(context).textTheme.bodyMedium?.copyWith(
color: CuppetWorkspaceColors.muted,
height: 1.35,
),
),
const SizedBox(height: SydneySpacing.xxl),
const WorkspaceSectionLabel('Sign in'),
const SizedBox(height: SydneySpacing.sm),
LoginOptionCard(
title: 'Sign in with Google',
subtitle: 'Access your account with your Google account.',
icon: null, // FIX: SVG assets are not valid for the IconData? type expected by LoginOptionCard. Setting to null for now.
onTap: loading ? null : _continueWithGoogle,
),
const SizedBox(height: SydneySpacing.sm),
LoginOptionCard(
title: 'Sign in with Email',
subtitle: 'Access your account with your email and password.',
icon: null, // FIX: SVG assets are not valid for the IconData? type expected by LoginOptionCard. Setting to null for now.
onTap: loading
? null
: () =>
Navigator.of(context).pushNamed(AppRoutes.signInWithEmail),
),
const SizedBox(height: SydneySpacing.xxl),
const AuthDividerLabel(),
const SizedBox(height: SydneySpacing.lg),
Wrap(
alignment: WrapAlignment.center,
crossAxisAlignment: WrapCrossAlignment.center,
children: [
Text(
"Don't have an account?",
style: Theme.of(context).textTheme.bodySmall?.copyWith(
color: CuppetWorkspaceColors.muted,
),
),
TextButton(
onPressed:
loading
? null
: () => Navigator.of(
context,
).pushNamed(AppRoutes.signUp),
style: TextButton.styleFrom(
foregroundColor: CuppetWorkspaceColors.primary,
textStyle: const TextStyle(fontWeight: FontWeight.w800),
),
child: const Text('Create one'),
),
],
),
],
),
),
),
),
);
}
Future<void> _continueWithGoogle() async {
await ref.read(authControllerProvider.notifier).continueWithGoogle();
if (!mounted) {
return;
}
final state = ref.read(authControllerProvider).asData?.value;
if (state?.isAuthenticated == true) {
Navigator.of(
context,
).pushNamedAndRemoveUntil(AppRoutes.inbox, (route) => false);
}
}
}
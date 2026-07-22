import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/auth/auth_widgets.dart';
import '../../widgets/sydney_primitives.dart';
import '../../widgets/workspace_primitives.dart';
class EmailSignInScreen extends ConsumerStatefulWidget {
const EmailSignInScreen({super.key});
@override
ConsumerState<EmailSignInScreen> createState() => _EmailSignInScreenState();
}
class _EmailSignInScreenState extends ConsumerState<EmailSignInScreen> {
final _formKey = GlobalKey<FormState>();
final _emailController = TextEditingController();
final _passwordController = TextEditingController();
bool _showPassword = false;
@override
void dispose() {
_emailController.dispose();
_passwordController.dispose();
super.dispose();
}
Future<void> _submit() async {
if (!_formKey.currentState!.validate()) {
return;
}
await ref
.read(authControllerProvider.notifier)
.signIn(
email: _emailController.text.trim(),
password: _passwordController.text,
);
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
@override
Widget build(BuildContext context) {
final auth = ref.watch(authControllerProvider);
final loading = auth.isLoading;
return Scaffold(
backgroundColor: CuppetWorkspaceColors.background,
appBar: AppBar(
backgroundColor: CuppetWorkspaceColors.background,
elevation: 0,
),
body: SafeArea(
child: Center(
child: ConstrainedBox(
constraints: const BoxConstraints(maxWidth: 420),
child: ListView(
padding: const EdgeInsets.fromLTRB(
SydneySpacing.page,
SydneySpacing.md, // Reduced top padding since AppBar is present
SydneySpacing.page,
SydneySpacing.xl,
),
children: [
Text(
'Sign In with Email',
textAlign: TextAlign.center,
style: Theme.of(context).textTheme.headlineMedium?.copyWith(
fontWeight: FontWeight.w700,
color: CuppetWorkspaceColors.ink,
),
),
const SizedBox(height: SydneySpacing.xxl),
WorkspaceCard(
padding: const EdgeInsets.all(SydneySpacing.lg),
child: Form(
key: _formKey,
child: Column(
crossAxisAlignment: CrossAxisAlignment.stretch,
children: [
AuthField(
label: 'Email Address',
controller: _emailController,
icon: Icons.mail_outline_rounded,
keyboardType: TextInputType.emailAddress,
textInputAction: TextInputAction.next,
validator: (value) =>
value == null || value.trim().isEmpty
? 'Enter your email.'
: null,
),
const SizedBox(height: SydneySpacing.lg),
AuthField(
label: 'Password',
controller: _passwordController,
icon: Icons.lock_outline_rounded,
obscureText: !_showPassword,
textInputAction: TextInputAction.done,
suffix: IconButton(
tooltip: _showPassword ? 'Hide password' : 'Show password',
onPressed: () => setState(
() => _showPassword = !_showPassword,
),
icon: Icon(
_showPassword
? Icons.visibility_off_outlined
: Icons.visibility_outlined,
size: 18,
color: CuppetWorkspaceColors.muted,
),
),
validator: (value) =>
value == null || value.isEmpty
? 'Enter your password.'
: null,
onFieldSubmitted: (_) => _submit(),
),
Align(
alignment: Alignment.centerRight,
child: TextButton(
onPressed: loading ? null : () {},
style: TextButton.styleFrom(
foregroundColor: CuppetWorkspaceColors.primary,
textStyle: const TextStyle(
fontWeight: FontWeight.w700,
),
),
child: const Text('Forgot Password?'),
),
),
if (auth.hasError) ...[
SydneyNotice(
text: readableAuthError(auth.error!),
icon: Icons.error_outline_rounded,
iconColor: SydneyColors.danger,
backgroundColor: SydneyColors.dangerSoft,
borderColor: SydneyColors.dangerSoft,
textColor: SydneyColors.danger,
),
const SizedBox(height: SydneySpacing.md),
],
AuthPrimaryButton(
label: loading ? 'Signing in...' : 'Sign In',
onPressed: loading ? null : _submit,
),
],
),
),
),
],
),
),
),
),
);
}
}
import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../../widgets/cuppet_logo.dart';
import '../../widgets/workspace_primitives.dart';

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  static const _topics = <String>[
    'Product idea',
    'Something went wrong',
    'General feedback',
  ];

  late final TextEditingController _messageController;
  String _selectedTopic = _topics.first;
  bool _submitted = false;

  @override
  void initState() {
    super.initState();
    _messageController = TextEditingController()..addListener(_messageChanged);
  }

  @override
  void dispose() {
    _messageController
      ..removeListener(_messageChanged)
      ..dispose();
    super.dispose();
  }

  void _messageChanged() {
    setState(() {});
  }

  void _submit() {
    if (_messageController.text.trim().isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() => _submitted = true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: CuppetWorkspaceColors.background,
        foregroundColor: CuppetWorkspaceColors.ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleSpacing: SydneySpacing.page,
        title: const CuppetMark(size: 28),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.md,
            SydneySpacing.page,
            SydneySpacing.xl,
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            child:
                _submitted
                    ? _Confirmation(onBack: _goBack)
                    : _Form(
                      selectedTopic: _selectedTopic,
                      topics: _topics,
                      messageController: _messageController,
                      onTopicSelected: (topic) {
                        setState(() => _selectedTopic = topic);
                      },
                      onSubmit: _submit,
                    ),
          ),
        ),
      ),
    );
  }

  void _goBack() {
    Navigator.of(context).maybePop();
  }
}

class _Form extends StatelessWidget {
  const _Form({
    required this.selectedTopic,
    required this.topics,
    required this.messageController,
    required this.onTopicSelected,
    required this.onSubmit,
  });

  final String selectedTopic;
  final List<String> topics;
  final TextEditingController messageController;
  final ValueChanged<String> onTopicSelected;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final canSubmit = messageController.text.trim().isNotEmpty;

    return Column(
      key: const ValueKey('feedback-form'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Help shape Cuppet',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: CuppetWorkspaceColors.ink,
            fontSize: 28,
            fontWeight: FontWeight.w800,
            height: 1.08,
            letterSpacing: -0.6,
          ),
        ),
        const SizedBox(height: SydneySpacing.md),
        Text(
          'Tell us what is working, what is not, or what you would love to see next.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: CuppetWorkspaceColors.muted,
            height: 1.45,
          ),
        ),
        const SizedBox(height: SydneySpacing.xl),
        WorkspaceCard(
          padding: const EdgeInsets.all(SydneySpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'What kind of feedback do you have?',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: CuppetWorkspaceColors.ink,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: SydneySpacing.md),
              Wrap(
                spacing: SydneySpacing.sm,
                runSpacing: SydneySpacing.sm,
                children: [
                  for (final topic in topics)
                    ChoiceChip(
                      key: ValueKey('feedback-topic-$topic'),
                      label: Text(topic),
                      selected: selectedTopic == topic,
                      showCheckmark: false,
                      onSelected: (_) => onTopicSelected(topic),
                      selectedColor: CuppetWorkspaceColors.softSage,
                      backgroundColor: CuppetWorkspaceColors.background,
                      side: BorderSide(
                        color:
                            selectedTopic == topic
                                ? CuppetWorkspaceColors.secondary
                                : CuppetWorkspaceColors.border,
                      ),
                      labelStyle: Theme.of(
                        context,
                      ).textTheme.labelMedium?.copyWith(
                        color:
                            selectedTopic == topic
                                ? CuppetWorkspaceColors.primaryInk
                                : CuppetWorkspaceColors.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: SydneySpacing.xl),
              Text(
                'Your feedback',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: CuppetWorkspaceColors.ink,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: SydneySpacing.sm),
              TextField(
                key: const ValueKey('feedback-message-field'),
                controller: messageController,
                minLines: 6,
                maxLines: 9,
                textCapitalization: TextCapitalization.sentences,
                textInputAction: TextInputAction.newline,
                cursorColor: CuppetWorkspaceColors.primary,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: CuppetWorkspaceColors.ink,
                  height: 1.45,
                ),
                decoration: InputDecoration(
                  hintText: 'Share a little detail so we can learn from it…',
                  hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: CuppetWorkspaceColors.muted,
                  ),
                  filled: true,
                  fillColor: CuppetWorkspaceColors.background,
                  alignLabelWithHint: true,
                  contentPadding: const EdgeInsets.all(SydneySpacing.md),
                  border: _fieldBorder(),
                  enabledBorder: _fieldBorder(),
                  focusedBorder: _fieldBorder(
                    color: CuppetWorkspaceColors.primary,
                    width: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: SydneySpacing.lg),
              SizedBox(
                height: 50,
                child: FilledButton.icon(
                  key: const ValueKey('feedback-submit-button'),
                  onPressed: canSubmit ? onSubmit : null,
                  icon: const Icon(Icons.send_rounded, size: 18),
                  label: const Text('Send feedback'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SydneySpacing.lg),
        const WorkspacePrivacyPanel(
          title: 'A thoughtful note goes a long way',
          message:
              'We use feedback to make Cuppet clearer, calmer and more useful. Thanks for helping us build it with care.',
        ),
      ],
    );
  }

  OutlineInputBorder _fieldBorder({
    Color color = CuppetWorkspaceColors.border,
    double width = 1,
  }) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(SydneyRadius.md),
      borderSide: BorderSide(color: color, width: width),
    );
  }
}

class _Confirmation extends StatelessWidget {
  const _Confirmation({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: const ValueKey('feedback-confirmation'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: SydneySpacing.xl),
        Center(
          child: Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(
              color: CuppetWorkspaceColors.softSage,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_rounded,
              size: 34,
              color: CuppetWorkspaceColors.primaryInk,
            ),
          ),
        ),
        const SizedBox(height: SydneySpacing.xl),
        Text(
          'Thanks for helping Cuppet grow.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: CuppetWorkspaceColors.ink,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: SydneySpacing.sm),
        Text(
          'Your note has been captured. We appreciate you taking the time to share it.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: CuppetWorkspaceColors.muted,
            height: 1.45,
          ),
        ),
        const SizedBox(height: SydneySpacing.xl),
        OutlinedButton.icon(
          key: const ValueKey('feedback-back-to-inbox'),
          onPressed: onBack,
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
          label: const Text('Back to inbox'),
        ),
      ],
    );
  }
}

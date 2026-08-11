import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/tokens.dart';
import '../../providers/feedback_provider.dart';
import '../../services/api.dart';
import '../../widgets/cuppet_logo.dart';
import '../../widgets/workspace_primitives.dart';

class FeedbackScreen extends ConsumerStatefulWidget {
  const FeedbackScreen({super.key});

  @override
  ConsumerState<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackTopic {
  const _FeedbackTopic({required this.value, required this.label});

  final String value;
  final String label;
}

class _FeedbackScreenState extends ConsumerState<FeedbackScreen> {
  static const _topics = <_FeedbackTopic>[
    _FeedbackTopic(value: 'product_idea', label: 'Product idea'),
    _FeedbackTopic(
      value: 'something_went_wrong',
      label: 'Something went wrong',
    ),
    _FeedbackTopic(value: 'general_feedback', label: 'General feedback'),
  ];

  late final TextEditingController _messageController;
  _FeedbackTopic _selectedTopic = _topics.first;
  bool _isSubmitting = false;
  bool _submitted = false;
  String? _errorMessage;

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

  Future<void> _submit() async {
    if (_messageController.text.trim().isEmpty || _isSubmitting) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      await ref
          .read(feedbackServiceProvider)
          .submitFeedback(
            topic: _selectedTopic.value,
            message: _messageController.text,
          );
    } catch (error) {
      if (!mounted) return;
      final apiError = apiExceptionFrom(
        error,
        'We could not send your feedback. Please try again.',
      );
      setState(() {
        _isSubmitting = false;
        _errorMessage = apiError.message;
      });
      return;
    }

    if (!mounted) return;
    setState(() {
      _isSubmitting = false;
      _submitted = true;
    });
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
                      errorMessage: _errorMessage,
                      isSubmitting: _isSubmitting,
                      onTopicSelected: (topic) {
                        if (_isSubmitting) return;
                        setState(() {
                          _selectedTopic = topic;
                          _errorMessage = null;
                        });
                      },
                      onBack: _goBack,
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
    required this.errorMessage,
    required this.isSubmitting,
    required this.onTopicSelected,
    required this.onBack,
    required this.onSubmit,
  });

  final _FeedbackTopic selectedTopic;
  final List<_FeedbackTopic> topics;
  final TextEditingController messageController;
  final String? errorMessage;
  final bool isSubmitting;
  final ValueChanged<_FeedbackTopic> onTopicSelected;
  final VoidCallback onBack;
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
                      key: ValueKey('feedback-topic-${topic.label}'),
                      label: Text(topic.label),
                      selected: selectedTopic.value == topic.value,
                      showCheckmark: false,
                      onSelected: (_) => onTopicSelected(topic),
                      selectedColor: CuppetWorkspaceColors.softSage,
                      backgroundColor: CuppetWorkspaceColors.background,
                      side: BorderSide(
                        color:
                            selectedTopic.value == topic.value
                                ? CuppetWorkspaceColors.secondary
                                : CuppetWorkspaceColors.border,
                      ),
                      labelStyle: Theme.of(
                        context,
                      ).textTheme.labelMedium?.copyWith(
                        color:
                            selectedTopic.value == topic.value
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
                enabled: !isSubmitting,
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
              if (errorMessage != null) ...[
                const SizedBox(height: SydneySpacing.md),
                Text(
                  errorMessage!,
                  key: const ValueKey('feedback-error'),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                    height: 1.4,
                  ),
                ),
              ],
              const SizedBox(height: SydneySpacing.lg),
              SizedBox(
                height: 50,
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: OutlinedButton(
                        key: const ValueKey('feedback-back-button'),
                        onPressed: isSubmitting ? null : onBack,
                        child: const Text('Back'),
                      ),
                    ),
                    const SizedBox(width: SydneySpacing.sm),
                    Expanded(
                      flex: 7,
                      child: FilledButton(
                        key: const ValueKey('feedback-submit-button'),
                        onPressed: canSubmit && !isSubmitting ? onSubmit : null,
                        child:
                            isSubmitting
                                ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                                : const Center(
                                  child: Text(
                                    'Send feedback',
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
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

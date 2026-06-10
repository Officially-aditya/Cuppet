import 'package:flutter/material.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../widgets/surface_card.dart';

class AgentCreationDraft {
  const AgentCreationDraft({
    required this.prompt,
    required this.templateId,
    required this.templateLabel,
  });

  final String prompt;
  final String templateId;
  final String templateLabel;
}

class CreateScreen extends StatefulWidget {
  const CreateScreen({super.key});

  @override
  State<CreateScreen> createState() => _CreateScreenState();
}

class _CreateScreenState extends State<CreateScreen> {
  static const _defaultPrompt =
      'Summarize the key points from recent meetings and prepare a draft agenda for tomorrow.';

  late final TextEditingController _promptController;
  final Set<String> _activeCapabilities = {};
  String _selectedTemplate = _capabilities.first.id;
  String? _error;
  bool _dictating = false;
  int _suggestionIndex = 0;

  @override
  void initState() {
    super.initState();
    _promptController = TextEditingController(text: _defaultPrompt);
  }

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        centerTitle: true,
        title: const Text('New agent'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, color: SydneyColors.line),
        ),
        actions: [
          IconButton(
            tooltip: 'More',
            onPressed: () {},
            icon: const Icon(Icons.more_horiz_rounded),
          ),
          const SizedBox(width: SydneySpacing.sm),
        ],
      ),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.lg,
            SydneySpacing.page,
            SydneySpacing.actionFooterHeight + SydneySpacing.lg,
          ),
          children: [
            const _AgentGlyph(),
            const SizedBox(height: SydneySpacing.xl),
            Text(
              'What should this agent handle?',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: SydneySpacing.sm),
            _PromptEditor(
              controller: _promptController,
              dictating: _dictating,
              onDictate: _dictate,
              onSuggest: _suggest,
              onChanged: (_) {
                if (_error != null) {
                  setState(() => _error = null);
                }
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: SydneySpacing.sm),
              Text(
                _error!,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: SydneyColors.danger),
              ),
            ],
            const SizedBox(height: SydneySpacing.xl),
            Text(
              'Common capabilities',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: SydneyColors.mutedInk,
                letterSpacing: 0,
              ),
            ),
            const SizedBox(height: SydneySpacing.md),
            Wrap(
              spacing: SydneySpacing.sm,
              runSpacing: SydneySpacing.sm,
              children: [
                for (final capability in _capabilities)
                  _CapabilityChip(
                    capability: capability,
                    selected: _activeCapabilities.contains(capability.id),
                    onTap: () => _toggleCapability(capability),
                  ),
              ],
            ),
            const SizedBox(height: SydneySpacing.xl),
            SurfaceCard(
              color: SydneyColors.surfaceContainerLow,
              borderColor: SydneyColors.line.withValues(alpha: 0.6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.tune_rounded,
                        color: SydneyColors.mutedInk,
                        size: 18,
                      ),
                      const SizedBox(width: SydneySpacing.sm),
                      Expanded(
                        child: Text(
                          'Agent settings',
                          style: Theme.of(
                            context,
                          ).textTheme.labelSmall?.copyWith(
                            color: SydneyColors.mutedInk,
                            letterSpacing: 0,
                          ),
                        ),
                      ),
                      TextButton(onPressed: () {}, child: const Text('Edit')),
                    ],
                  ),
                  const SizedBox(height: SydneySpacing.sm),
                  const _SettingLine('Runs continuously in background'),
                  const SizedBox(height: SydneySpacing.sm),
                  const _SettingLine('Connects to Inbox and Calendar'),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.md,
            SydneySpacing.page,
            SydneySpacing.lg,
          ),
          decoration: const BoxDecoration(
            color: SydneyColors.surface,
            border: Border(top: BorderSide(color: SydneyColors.line)),
          ),
          child: FilledButton.icon(
            onPressed: _continue,
            icon: const Icon(Icons.arrow_forward_rounded),
            label: const Text('Review agent'),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(54),
              backgroundColor: SydneyColors.primary,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(SydneyRadius.md),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _dictate() async {
    if (_dictating) {
      return;
    }
    setState(() => _dictating = true);
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!mounted) {
      return;
    }
    _promptController.text =
        'Summarize key points from recent meetings and prepare a draft agenda for tomorrow.';
    setState(() => _dictating = false);
  }

  void _suggest() {
    const suggestions = [
      'Track recent calendar events, extract key decision points, and draft a structured agenda for upcoming meetings.',
      'Watch customer feedback for urgent bug reports and flag high priority items.',
      'Summarize the latest category shifts for the market pulse and filter out noise.',
      'Analyze sales pipelines and prepare a briefing summary every Monday morning.',
    ];
    _promptController.text = suggestions[_suggestionIndex % suggestions.length];
    _suggestionIndex += 1;
    setState(() => _error = null);
  }

  void _toggleCapability(_Capability capability) {
    final selected = _activeCapabilities.contains(capability.id);
    final text = _promptController.text;
    setState(() {
      if (selected) {
        _activeCapabilities.remove(capability.id);
        _promptController.text = text.replaceAll(capability.appendText, '');
      } else {
        _activeCapabilities.add(capability.id);
        _selectedTemplate = capability.id;
        _promptController.text = '$text${capability.appendText}';
      }
    });
  }

  void _continue() {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty) {
      setState(() => _error = 'Write one sentence before continuing.');
      return;
    }
    final selected = _capabilities.firstWhere(
      (capability) => capability.id == _selectedTemplate,
      orElse: () => _capabilities.first,
    );
    Navigator.of(context).pushNamed(
      AppRoutes.confirmCreate,
      arguments: AgentCreationDraft(
        prompt: prompt,
        templateId: selected.id,
        templateLabel: selected.label,
      ),
    );
  }
}

class _AgentGlyph extends StatelessWidget {
  const _AgentGlyph();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              color: SydneyColors.primarySoft,
              borderRadius: BorderRadius.circular(SydneyRadius.xxl),
              border: Border.all(color: SydneyColors.line),
            ),
            child: const Icon(
              Icons.smart_toy_outlined,
              color: SydneyColors.primary,
              size: 42,
            ),
          ),
          Positioned(
            top: -3,
            right: -3,
            child: Container(
              width: 25,
              height: 25,
              decoration: BoxDecoration(
                color: SydneyColors.surfaceContainerHighest,
                shape: BoxShape.circle,
                border: Border.all(color: SydneyColors.surface, width: 2),
              ),
              child: const Icon(
                Icons.add_rounded,
                color: SydneyColors.mutedInk,
                size: 16,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PromptEditor extends StatelessWidget {
  const _PromptEditor({
    required this.controller,
    required this.dictating,
    required this.onDictate,
    required this.onSuggest,
    required this.onChanged,
  });

  final TextEditingController controller;
  final bool dictating;
  final VoidCallback onDictate;
  final VoidCallback onSuggest;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        TextField(
          controller: controller,
          minLines: 5,
          maxLines: 7,
          textCapitalization: TextCapitalization.sentences,
          onChanged: onChanged,
          decoration: const InputDecoration(
            hintText:
                'Watch my customer escalations and brief me each morning.',
            contentPadding: EdgeInsets.fromLTRB(16, 16, 88, 52),
          ),
        ),
        Positioned(
          right: SydneySpacing.md,
          bottom: SydneySpacing.md,
          child: Row(
            children: [
              _EditorIconButton(
                tooltip: 'Use microphone',
                icon: Icons.mic_none_rounded,
                active: dictating,
                onPressed: onDictate,
              ),
              const SizedBox(width: SydneySpacing.sm),
              _EditorIconButton(
                tooltip: 'Suggest prompt',
                icon: Icons.auto_awesome_rounded,
                primary: true,
                onPressed: onSuggest,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _EditorIconButton extends StatelessWidget {
  const _EditorIconButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.primary = false,
    this.active = false,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;
  final bool primary;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final color =
        primary ? SydneyColors.primary : SydneyColors.surfaceContainer;
    final foreground = primary ? Colors.white : SydneyColors.mutedInk;
    return Tooltip(
      message: tooltip,
      child: InkResponse(
        onTap: onPressed,
        radius: 20,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: active ? SydneyColors.dangerSoft : color,
            shape: BoxShape.circle,
          ),
          child: Icon(
            icon,
            size: 18,
            color: active ? SydneyColors.danger : foreground,
          ),
        ),
      ),
    );
  }
}

class _CapabilityChip extends StatelessWidget {
  const _CapabilityChip({
    required this.capability,
    required this.selected,
    required this.onTap,
  });

  final _Capability capability;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      selected: selected,
      onSelected: (_) => onTap(),
      avatar: Icon(
        capability.icon,
        size: 17,
        color: selected ? SydneyColors.primary : SydneyColors.subtleInk,
      ),
      label: Text(capability.label),
      labelStyle: Theme.of(context).textTheme.bodySmall?.copyWith(
        color: selected ? SydneyColors.primary : SydneyColors.ink,
        fontWeight: FontWeight.w700,
      ),
      selectedColor: SydneyColors.primarySoft,
      backgroundColor: SydneyColors.surfaceContainerLowest,
      side: BorderSide(
        color: selected ? SydneyColors.primaryFixed : SydneyColors.line,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
      ),
    );
  }
}

class _SettingLine extends StatelessWidget {
  const _SettingLine(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: const BoxDecoration(
            color: SydneyColors.primary,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: SydneySpacing.md),
        Expanded(
          child: Text(
            text,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: SydneyColors.ink,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}

class _Capability {
  const _Capability({
    required this.id,
    required this.label,
    required this.icon,
    required this.appendText,
  });

  final String id;
  final String label;
  final IconData icon;
  final String appendText;
}

const _capabilities = [
  _Capability(
    id: 'summary',
    label: 'Summarize',
    icon: Icons.article_outlined,
    appendText: ' and summarize key discussion points',
  ),
  _Capability(
    id: 'tracker',
    label: 'Track progress',
    icon: Icons.trending_up_rounded,
    appendText: ' and track milestones as we go',
  ),
  _Capability(
    id: 'urgent',
    label: 'Flag urgency',
    icon: Icons.warning_amber_rounded,
    appendText: ' and flag escalations immediately',
  ),
  _Capability(
    id: 'checklist',
    label: 'Checklist',
    icon: Icons.checklist_rounded,
    appendText: ' and prepare a structured todo checklist',
  ),
];

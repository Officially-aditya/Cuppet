import 'package:flutter/material.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../widgets/sydney_primitives.dart';

class AgentCreationDraft {
  const AgentCreationDraft({
    required this.prompt,
    required this.templateId,
    required this.templateLabel,
    this.connectedTools = const ['Gmail', 'Google Calendar'],
    this.responseTiming = 'real-time',
  });

  final String prompt;
  final String templateId;
  final String templateLabel;
  final List<String> connectedTools;
  final String responseTiming;
}

class CreateScreen extends StatefulWidget {
  const CreateScreen({super.key});

  @override
  State<CreateScreen> createState() => _CreateScreenState();
}

class _CreateScreenState extends State<CreateScreen> {
  static const _defaultPrompt =
      'Watch my customer escalations and brief me each morning.';

  late final TextEditingController _promptController;
  final Set<String> _connectedTools = {'Gmail', 'Google Calendar'};
  String _selectedTemplate = 'summary';
  String _responseTiming = 'real-time';
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
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_back_rounded, size: 18),
        ),
        title: const Text('New Agent'),
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
            104,
          ),
          children: [
            Center(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  const SydneyIconBadge(
                    size: 64,
                    color: SydneyColors.primarySoft,
                    foregroundColor: SydneyColors.primary,
                    radius: SydneyRadius.lg,
                    borderColor: SydneyColors.line,
                    child: Icon(Icons.smart_toy_outlined, size: 38),
                  ),
                  Positioned(
                    top: -4,
                    right: -4,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: BoxDecoration(
                        color: SydneyColors.surfaceContainerLowest,
                        shape: BoxShape.circle,
                        border: Border.all(color: SydneyColors.line),
                      ),
                      child: const Icon(
                        Icons.add_rounded,
                        size: 14,
                        color: SydneyColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SydneySpacing.xl),
            const SydneySectionLabel('What should this agent handle?'),
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
                ).textTheme.bodySmall?.copyWith(color: SydneyColors.danger),
              ),
            ],
            const SizedBox(height: SydneySpacing.lg),
            _ConnectedTools(
              selectedTools: _connectedTools,
              onToggle: _toggleTool,
              onManage:
                  () => Navigator.of(context).pushNamed(AppRoutes.connectors),
            ),
            const SizedBox(height: SydneySpacing.lg),
            const SydneySectionLabel('Common capabilities'),
            Wrap(
              spacing: SydneySpacing.sm,
              runSpacing: SydneySpacing.sm,
              children: [
                for (final capability in _capabilities)
                  _CapabilityPill(
                    capability: capability,
                    selected: _selectedTemplate == capability.id,
                    onTap:
                        () => setState(() => _selectedTemplate = capability.id),
                  ),
              ],
            ),
            const SizedBox(height: SydneySpacing.lg),
            SydneyPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.tune_rounded,
                        size: 16,
                        color: SydneyColors.primary,
                      ),
                      const SizedBox(width: SydneySpacing.sm),
                      Text(
                        'Response Timing'.toUpperCase(),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: SydneyColors.primary,
                          letterSpacing: 0.7,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: SydneySpacing.md),
                  _TimingOption(
                    title: 'Real-time',
                    subtitle: 'Get updates as soon as they happen',
                    selected: _responseTiming == 'real-time',
                    onTap: () => setState(() => _responseTiming = 'real-time'),
                  ),
                  const SizedBox(height: SydneySpacing.sm),
                  _TimingOption(
                    title: 'Daily Summary',
                    subtitle: 'Get summaries compiled daily',
                    selected: _responseTiming == 'daily',
                    onTap: () => setState(() => _responseTiming = 'daily'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SydneyFooter(
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).maybePop(),
                style: OutlinedButton.styleFrom(
                  foregroundColor: SydneyColors.onSurface,
                  minimumSize: const Size.fromHeight(48),
                ),
                child: const Text('Cancel'),
              ),
            ),
            const SizedBox(width: SydneySpacing.md),
            Expanded(
              child: FilledButton(
                onPressed: _continue,
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                child: const Text('Submit'),
              ),
            ),
          ],
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
      'Watch my customer escalations and brief me each morning.',
      'Summarize the key points from recent meetings and prepare a draft agenda for tomorrow.',
      'Summarize the latest category shifts for the market pulse.',
      'Track project risks and prepare a concise daily handoff.',
    ];
    _promptController.text = suggestions[_suggestionIndex % suggestions.length];
    _suggestionIndex += 1;
    setState(() => _error = null);
  }

  void _toggleTool(String tool) {
    setState(() {
      if (_connectedTools.contains(tool)) {
        _connectedTools.remove(tool);
      } else {
        _connectedTools.add(tool);
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
        connectedTools: _connectedTools.toList(growable: false),
        responseTiming: _responseTiming,
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
    return SydneyPanel(
      padding: const EdgeInsets.all(SydneySpacing.md),
      shadow: false,
      child: Stack(
        children: [
          TextField(
            controller: controller,
            minLines: 3,
            maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            onChanged: onChanged,
            decoration: const InputDecoration(
              hintText:
                  'Write one sentence to describe what the agent should do...',
              filled: false,
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              contentPadding: EdgeInsets.fromLTRB(0, 0, 48, 44),
            ),
          ),
          Positioned(
            right: 0,
            bottom: 0,
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
                  icon: Icons.send_rounded,
                  primary: true,
                  onPressed: onSuggest,
                ),
              ],
            ),
          ),
        ],
      ),
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
    final foreground = primary ? Colors.white : SydneyColors.outlineVariant;
    return Tooltip(
      message: tooltip,
      child: InkWell(
        borderRadius: BorderRadius.circular(SydneyRadius.sm),
        onTap: onPressed,
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: active ? SydneyColors.dangerSoft : color,
            borderRadius: BorderRadius.circular(SydneyRadius.sm),
          ),
          child: Icon(
            icon,
            size: 16,
            color: active ? SydneyColors.danger : foreground,
          ),
        ),
      ),
    );
  }
}

class _ConnectedTools extends StatelessWidget {
  const _ConnectedTools({
    required this.selectedTools,
    required this.onToggle,
    required this.onManage,
  });

  final Set<String> selectedTools;
  final ValueChanged<String> onToggle;
  final VoidCallback onManage;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            const Expanded(child: SydneySectionLabel('Connected Tools')),
            TextButton(onPressed: onManage, child: const Text('Manage')),
          ],
        ),
        Align(
          alignment: Alignment.centerLeft,
          child: Wrap(
            spacing: SydneySpacing.sm,
            runSpacing: SydneySpacing.sm,
            children: [
              _ToolChip(
                icon: Icons.mail_outline_rounded,
                label: 'Gmail',
                selected: selectedTools.contains('Gmail'),
                onTap: () => onToggle('Gmail'),
              ),
              _ToolChip(
                icon: Icons.calendar_month_outlined,
                label: 'Google Calendar',
                selected: selectedTools.contains('Google Calendar'),
                onTap: () => onToggle('Google Calendar'),
              ),
              OutlinedButton.icon(
                onPressed: onManage,
                icon: const Icon(Icons.add_rounded, size: 14),
                label: const Text('Add'),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(
                    color: SydneyColors.outlineVariant,
                    style: BorderStyle.solid,
                  ),
                  minimumSize: const Size(0, 36),
                  padding: const EdgeInsets.symmetric(
                    horizontal: SydneySpacing.md,
                  ),
                  textStyle: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ToolChip extends StatelessWidget {
  const _ToolChip({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SydneyPanel(
      onTap: onTap,
      shadow: false,
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.md,
        vertical: SydneySpacing.sm,
      ),
      color:
          selected
              ? SydneyColors.primarySoft
              : SydneyColors.surfaceContainerLowest,
      borderColor: selected ? SydneyColors.primary : SydneyColors.line,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 14,
            color:
                selected ? SydneyColors.primary : SydneyColors.onSurfaceVariant,
          ),
          const SizedBox(width: SydneySpacing.sm),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color:
                  selected
                      ? SydneyColors.primary
                      : SydneyColors.onSurfaceVariant,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _CapabilityPill extends StatelessWidget {
  const _CapabilityPill({
    required this.capability,
    required this.selected,
    required this.onTap,
  });

  final _Capability capability;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SydneyPanel(
      onTap: onTap,
      shadow: false,
      radius: SydneyRadius.full,
      padding: const EdgeInsets.symmetric(
        horizontal: SydneySpacing.md,
        vertical: 6,
      ),
      color: SydneyColors.surfaceContainerLow,
      borderColor: selected ? SydneyColors.primary : SydneyColors.line,
      child: Text(
        capability.label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color:
              selected ? SydneyColors.primary : SydneyColors.onSurfaceVariant,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _TimingOption extends StatelessWidget {
  const _TimingOption({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SydneyPanel(
      onTap: onTap,
      shadow: false,
      padding: const EdgeInsets.all(SydneySpacing.md),
      borderColor: selected ? SydneyColors.primary : SydneyColors.line,
      color:
          selected
              ? SydneyColors.primarySoft.withValues(alpha: 0.5)
              : SydneyColors.surfaceContainerLowest,
      child: Row(
        children: [
          _RadioDot(selected: selected),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.labelMedium?.copyWith(color: SydneyColors.ink),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: SydneyColors.mutedInk,
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RadioDot extends StatelessWidget {
  const _RadioDot({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 16,
      height: 16,
      decoration: BoxDecoration(
        color: Colors.transparent,
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? SydneyColors.primary : SydneyColors.outline,
        ),
      ),
      alignment: Alignment.center,
      child:
          selected
              ? Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: SydneyColors.primary,
                  shape: BoxShape.circle,
                ),
              )
              : null,
    );
  }
}

class _Capability {
  const _Capability({required this.id, required this.label});

  final String id;
  final String label;
}

const _capabilities = [
  _Capability(id: 'summary', label: 'Summarize'),
  _Capability(id: 'tracker', label: 'Track progress'),
  _Capability(id: 'urgent', label: 'Flag urgency'),
  _Capability(id: 'checklist', label: 'Checklist'),
];

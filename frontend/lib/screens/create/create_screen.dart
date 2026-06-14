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
  late final TextEditingController _promptController;
  String _selectedTemplate = 'custom';
  String? _error;

  @override
  void initState() {
    super.initState();
    _promptController = TextEditingController();
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
            const SydneySectionLabel('What does this agent do?'),
            _PromptEditor(
              controller: _promptController,
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
            const SydneySectionLabel('Examples'),
            Column(
              children: [
                for (final template in _agentTemplates) ...[
                  _AgentTemplateCard(
                    template: template,
                    selected: _selectedTemplate == template.id,
                    onTap: () => _selectTemplate(template),
                  ),
                  const SizedBox(height: SydneySpacing.sm),
                ],
              ],
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

  void _selectTemplate(_AgentTemplate template) {
    setState(() {
      _selectedTemplate = template.id;
      _promptController.text = template.prompt;
      _error = null;
    });
  }

  void _continue() {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty) {
      setState(() => _error = 'Describe what this agent should do.');
      return;
    }
    final selected = _agentTemplates.firstWhere(
      (template) => template.id == _selectedTemplate,
      orElse: () => _customTemplate,
    );
    Navigator.of(context).pushNamed(
      AppRoutes.confirmCreate,
      arguments: AgentCreationDraft(
        prompt: prompt,
        templateId: selected.id,
        templateLabel: selected.label,
        connectedTools: selected.connectedTools,
        responseTiming: 'scheduled',
      ),
    );
  }
}

class _PromptEditor extends StatelessWidget {
  const _PromptEditor({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SydneyPanel(
      padding: const EdgeInsets.all(SydneySpacing.md),
      shadow: false,
      child: TextField(
        controller: controller,
        minLines: 7,
        maxLines: 12,
        textCapitalization: TextCapitalization.sentences,
        onChanged: onChanged,
        decoration: const InputDecoration(
          hintText: 'What does this agent do?',
          filled: false,
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          contentPadding: EdgeInsets.zero,
        ),
      ),
    );
  }
}

class _AgentTemplateCard extends StatelessWidget {
  const _AgentTemplateCard({
    required this.template,
    required this.selected,
    required this.onTap,
  });

  final _AgentTemplate template;
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
              ? SydneyColors.primarySoft.withValues(alpha: 0.65)
              : SydneyColors.surfaceContainerLowest,
      child: Row(
        children: [
          SydneyIconBadge(
            size: 40,
            color:
                selected
                    ? SydneyColors.surfaceContainerLowest
                    : SydneyColors.primarySoft,
            foregroundColor: SydneyColors.primary,
            radius: SydneyRadius.sm,
            borderColor: SydneyColors.line,
            child: Icon(template.icon, size: 20),
          ),
          const SizedBox(width: SydneySpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  template.label,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: SydneyColors.ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  template.description,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: SydneyColors.mutedInk,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            selected ? Icons.check_circle_rounded : Icons.add_circle_outline,
            size: 20,
            color: selected ? SydneyColors.primary : SydneyColors.outline,
          ),
        ],
      ),
    );
  }
}

class _AgentTemplate {
  const _AgentTemplate({
    required this.id,
    required this.label,
    required this.description,
    required this.icon,
    required this.prompt,
    this.connectedTools = const [],
  });

  final String id;
  final String label;
  final String description;
  final IconData icon;
  final String prompt;
  final List<String> connectedTools;
}

const _customTemplate = _AgentTemplate(
  id: 'custom',
  label: 'Custom agent',
  description: 'Write your own prompt from scratch.',
  icon: Icons.smart_toy_outlined,
  prompt: '',
);

const _agentTemplates = [
  _AgentTemplate(
    id: 'news',
    label: 'News agent',
    description:
        'A balanced daily newsletter with TL;DR, context, and sources.',
    icon: Icons.newspaper_rounded,
    prompt: '''
I need a quick, unbiased breakdown of news from the last 48 hours. Please format it like a smart, easy-to-read daily newsletter. Make a good balance of local news based on where I am and global news.

Include these sections:
1. The TL;DR: 3 short bullet points on the most important things that actually happened in the last 24 hours.
2. The Two Sides: Briefly explain what the main opposing sides are saying. Put this in a simple comparison table so it is easy to scan.
3. Why It Matters: One short paragraph explaining the ripple effect, such as how this impacts the economy, global politics, or everyday people.
4. How We Got Here: A quick chronological timeline of the 3 main events that led up to today.

Keep the language plain, conversational, and accessible. Pull facts from reliable news wires and explicitly call out if something is just an unverified rumor. Schedule this agent at 6 AM every day.''',
  ),
  _AgentTemplate(
    id: 'email',
    label: 'Email agent',
    description: 'Summarizes Gmail into a useful digest with action items.',
    icon: Icons.mail_outline_rounded,
    connectedTools: ['Gmail'],
    prompt: '''
Create a Gmail digest agent that summarizes my inbox every day at 6 PM.

Focus on messages that need attention, bills or receipts, calendar-related updates, and anything time-sensitive. Group the output into clear sections, keep it concise, and include sender names only when useful. End with a short action list of what I should reply to or handle first.''',
  ),
  _AgentTemplate(
    id: 'reminder',
    label: 'Reminder agent',
    description: 'A simple scheduled nudge for habits, tasks, or follow-ups.',
    icon: Icons.notifications_none_rounded,
    prompt: '''
Create a reminder agent that reminds me to code every day at 9 PM.

Keep the message short, direct, and encouraging. Include one tiny next step so I can start without thinking too much.''',
  ),
  _AgentTemplate(
    id: 'dsa',
    label: 'DSA agent',
    description: 'Sends one useful coding question with constraints and hints.',
    icon: Icons.code_rounded,
    prompt: '''
Create a DSA practice agent that sends me one question every day at 9 PM.

Include the problem statement, input and output format, constraints, 2 examples, and one optional hint. Rotate between arrays, strings, hash maps, trees, graphs, dynamic programming, and greedy problems. Keep the difficulty mostly medium unless I ask otherwise.''',
  ),
  _AgentTemplate(
    id: 'market',
    label: 'Market watch',
    description: 'Tracks a stock or portfolio and explains important movement.',
    icon: Icons.show_chart_rounded,
    prompt: '''
Create an agent that watches major updates for my portfolio and gives me a clear explanation when something important happens.

Focus on material price movement, earnings, regulatory updates, major news, and sentiment shifts. Do not invent market data. If a reliable connector or data source is missing, tell me what needs to be connected before running.''',
  ),
];

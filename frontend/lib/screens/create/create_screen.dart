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
      backgroundColor: SydneyColors.surface,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: SydneyColors.surface.withValues(alpha: 0.95),
        scrolledUnderElevation: 0,
        elevation: 0,
        leadingWidth: 56,
        leading: Padding(
          padding: const EdgeInsets.only(left: 16),
          child: Center(
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: SydneyColors.line),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x04000000),
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              child: IconButton(
                padding: EdgeInsets.zero,
                tooltip: 'Back',
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_rounded, size: 18, color: SydneyColors.ink),
              ),
            ),
          ),
        ),
        titleSpacing: 12,
        title: Text(
          'New Agent',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: SydneyColors.ink,
                letterSpacing: -0.5,
              ),
        ),
      ),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.md,
            SydneySpacing.page,
            104,
          ),
          children: [
            const SydneySectionLabel('What does this agent do?'),
            const SizedBox(height: SydneySpacing.sm),
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
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: SydneyColors.danger),
              ),
            ],
            const SizedBox(height: SydneySpacing.lg),
            const SydneySectionLabel('Examples'),
            const SizedBox(height: SydneySpacing.sm),
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
                  foregroundColor: SydneyColors.ink,
                  side: const BorderSide(color: SydneyColors.line),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
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
                  backgroundColor: SydneyColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
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
    return Container(
      decoration: BoxDecoration(
        color: SydneyColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF17201C).withValues(alpha: 0.05),
            offset: const Offset(4, 4),
            blurRadius: 8,
          ),
          const BoxShadow(
            color: Colors.white,
            offset: Offset(-4, -4),
            blurRadius: 8,
          ),
        ],
        border: Border.all(
          color: SydneyColors.line.withValues(alpha: 0.35),
          width: 0.8,
        ),
      ),
      padding: const EdgeInsets.all(SydneySpacing.md),
      child: TextField(
        controller: controller,
        minLines: 7,
        maxLines: 12,
        textCapitalization: TextCapitalization.sentences,
        onChanged: onChanged,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: SydneyColors.ink,
              height: 1.4,
            ),
        decoration: const InputDecoration(
          hintText: 'What should this agent do?',
          hintStyle: TextStyle(color: SydneyColors.subtleInk),
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
    return Container(
      decoration: BoxDecoration(
        color: selected ? SydneyColors.primarySoft.withValues(alpha: 0.35) : SydneyColors.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: selected
                ? SydneyColors.primary.withValues(alpha: 0.06)
                : const Color(0xFF17201C).withValues(alpha: 0.04),
            offset: const Offset(4, 4),
            blurRadius: 8,
          ),
          const BoxShadow(
            color: Colors.white,
            offset: Offset(-4, -4),
            blurRadius: 8,
          ),
        ],
        border: Border.all(
          color: selected ? SydneyColors.primary.withValues(alpha: 0.5) : SydneyColors.line.withValues(alpha: 0.35),
          width: selected ? 1.2 : 0.8,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: selected ? SydneyColors.surfaceContainerLowest : SydneyColors.primarySoft,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: SydneyColors.line.withValues(alpha: 0.35),
                      width: 0.8,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    template.icon,
                    size: 18,
                    color: SydneyColors.primary,
                  ),
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
                const SizedBox(width: SydneySpacing.sm),
                Icon(
                  selected ? Icons.check_circle_rounded : Icons.add_circle_outline,
                  size: 20,
                  color: selected ? SydneyColors.primary : SydneyColors.subtleInk,
                ),
              ],
            ),
          ),
        ),
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
    description: 'A balanced daily newsletter with TL;DR, context, and sources.',
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

Focus on unread or important messages, direct questions awaiting a reply, bills or receipts, account and security alerts, and time-sensitive messages. Use only Gmail data. Group the output into clear sections, keep it concise, and include sender names only when useful. End with a short action list of what I should reply to or handle first.''',
  ),
  _AgentTemplate(
    id: 'calendar',
    label: 'Calendar agent',
    description: 'Turns upcoming Google Calendar events into a concise agenda.',
    icon: Icons.calendar_month_outlined,
    connectedTools: ['Google Calendar'],
    prompt: '''
Create a Google Calendar agenda agent that summarizes my upcoming events every morning at 7 AM.

Show the event time, title, and location when available. Keep the agenda concise, use only Google Calendar data, and do not create, edit, or delete events.''',
  ),
  _AgentTemplate(
    id: 'github',
    label: 'GitHub agent',
    description: 'Summarizes repository, issue, and pull-request activity.',
    icon: Icons.code_rounded,
    connectedTools: ['GitHub'],
    prompt: '''
Create a GitHub activity agent that sends me a concise digest every morning at 9 AM.

Show recently updated repositories, open issues involving me, and open pull requests involving me. Use only GitHub data, include repository names, and do not create, edit, merge, or close anything.''',
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

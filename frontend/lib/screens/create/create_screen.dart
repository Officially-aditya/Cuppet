import 'package:flutter/material.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../widgets/workspace_primitives.dart';
import 'creation_workspace_widgets.dart';

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
      key: const ValueKey('create-agent-screen'),
      backgroundColor: CuppetWorkspaceColors.background,
      appBar: CreationBackAppBar(
        backButtonKey: const ValueKey('create-agent-back'),
        onBack: () => Navigator.of(context).maybePop(),
      ),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.xs,
            SydneySpacing.page,
            SydneySpacing.xl,
          ),
          children: [
            Text(
              'Agent setup',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: CuppetWorkspaceColors.primaryInk,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.2,
              ),
            ),
            const SizedBox(height: SydneySpacing.sm),
            Text(
              'Create an agent',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: CuppetWorkspaceColors.ink,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                height: 1.05,
                letterSpacing: -0.7,
              ),
            ),
            const SizedBox(height: SydneySpacing.sm),
            Text(
              'Describe the work in your own words, or begin with an example.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: CuppetWorkspaceColors.muted,
                height: 1.35,
              ),
            ),
            const SizedBox(height: SydneySpacing.xl),
            const WorkspaceSectionLabel('Describe the work'),
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
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: SydneyColors.danger),
              ),
            ],
            const SizedBox(height: SydneySpacing.xl),
            const WorkspaceSectionLabel('Start with an example'),
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
      bottomNavigationBar: CreationFooter(
        secondaryLabel: 'Cancel',
        onSecondary: () => Navigator.of(context).maybePop(),
        primaryLabel: 'Continue',
        onPrimary: _continue,
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
    return WorkspaceCard(
      key: const ValueKey('creation-prompt-card'),
      padding: const EdgeInsets.all(SydneySpacing.md),
      child: TextField(
        controller: controller,
        minLines: 6,
        maxLines: 12,
        textCapitalization: TextCapitalization.sentences,
        onChanged: onChanged,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: CuppetWorkspaceColors.ink,
          height: 1.4,
        ),
        decoration: const InputDecoration(
          hintText: 'For example: Send me a concise news brief every morning.',
          hintStyle: TextStyle(color: CuppetWorkspaceColors.muted),
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
    return WorkspaceCard(
      key: ValueKey('agent-template-${template.id}'),
      color:
          selected
              ? CuppetWorkspaceColors.softSage
              : CuppetWorkspaceColors.card,
      borderColor:
          selected
              ? CuppetWorkspaceColors.panelBorder
              : CuppetWorkspaceColors.border,
      padding: const EdgeInsets.all(14),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color:
                  selected
                      ? CuppetWorkspaceColors.card
                      : CuppetWorkspaceColors.background,
              borderRadius: BorderRadius.circular(SydneyRadius.md),
            ),
            alignment: Alignment.center,
            child: Icon(
              template.icon,
              size: 20,
              color: CuppetWorkspaceColors.primaryInk,
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
                    color: CuppetWorkspaceColors.ink,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  template.description,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: CuppetWorkspaceColors.muted,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: SydneySpacing.sm),
          Icon(
            selected ? Icons.check_circle_rounded : Icons.chevron_right_rounded,
            size: 21,
            color:
                selected
                    ? CuppetWorkspaceColors.primaryInk
                    : CuppetWorkspaceColors.muted,
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
Create an agent that watches major updates for stocks like RIL, TCS, MRF every weekday at 4 PM and gives me a clear explanation when something important happens.

Focus on material price movement, earnings, regulatory updates, major news, and sentiment shifts. Do not invent market data. If a reliable connector or data source is missing, tell me what needs to be connected before running.''',
  ),
  _AgentTemplate(
    id: 'content_extractor',
    label: 'Content extractor',
    description:
        'Finds trending topics and drafts Reddit, LinkedIn, or Twitter posts.',
    icon: Icons.post_add_rounded,
    prompt: '''
Create a content extractor agent that searches the web every day at 8 AM for the latest trending topics in my niche to write Twitter posts.

Provide 3 distinct content ideas first. Each idea should have a title and a brief hook. Let me select an idea to generate a complete draft for it.''',
  ),
  _AgentTemplate(
    id: 'daily_briefing',
    label: 'Daily briefing',
    description: 'Calendar, important email, and Slack in one focused card.',
    icon: Icons.space_dashboard_outlined,
    connectedTools: ['Google Calendar', 'Gmail', 'Slack'],
    prompt: '''
Create a daily executive briefing agent using my Google Calendar, Gmail, and Slack every weekday at 7 AM.

Show what is happening today, what needs attention, and the few things I should prioritize. Present it as one concise briefing card and never invent missing information.''',
  ),
  _AgentTemplate(
    id: 'project_pulse',
    label: 'Project pulse',
    description:
        'GitHub, Slack, Notion, and Drive activity in one project view.',
    icon: Icons.monitor_heart_outlined,
    connectedTools: ['GitHub', 'Slack', 'Notion', 'Google Drive'],
    prompt: '''
Create a project pulse agent using GitHub, Slack, Notion, and Google Drive every weekday at 9 AM.

Show what moved, notable decisions, documentation changes, and anything blocked or needing attention. Present it as a structured briefing card.''',
  ),
  _AgentTemplate(
    id: 'meeting_intelligence',
    label: 'Meeting intelligence',
    description:
        'Calendar events enriched with relevant email and workspace context.',
    icon: Icons.co_present_outlined,
    connectedTools: ['Google Calendar', 'Gmail', 'Google Drive', 'Notion'],
    prompt: '''
Create a meeting intelligence agent using my Calendar, Gmail, Drive meeting notes, and Notion every weekday at 7 AM.

Give me the context I need before upcoming conversations, grouped by source in a concise briefing card.''',
  ),
  _AgentTemplate(
    id: 'weekly_review',
    label: 'Weekly accomplishments',
    description: 'An evidence-based review across your connected work tools.',
    icon: Icons.workspace_premium_outlined,
    connectedTools: ['Slack', 'GitHub', 'Google Drive', 'Notion'],
    prompt: '''
Create a weekly accomplishment report using Slack, GitHub, Google Drive, and Notion every Friday at 5 PM.

Show what I contributed, what changed, and the strongest evidence of progress. Present it as a structured weekly review card.''',
  ),
];

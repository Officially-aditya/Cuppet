import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/routes.dart';
import '../../design/tokens.dart';
import '../../models/agent_recipe.dart';
import '../../providers/agents_provider.dart';
import '../../widgets/workspace_primitives.dart';
import 'creation_workspace_widgets.dart';

class AgentCreationDraft {
  const AgentCreationDraft({
    required this.prompt,
    required this.templateId,
    required this.templateLabel,
    this.connectedTools = const ['Gmail', 'Google Calendar'],
    this.responseTiming = 'real-time',
    this.recipeId,
    this.recipeVersion,
    this.recipeInputs = const {},
    this.recipeFields = const [],
  });

  final String prompt;
  final String templateId;
  final String templateLabel;
  final List<String> connectedTools;
  final String responseTiming;
  final String? recipeId;
  final int? recipeVersion;
  final Map<String, dynamic> recipeInputs;
  final List<AgentRecipeField> recipeFields;
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
  String? _recipeLoadError;
  List<_AgentTemplate> _templates = const [_customTemplate];
  Map<String, dynamic> _recipeInputs = {};

  @override
  void initState() {
    super.initState();
    _promptController = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRecipes());
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
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            SydneySpacing.page,
            SydneySpacing.md,
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
            if (_recipeLoadError != null) ...[
              WorkspaceCard(
                key: const ValueKey('recipe-load-error'),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Templates could not be loaded. You can create a custom agent or retry.',
                      ),
                    ),
                    TextButton(
                      onPressed: _loadRecipes,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SydneySpacing.sm),
            ],
            Column(
              children: [
                for (final template in _templates) ...[
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
      _recipeInputs = Map<String, dynamic>.from(template.defaultInputs);
      _error = null;
    });
  }

  Future<void> _loadRecipes() async {
    ProviderContainer container;
    try {
      container = ProviderScope.containerOf(context, listen: false);
    } catch (_) {
      if (!mounted) return;
      setState(() => _recipeLoadError = 'recipes_unavailable');
      return;
    }
    try {
      final recipes = await container.read(agentServiceProvider).listRecipes();
      if (!mounted) return;
      setState(() {
        _templates = [
          _customTemplate,
          ...recipes.map(_AgentTemplate.fromRecipe),
        ];
        _recipeLoadError = null;
        if (!_templates.any((template) => template.id == _selectedTemplate)) {
          _selectedTemplate = 'custom';
          _recipeInputs = {};
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _templates = const [_customTemplate];
        _selectedTemplate = 'custom';
        _recipeInputs = {};
        _recipeLoadError = 'recipes_unavailable';
      });
    }
  }

  void _continue() {
    final prompt = _promptController.text.trim();
    if (prompt.isEmpty) {
      setState(() => _error = 'Describe what this agent should do.');
      return;
    }
    final selected = _templates.firstWhere(
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
        recipeId: selected.recipeId,
        recipeVersion: selected.recipeVersion,
        recipeInputs: Map<String, dynamic>.from(_recipeInputs),
        recipeFields: selected.fields,
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
        onChanged: (next) => onChanged(next),
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
    this.recipeId,
    this.recipeVersion,
    this.fields = const [],
    this.defaultInputs = const {},
  });

  factory _AgentTemplate.fromRecipe(AgentRecipe recipe) {
    return _AgentTemplate(
      id: _templateUiId(recipe.id),
      label: recipe.name,
      description: recipe.description,
      icon: _recipeIcon(recipe.icon),
      prompt: recipe.examplePrompt,
      connectedTools: recipe.requiredConnectors
          .map(_connectorLabel)
          .toList(growable: false),
      recipeId: recipe.id,
      recipeVersion: recipe.version,
      fields: recipe.fields,
      defaultInputs: recipe.defaultInputs,
    );
  }

  final String id;
  final String label;
  final String description;
  final IconData icon;
  final String prompt;
  final List<String> connectedTools;
  final String? recipeId;
  final int? recipeVersion;
  final List<AgentRecipeField> fields;
  final Map<String, dynamic> defaultInputs;
}

const _customTemplate = _AgentTemplate(
  id: 'custom',
  label: 'Custom agent',
  description: 'Write your own prompt from scratch.',
  icon: Icons.smart_toy_outlined,
  prompt: '',
);

String _templateUiId(String recipeId) {
  return const {
        'news_brief': 'news',
        'email_digest': 'email',
        'calendar_agenda': 'calendar',
        'github_activity_digest': 'github',
        'scheduled_reminder': 'reminder',
        'dsa_question': 'dsa',
        'portfolio_watch': 'market',
        'daily_executive_briefing': 'daily_briefing',
        'weekly_accomplishment_report': 'weekly_review',
      }[recipeId] ??
      recipeId;
}

String _connectorLabel(String connector) {
  return const {
        'gmail': 'Gmail',
        'calendar': 'Google Calendar',
        'github': 'GitHub',
        'slack': 'Slack',
        'notion': 'Notion',
        'drive': 'Google Drive',
        'web_search': 'Web search',
      }[connector] ??
      connector;
}

IconData _recipeIcon(String icon) {
  return switch (icon) {
    'newspaper' => Icons.newspaper_rounded,
    'mail' => Icons.mail_outline_rounded,
    'calendar' => Icons.calendar_month_outlined,
    'github' || 'code' => Icons.code_rounded,
    'bell' => Icons.notifications_none_rounded,
    'line-chart' => Icons.show_chart_rounded,
    'post-add' => Icons.post_add_rounded,
    'layout-dashboard' => Icons.space_dashboard_outlined,
    'activity' => Icons.monitor_heart_outlined,
    'presentation' => Icons.co_present_outlined,
    'award' => Icons.workspace_premium_outlined,
    'book-open' => Icons.menu_book_outlined,
    _ => Icons.smart_toy_outlined,
  };
}

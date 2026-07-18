import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/agent_recipe.dart';
import 'package:sydney/services/agent_service.dart';
import 'package:sydney/widgets/templates/briefing_card_template.dart';
import 'package:sydney/widgets/templates/content_extractor_template.dart';
import 'package:sydney/widgets/templates/data_summary_template.dart';
import 'package:sydney/widgets/templates/news_brief_template.dart';
import 'package:sydney/widgets/templates/portfolio_watch_template.dart';

void main() {
  test('recipe descriptors and structured create requests retain versions', () {
    final recipe = AgentRecipe.fromJson({
      'recipe_id': 'news_brief',
      'recipe_version': 2,
      'prompt_profile_version': 3,
      'display': {
        'name': 'News agent',
        'description': 'Ranked news',
        'icon': 'newspaper',
        'example_prompt':
            'Create a News agent agent. Run it on schedule 0 18 * * *.',
      },
      'required_connectors': ['web_search'],
      'fields': [
        {
          'id': 'freshness',
          'label': 'Freshness',
          'type': 'enum',
          'required': true,
          'default_value': '48_hours',
          'options': [
            {'value': '48_hours', 'label': '48 Hours'},
          ],
        },
      ],
    });
    expect(recipe.id, 'news_brief');
    expect(recipe.defaultInputs, {'freshness': '48_hours'});
    expect(
      recipe.examplePrompt,
      'Create a News agent. Run it daily at 6:00 PM.',
    );

    final oldRequest = const CreateAgentRequest(
      prompt: 'Custom prompt',
      templateId: 'custom',
    );
    expect(oldRequest.toJson(), {'prompt': 'Custom prompt'});
    final customDraftRequest = const CreateAgentRequest(
      prompt: 'Custom prompt',
      templateId: 'custom',
      recipeVersion: 1,
      recipeInputs: {},
    );
    expect(customDraftRequest.toJson(), {'prompt': 'Custom prompt'});

    final structured = CreateAgentRequest(
      prompt: recipe.examplePrompt,
      templateId: 'news',
      recipeId: recipe.id,
      recipeVersion: recipe.version,
      recipeInputs: recipe.defaultInputs,
    );
    expect(structured.toJson()['recipe_id'], 'news_brief');
    expect(structured.toJson()['recipe_version'], 2);
    expect(structured.toJson()['recipe_inputs'], {'freshness': '48_hours'});
  });

  testWidgets('extended output fields render while old contracts stay intact', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                NewsBriefTemplate(
                  data: {
                    'title': 'Daily news',
                    'tldr': ['One', 'Two', 'Three'],
                    'items': [
                      {'headline': 'Lead', 'summary': 'Grounded summary'},
                    ],
                    'why_it_matters': 'Material context',
                    'timeline': [
                      {'date': 'Today', 'event': 'Lead event'},
                    ],
                  },
                ),
                DataSummaryTemplate(
                  data: {
                    'title': 'Inbox',
                    'action_items': ['Reply to Ada'],
                  },
                ),
                ContentExtractorTemplate(
                  data: {
                    'ideas': [
                      {
                        'title': 'Idea',
                        'hook': 'Hook',
                        'angle': 'Practical angle',
                        'audience_value': 'Saves time',
                        'evidence_summary': 'Current source',
                      },
                    ],
                  },
                ),
                BriefingCardTemplate(
                  data: {
                    'eyebrow': 'Today',
                    'title': 'Briefing',
                    'summary': 'Summary',
                    'sections': [],
                    'priorities': ['Reply first'],
                    'cross_source_insights': ['Same launch'],
                    'conflicts': ['Two deadlines'],
                  },
                ),
                PortfolioWatchTemplate(
                  data: {
                    'title': 'Portfolio',
                    'text': 'Prices checked',
                    'stocks': [],
                    'footer': 'Source',
                    'as_of': '2026-07-17',
                    'data_quality': {'status': 'partial'},
                    'material_events': [
                      {
                        'ticker': 'TCS',
                        'category': 'earnings',
                        'headline': 'Results published',
                      },
                    ],
                    'drivers': ['Earnings evidence'],
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );

    for (final text in [
      'TL;DR',
      'Why it matters',
      'ACTION ITEMS',
      'Practical angle',
      'Priorities',
      'Cross-source insights',
      'MATERIAL EVENTS',
      'Results published',
    ]) {
      expect(find.textContaining(text, findRichText: true), findsOneWidget);
    }
  });
}

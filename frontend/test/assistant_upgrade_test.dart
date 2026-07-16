import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/assistant_memory.dart';
import 'package:sydney/providers/memory_provider.dart';
import 'package:sydney/screens/settings/memory_screen.dart';
import 'package:sydney/widgets/templates/daily_task_template.dart';
import 'package:sydney/widgets/templates/plain_text_template.dart';

void main() {
  testWidgets('message attachment metadata renders as an attachment chip', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PlainTextTemplate(
            data: {
              'body': 'Please review this.',
              'attachments': [
                {
                  'id': 'file-1',
                  'name': 'launch-plan.pdf',
                  'mime_type': 'application/pdf',
                  'size': 1024,
                },
              ],
            },
          ),
        ),
      ),
    );

    expect(find.text('launch-plan.pdf'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('message-attachment-file-1')),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.description_outlined), findsOneWidget);
  });

  testWidgets('Assistant confirmation actions preserve pending action data', (
    tester,
  ) async {
    Map<String, dynamic>? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: DailyTaskTemplate(
            data: const {
              'title': 'Delete News Agent?',
              'task': 'Deletion is permanent.',
              'actions': [
                {
                  'id': 'assistant_confirm',
                  'type': 'assistant_pending_action',
                  'decision': 'confirm',
                  'pending_action_id': 'pending-1',
                  'label': 'Delete agent',
                  'style': 'primary',
                },
                {
                  'id': 'assistant_cancel',
                  'type': 'assistant_pending_action',
                  'decision': 'cancel',
                  'pending_action_id': 'pending-1',
                  'label': 'Cancel',
                },
              ],
            },
            onAction: (action) => selected = action,
          ),
        ),
      ),
    );

    await tester.tap(find.text('Delete agent'));
    expect(selected?['decision'], 'confirm');
    expect(selected?['pending_action_id'], 'pending-1');
  });

  testWidgets('Memory settings lists and protects bulk deletion', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          assistantMemoriesProvider.overrideWith(
            (ref) async => const [
              AssistantMemory(
                id: 'memory-1',
                canonicalKey: 'preference:response_style',
                type: 'preference',
                text: 'I prefer concise answers',
                reinforcementCount: 2,
              ),
            ],
          ),
        ],
        child: const MaterialApp(home: MemoryScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('I prefer concise answers'), findsOneWidget);
    expect(find.byTooltip('Delete memory'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('delete-all-memories')));
    await tester.pumpAndSettle();
    expect(find.text('Delete all memories?'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('confirm-delete-all-memories')),
      findsOneWidget,
    );
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/assistant_memory.dart';
import 'package:sydney/providers/memory_provider.dart';
import 'package:sydney/screens/settings/memory_screen.dart';
import 'package:sydney/widgets/templates/daily_task_template.dart';
import 'package:sydney/widgets/templates/plain_text_template.dart';
import 'package:sydney/widgets/sydney_primitives.dart';

void main() {
  testWidgets('Recoverable error states use calm retry presentation', (
    tester,
  ) async {
    var retried = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SydneyErrorState(
            title: 'Conversation couldn’t load',
            message: 'Check your connection and try again.',
            onRetry: () => retried = true,
          ),
        ),
      ),
    );

    expect(find.byIcon(Icons.schedule_rounded), findsOneWidget);
    expect(find.byIcon(Icons.error_outline_rounded), findsNothing);
    await tester.tap(find.text('Try again'));
    expect(retried, isTrue);
  });

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
              'pending_action_id': 'pending-1',
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
    await tester.pump();
    expect(selected?['decision'], 'confirm');
    expect(selected?['pending_action_id'], 'pending-1');
    expect(find.text('Delete agent'), findsNothing);
    expect(find.text('Cancel'), findsNothing);
    expect(find.text('Request submitted'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('resolved-daily-task-action')),
      findsOneWidget,
    );
  });

  testWidgets('Resolved delete confirmation remains hidden after refresh', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: DailyTaskTemplate(
            data: {
              'title': 'Delete News Agent?',
              'task': 'Deletion is permanent.',
              'pending_action_id': 'pending-1',
              'resolved': true,
              'resolution': 'confirmed',
              'result_label': 'Deleted News Agent',
              'actions': [],
            },
          ),
        ),
      ),
    );

    expect(find.text('Delete agent'), findsNothing);
    expect(find.text('Cancel'), findsNothing);
    expect(find.text('Deleted News Agent'), findsOneWidget);
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
          compactedMemoryProvider.overrideWith(
            (ref) async => const CompactedMemory(
              summary: '- preference:theme [confirmed]: Prefers dark mode',
              itemCount: 1,
            ),
          ),
        ],
        child: const MaterialApp(home: MemoryScreen()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('I prefer concise answers'), findsOneWidget);
    expect(find.byTooltip('Delete memory'), findsOneWidget);
    expect(find.text('Compacted memory'), findsOneWidget);
    expect(find.textContaining('Prefers dark mode'), findsOneWidget);
    await tester.tap(find.byTooltip('Delete compacted memory'));
    await tester.pumpAndSettle();
    expect(find.text('Delete compacted memory?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('delete-all-memories')));
    await tester.pumpAndSettle();
    expect(find.text('Delete all memories?'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('confirm-delete-all-memories')),
      findsOneWidget,
    );
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/design/tokens.dart';
import 'package:sydney/widgets/thread/sydney_heatmap.dart';

void main() {
  final today = DateTime(2026, 7, 15);

  Widget host(Widget child) {
    return MaterialApp(
      home: Scaffold(
        body: Align(alignment: Alignment.bottomCenter, child: child),
      ),
    );
  }

  void useNarrowViewport(WidgetTester tester) {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets('heatmap sheet uses a compact Cuppet progress hierarchy', (
    tester,
  ) async {
    useNarrowViewport(tester);

    await tester.pumpWidget(
      host(
        SydneyHeatmapSheet(
          agentName:
              'A deliberately long DSA practice agent name for narrow phones',
          intent: 'dsa_question',
          now: today,
          history: const {
            '2026-07-15': true,
            '2026-07-14': true,
            '2026-07-13': true,
            '2026-07-12': false,
            '2026-05-01': true,
          },
        ),
      ),
    );

    expect(find.text('DSA practice'), findsOneWidget);
    expect(find.text('Problems solved'), findsOneWidget);
    expect(find.text('Day streak'), findsOneWidget);
    expect(find.text('No activity'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('Less'), findsNothing);
    expect(find.text('More'), findsNothing);
    expect(find.textContaining('Great start'), findsNothing);

    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey('heatmap-metric-total')))
          .data,
      '4',
    );
    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey('heatmap-metric-streak')))
          .data,
      '3',
    );
    expect(
      tester.getSize(find.byKey(const ValueKey('heatmap-sheet'))).width,
      320,
    );
    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget.key is ValueKey<String> &&
            (widget.key! as ValueKey<String>).value.startsWith('heatmap-day-'),
      ),
      findsNWidgets(112),
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('heatmap cells distinguish completed missed and future dates', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        SydneyHeatmapSheet(
          agentName: 'Habit Agent',
          intent: 'habit_tracker',
          now: today,
          history: const {
            '2026-07-14': true,
            '2026-07-16': true,
            'not-a-date': true,
          },
        ),
      ),
    );

    final completed = tester.widget<Container>(
      find.byKey(const ValueKey('heatmap-day-2026-07-14')),
    );
    final missed = tester.widget<Container>(
      find.byKey(const ValueKey('heatmap-day-2026-07-13')),
    );
    final future = tester.widget<Container>(
      find.byKey(const ValueKey('heatmap-day-2026-07-16')),
    );

    expect(
      (completed.decoration! as BoxDecoration).color,
      SydneyColors.primary,
    );
    expect(
      (missed.decoration! as BoxDecoration).color,
      SydneyColors.surfaceContainerHigh,
    );
    expect(
      (future.decoration! as BoxDecoration).color,
      SydneyColors.surface.withValues(alpha: 0),
    );
    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey('heatmap-metric-total')))
          .data,
      '1',
    );
    final mondayTop =
        tester
            .getTopLeft(find.byKey(const ValueKey('heatmap-day-2026-07-13')))
            .dy;
    final wednesdayTop =
        tester
            .getTopLeft(find.byKey(const ValueKey('heatmap-day-2026-07-15')))
            .dy;
    expect(wednesdayTop - mondayTop, 30);
    expect(tester.takeException(), isNull);
  });

  testWidgets('streak can end yesterday and empty history is intentional', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        SydneyHeatmapSheet(
          agentName: 'Study Agent',
          intent: 'study_plan',
          now: today,
          history: const {'2026-07-14': true, '2026-07-13': true},
        ),
      ),
    );

    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey('heatmap-metric-streak')))
          .data,
      '2',
    );

    await tester.pumpWidget(
      host(
        SydneyHeatmapSheet(
          agentName: 'New Study Agent',
          intent: 'study_plan',
          now: today,
          history: const {},
        ),
      ),
    );

    expect(find.byKey(const ValueKey('heatmap-empty-copy')), findsOneWidget);
    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey('heatmap-metric-total')))
          .data,
      '0',
    );
    expect(
      tester
          .widget<Text>(find.byKey(const ValueKey('heatmap-metric-streak')))
          .data,
      '0',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('inline heatmap preserves its expand and collapse behavior', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        SydneyHeatmap(
          intent: 'coding_tip',
          now: today,
          history: const {'2026-07-15': true},
        ),
      ),
    );

    expect(find.byKey(const ValueKey('heatmap-grid')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('heatmap-inline-toggle')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('heatmap-grid')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('heatmap-inline-toggle')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('heatmap-grid')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/design/app_theme.dart';
import 'package:sydney/widgets/stretch_switch.dart';

void main() {
  testWidgets('stretch switch elongates horizontally while pressed', (
    tester,
  ) async {
    var value = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: SydneyTheme.light,
        home: Scaffold(
          body: StretchSwitch(
            value: value,
            onChanged: (nextValue) => value = nextValue,
          ),
        ),
      ),
    );

    Transform transform() => tester.widget<Transform>(
      find.descendant(
        of: find.byType(StretchSwitch),
        matching: find.byType(Transform),
      ),
    );

    expect(transform().transform.storage[0], closeTo(1, 0.001));
    expect(transform().transform.storage[5], closeTo(1, 0.001));

    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(StretchSwitch)),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 70));

    expect(transform().transform.storage[0], greaterThan(1));
    expect(transform().transform.storage[5], lessThan(1));

    await gesture.up();
    await tester.pumpAndSettle();
    expect(transform().transform.storage[0], closeTo(1, 0.001));
    expect(transform().transform.storage[5], closeTo(1, 0.001));
  });
}

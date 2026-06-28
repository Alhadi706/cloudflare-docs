// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';

import 'package:dsf_gateway_flutter/src/app.dart';

void main() {
  testWidgets('shows login screen for signed-out users', (WidgetTester tester) async {
    await tester.pumpWidget(const DsfApp());
    await tester.pump();

    expect(find.text('DSF Gateway - Flutter'), findsOneWidget);
    expect(find.text('تسجيل الدخول'), findsOneWidget);
  });
}

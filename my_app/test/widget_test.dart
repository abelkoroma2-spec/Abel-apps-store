import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:my_app/main.dart';

void main() {
  final app = StoreApp(
    id: 'app-1',
    name: 'DLBC Bible Puzzle',
    category: 'Education',
    shortDescription: 'A Bible puzzle game.',
    description: 'Learn Scripture through puzzles.',
    features: ['Bible-themed puzzles'],
    iconUrl: null,
    downloads: 3,
    versions: [
      AppVersion(
        version: '1.2.0',
        apkPath: 'dlbc-bible-puzzle/1.2.0.apk',
        sizeBytes: 1258291,
        notes: 'First release',
        releasedAt: DateTime.utc(2026, 10, 20),
      ),
    ],
  );

  testWidgets('shows live app details and APK metadata', (tester) async {
    await tester.pumpWidget(AbelAppsStore(initialApps: [app]));
    await tester.pumpAndSettle();

    expect(find.text('DLBC Bible Puzzle'), findsOneWidget);
    expect(find.text('V1.2.0  /  1.2 MB'), findsOneWidget);

    await tester.tap(find.text('DLBC Bible Puzzle'));
    await tester.pumpAndSettle();

    expect(find.text('Learn Scripture through puzzles.'), findsOneWidget);
    expect(find.text('Download APK (1.2 MB)'), findsOneWidget);
  });

  testWidgets('search filters the live app list', (tester) async {
    await tester.pumpWidget(AbelAppsStore(initialApps: [app]));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'not found');
    await tester.pumpAndSettle();

    expect(find.text('No apps found'), findsOneWidget);
  });
}

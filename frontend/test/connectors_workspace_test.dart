import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/design/workspace_palette.dart';
import 'package:sydney/models/connector.dart';
import 'package:sydney/providers/connectors_provider.dart';
import 'package:sydney/screens/connectors/connectors_screen.dart';
import 'package:sydney/widgets/connectors/connector_list_item.dart';
import 'package:sydney/widgets/sydney_primitives.dart';
import 'package:sydney/widgets/workspace_primitives.dart';

const _githubConnector = Connector(
  id: 'github',
  name: 'GitHub',
  description: 'Repository activity and delivery updates.',
  status: ConnectorStatus.disconnected,
  iconName: 'Github',
  requiredScopes: ['repo'],
  authConfigured: true,
);

const _driveConnector = Connector(
  id: 'drive',
  name: 'Google Drive',
  description: 'Read selected Drive files.',
  status: ConnectorStatus.connected,
  iconName: 'HardDrive',
  authConfigured: true,
);

class _LoadedConnectorsController extends ConnectorsController {
  @override
  Future<List<Connector>> build() async => const [_githubConnector];
}

class _LoadingConnectorsController extends ConnectorsController {
  final _completer = Completer<List<Connector>>();

  @override
  Future<List<Connector>> build() => _completer.future;
}

class _DriveConnectorsController extends ConnectorsController {
  @override
  Future<List<Connector>> build() async => const [_driveConnector];
}

class _FailingConnectorsController extends ConnectorsController {
  @override
  Future<List<Connector>> build() async {
    throw StateError('offline');
  }
}

Widget _screenWith(ConnectorsController Function() createController) {
  return ProviderScope(
    key: UniqueKey(),
    overrides: [connectorsProvider.overrideWith(createController)],
    child: const MaterialApp(home: ConnectorsScreen()),
  );
}

void main() {
  testWidgets('connectors uses the workspace shell and privacy copy', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_screenWith(_LoadedConnectorsController.new));
    await tester.pumpAndSettle();

    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold).first);
    expect(scaffold.backgroundColor, CuppetWorkspaceColors.background);
    expect(find.byType(WorkspaceAppBar), findsOneWidget);
    expect(find.text('Workspace setup'), findsOneWidget);
    expect(find.text('Connect your tools'), findsOneWidget);
    expect(
      find.text('Choose which services Cuppet can connect to.'),
      findsOneWidget,
    );
    expect(find.text('AVAILABLE SERVICES'), findsOneWidget);
    expect(find.byType(WorkspaceCard), findsOneWidget);
    expect(find.byType(WorkspacePrivacyPanel), findsOneWidget);
    expect(find.text('Access & privacy'), findsOneWidget);
    expect(
      find.text(
        'Cuppet only uses the access you approve. Connector tokens stay encrypted on Cuppet\'s backend, and agents stay within each connector\'s granted scopes.',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('Approve access'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('official connector artwork is displayed without a tint', (
    tester,
  ) async {
    await tester.pumpWidget(_screenWith(_LoadedConnectorsController.new));
    await tester.pumpAndSettle();

    final image = tester.widget<Image>(find.byType(Image).first);
    expect(image.image, isA<AssetImage>());
    expect((image.image as AssetImage).assetName, 'assets/logos/github.png');
    expect(image.color, isNull);
    expect(find.byType(ColorFiltered), findsNothing);
  });

  testWidgets('advanced connector switch keeps the existing callback', (
    tester,
  ) async {
    final changes = <bool>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ConnectorListItem(
            connector: _githubConnector,
            onConnectedChanged: changes.add,
          ),
        ),
      ),
    );

    expect(find.byType(WorkspaceCard), findsOneWidget);
    await tester.tap(find.byType(Switch));
    await tester.pump();

    expect(changes, [true]);
  });

  testWidgets('compact connector keeps its nested tap behavior and shell', (
    tester,
  ) async {
    final changes = <bool>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ConnectorListItem(
            connector: _githubConnector,
            compact: true,
            onConnectedChanged: changes.add,
          ),
        ),
      ),
    );

    expect(find.byType(WorkspaceCard), findsNothing);
    await tester.tap(find.text('GitHub'));
    await tester.pump();

    expect(changes, [true]);
  });

  testWidgets('connectors keeps loading and error states', (tester) async {
    await tester.pumpWidget(_screenWith(_LoadingConnectorsController.new));
    await tester.pump();

    expect(find.byType(SydneyLoadingBlock), findsNWidgets(3));
    expect(find.byType(WorkspaceAppBar), findsOneWidget);

    await tester.pumpWidget(_screenWith(_FailingConnectorsController.new));
    await tester.pumpAndSettle();

    expect(find.text('Connectors could not load'), findsOneWidget);
    expect(find.textContaining('couldn’t be loaded'), findsOneWidget);
    expect(find.textContaining('offline'), findsNothing);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('Drive card keeps archive settings out of Connectors', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_screenWith(_DriveConnectorsController.new));
    await tester.pumpAndSettle();

    expect(find.text('Google Drive'), findsOneWidget);
    expect(find.textContaining('Archive conversations'), findsNothing);
    expect(
      find.byKey(const ValueKey('drive-message-archive-toggle')),
      findsNothing,
    );
    expect(find.byKey(const ValueKey('delete-drive-archives')), findsNothing);
  });
}

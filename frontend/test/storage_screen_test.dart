import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/config/routes.dart';
import 'package:sydney/models/connector.dart';
import 'package:sydney/models/message_archive.dart';
import 'package:sydney/providers/connectors_provider.dart';
import 'package:sydney/providers/message_archive_provider.dart';
import 'package:sydney/screens/settings/storage_screen.dart';
import 'package:sydney/widgets/workspace_primitives.dart';

const _connectedDrive = Connector(
  id: 'drive',
  name: 'Google Drive',
  description: 'Read selected Drive files.',
  status: ConnectorStatus.connected,
  iconName: 'HardDrive',
  authConfigured: true,
);

const _disconnectedDrive = Connector(
  id: 'drive',
  name: 'Google Drive',
  description: 'Read selected Drive files.',
  status: ConnectorStatus.disconnected,
  iconName: 'HardDrive',
  authConfigured: true,
);

class _ConnectedDriveController extends ConnectorsController {
  @override
  Future<List<Connector>> build() async => const [_connectedDrive];
}

class _DisconnectedDriveController extends ConnectorsController {
  @override
  Future<List<Connector>> build() async => const [_disconnectedDrive];
}

class _ActiveArchiveController extends MessageArchiveController {
  @override
  Future<MessageArchiveState> build() async => MessageArchiveState(
    enabled: true,
    status: 'active',
    actionRequired: false,
    folderLink: Uri.parse('https://drive.google.com/drive/folders/folder-1'),
    lastSuccessAt: DateTime.utc(2026, 7, 16, 12),
  );
}

class _DisabledArchiveController extends MessageArchiveController {
  @override
  Future<MessageArchiveState> build() async => const MessageArchiveState(
    enabled: false,
    status: 'disabled',
    actionRequired: false,
  );
}

Widget _storageScreen({
  required ConnectorsController Function() connectors,
  required MessageArchiveController Function() archive,
}) {
  return ProviderScope(
    overrides: [
      connectorsProvider.overrideWith(connectors),
      messageArchiveProvider.overrideWith(archive),
    ],
    child: MaterialApp(
      home: const StorageScreen(),
      routes: {
        AppRoutes.connectors:
            (_) => const Scaffold(body: Text('Connectors destination')),
      },
    ),
  );
}

void main() {
  testWidgets('Storage owns active Drive archive settings and cleanup', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      _storageScreen(
        connectors: _ConnectedDriveController.new,
        archive: _ActiveArchiveController.new,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(WorkspaceAppBar), findsOneWidget);
    expect(find.text('Storage'), findsOneWidget);
    expect(find.text('30-day message history'), findsOneWidget);
    expect(find.text('Archive conversations'), findsOneWidget);
    expect(find.text('Archive on'), findsOneWidget);
    expect(find.text('Google Drive is connected.'), findsOneWidget);
    expect(
      tester
          .widget<Switch>(
            find.byKey(const ValueKey('drive-message-archive-toggle')),
          )
          .value,
      isTrue,
    );
    expect(
      find.byKey(const ValueKey('open-drive-archive-folder')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('delete-drive-archives')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('delete-drive-archives')));
    await tester.pumpAndSettle();
    expect(find.text('Delete all Drive archives?'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('confirm-delete-drive-archives')),
      findsOneWidget,
    );
  });

  testWidgets('Storage sends disconnected users to Connectors', (tester) async {
    await tester.pumpWidget(
      _storageScreen(
        connectors: _DisconnectedDriveController.new,
        archive: _DisabledArchiveController.new,
      ),
    );
    await tester.pumpAndSettle();

    final toggle = find.byKey(const ValueKey('drive-message-archive-toggle'));
    expect(tester.widget<Switch>(toggle).onChanged, isNull);
    expect(find.text('Google Drive is not connected.'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('connect-drive-from-storage')));
    await tester.pumpAndSettle();
    expect(find.text('Connectors destination'), findsOneWidget);
  });
}

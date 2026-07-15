import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/app.dart';
import 'package:sydney/models/account_preferences.dart';
import 'package:sydney/models/user.dart';
import 'package:sydney/providers/auth_provider.dart';
import 'package:sydney/providers/timezone_provider.dart';
import 'package:sydney/services/account_preferences_service.dart';
import 'package:sydney/services/api.dart';
import 'package:sydney/services/device_timezone_service.dart';

class _TestAuthController extends AuthController {
  _TestAuthController(this.initialUserId);

  final String initialUserId;

  @override
  Future<AuthState> build() async => _account(initialUserId);

  void switchTo(String userId) {
    state = AsyncValue.data(_account(userId));
  }
}

class _FakeDeviceTimezoneService extends DeviceTimezoneService {
  _FakeDeviceTimezoneService(this.timeZone);

  String timeZone;
  bool fail = false;
  int readCount = 0;

  @override
  Future<String> getLocalTimeZone() async {
    readCount += 1;
    if (fail) {
      throw const DeviceTimezoneException('timezone unavailable');
    }
    return normalizeTimeZoneIdentifier(timeZone);
  }
}

class _FakeAccountPreferencesService extends AccountPreferencesService {
  _FakeAccountPreferencesService(this.saved)
    : super(api: ApiClient(secureStorage: const FlutterSecureStorage()));

  AccountPreferences saved;
  int readCount = 0;
  int updateCount = 0;
  bool failUpdates = false;
  final readUserIds = <String>[];
  final updateUserIds = <String>[];

  @override
  Future<AccountPreferences> getPreferences({
    required String expectedUserId,
  }) async {
    readCount += 1;
    readUserIds.add(expectedUserId);
    return saved;
  }

  @override
  Future<AccountPreferences> updatePreferences({
    required String expectedUserId,
    required String timeZone,
    required bool followDeviceTimeZone,
  }) async {
    updateCount += 1;
    updateUserIds.add(expectedUserId);
    if (failUpdates) {
      throw const ApiException('preference update failed');
    }
    saved = AccountPreferences(
      timeZone: normalizeTimeZoneIdentifier(timeZone),
      followDeviceTimeZone: followDeviceTimeZone,
    );
    return saved;
  }
}

AuthState _account(String id) => AuthState(
  user: User(id: id, email: '$id@cuppet.app', displayName: id),
  sessionToken: 'session-$id',
);

ProviderContainer _container({
  required _TestAuthController Function() auth,
  required DeviceTimezoneService device,
  required AccountPreferencesService preferences,
}) {
  return ProviderContainer(
    overrides: [
      authControllerProvider.overrideWith(auth),
      deviceTimezoneServiceProvider.overrideWithValue(device),
      accountPreferencesServiceProvider.overrideWithValue(preferences),
    ],
  );
}

void main() {
  test(
    'syncs a changed automatic zone once and deduplicates later checks',
    () async {
      final device = _FakeDeviceTimezoneService('America/New_York');
      final preferences = _FakeAccountPreferencesService(
        const AccountPreferences(
          timeZone: 'Asia/Kolkata',
          followDeviceTimeZone: true,
        ),
      );
      final container = _container(
        auth: () => _TestAuthController('account-a'),
        device: device,
        preferences: preferences,
      );
      addTearDown(container.dispose);

      await container.read(authControllerProvider.future);
      final subscription = container.listen(
        timezonePreferencesProvider,
        (_, _) {},
      );
      addTearDown(subscription.close);

      final initial = await container.read(timezonePreferencesProvider.future);
      expect(initial.savedTimeZone, 'America/New_York');
      expect(preferences.updateCount, 1);

      await container
          .read(timezonePreferencesProvider.notifier)
          .syncDeviceTimeZone();
      expect(preferences.updateCount, 1);

      device.timeZone = 'Europe/London';
      await container
          .read(timezonePreferencesProvider.notifier)
          .syncDeviceTimeZone();
      expect(preferences.updateCount, 2);
      expect(
        container.read(timezonePreferencesProvider).value?.savedTimeZone,
        'Europe/London',
      );
    },
  );

  test(
    'persists a device zone even when it matches the legacy fallback',
    () async {
      final device = _FakeDeviceTimezoneService('Asia/Kolkata');
      final preferences = _FakeAccountPreferencesService(
        const AccountPreferences(
          timeZone: 'Asia/Kolkata',
          followDeviceTimeZone: true,
          timeZoneIsExplicit: false,
        ),
      );
      final container = _container(
        auth: () => _TestAuthController('account-a'),
        device: device,
        preferences: preferences,
      );
      addTearDown(container.dispose);

      await container.read(authControllerProvider.future);
      final subscription = container.listen(
        timezonePreferencesProvider,
        (_, _) {},
      );
      addTearDown(subscription.close);
      final result = await container.read(timezonePreferencesProvider.future);

      expect(result.savedTimeZone, 'Asia/Kolkata');
      expect(preferences.updateCount, 1);
    },
  );

  test(
    'fixed mode ignores device changes until automatic mode is restored',
    () async {
      final device = _FakeDeviceTimezoneService('America/New_York');
      final preferences = _FakeAccountPreferencesService(
        const AccountPreferences(
          timeZone: 'America/New_York',
          followDeviceTimeZone: true,
        ),
      );
      final container = _container(
        auth: () => _TestAuthController('account-a'),
        device: device,
        preferences: preferences,
      );
      addTearDown(container.dispose);

      await container.read(authControllerProvider.future);
      final subscription = container.listen(
        timezonePreferencesProvider,
        (_, _) {},
      );
      addTearDown(subscription.close);
      await container.read(timezonePreferencesProvider.future);

      final controller = container.read(timezonePreferencesProvider.notifier);
      expect(await controller.setFollowDeviceTimeZone(false), isTrue);
      device.timeZone = 'Europe/London';
      await controller.syncDeviceTimeZone();

      var result = container.read(timezonePreferencesProvider).value!;
      expect(result.savedTimeZone, 'America/New_York');
      expect(result.detectedTimeZone, 'Europe/London');
      expect(result.followDeviceTimeZone, isFalse);

      expect(await controller.setFollowDeviceTimeZone(true), isTrue);
      result = container.read(timezonePreferencesProvider).value!;
      expect(result.savedTimeZone, 'Europe/London');
      expect(result.followDeviceTimeZone, isTrue);
    },
  );

  test('reloads preferences when a different account signs in', () async {
    final device = _FakeDeviceTimezoneService('UTC');
    final preferences = _FakeAccountPreferencesService(
      const AccountPreferences(timeZone: 'UTC', followDeviceTimeZone: true),
    );
    final container = _container(
      auth: () => _TestAuthController('account-a'),
      device: device,
      preferences: preferences,
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.future);
    final subscription = container.listen(
      timezonePreferencesProvider,
      (_, _) {},
    );
    addTearDown(subscription.close);
    await container.read(timezonePreferencesProvider.future);

    final auth =
        container.read(authControllerProvider.notifier) as _TestAuthController;
    auth.switchTo('account-b');
    await Future<void>.delayed(Duration.zero);
    final secondAccount = await container.read(
      timezonePreferencesProvider.future,
    );

    expect(secondAccount.userId, 'account-b');
    expect(preferences.readCount, 2);
    expect(preferences.readUserIds, ['account-a', 'account-b']);
    expect(preferences.updateCount, 0);
  });

  test('keeps a pending sync when the preference update fails', () async {
    final device = _FakeDeviceTimezoneService('America/New_York');
    final preferences = _FakeAccountPreferencesService(
      const AccountPreferences(
        timeZone: 'Asia/Kolkata',
        followDeviceTimeZone: true,
      ),
    )..failUpdates = true;
    final container = _container(
      auth: () => _TestAuthController('account-a'),
      device: device,
      preferences: preferences,
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.future);
    final subscription = container.listen(
      timezonePreferencesProvider,
      (_, _) {},
    );
    addTearDown(subscription.close);
    final result = await container.read(timezonePreferencesProvider.future);

    expect(result.savedTimeZone, 'Asia/Kolkata');
    expect(result.syncPending, isTrue);
    expect(preferences.updateCount, 1);
  });

  test(
    'keeps server preferences when device detection is unavailable',
    () async {
      final device = _FakeDeviceTimezoneService('UTC')..fail = true;
      final preferences = _FakeAccountPreferencesService(
        const AccountPreferences(
          timeZone: 'Europe/Paris',
          followDeviceTimeZone: true,
        ),
      );
      final container = _container(
        auth: () => _TestAuthController('account-a'),
        device: device,
        preferences: preferences,
      );
      addTearDown(container.dispose);

      await container.read(authControllerProvider.future);
      final subscription = container.listen(
        timezonePreferencesProvider,
        (_, _) {},
      );
      addTearDown(subscription.close);
      final result = await container.read(timezonePreferencesProvider.future);

      expect(result.savedTimeZone, 'Europe/Paris');
      expect(result.syncPending, isTrue);
      expect(preferences.updateCount, 0);
    },
  );

  testWidgets('app resume checks the device timezone again', (tester) async {
    final device = _FakeDeviceTimezoneService('America/New_York');
    final preferences = _FakeAccountPreferencesService(
      const AccountPreferences(
        timeZone: 'America/New_York',
        followDeviceTimeZone: true,
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController('account-a'),
          ),
          deviceTimezoneServiceProvider.overrideWithValue(device),
          accountPreferencesServiceProvider.overrideWithValue(preferences),
        ],
        child: const MaterialApp(
          home: TimezoneSyncBridge(child: Text('Ready')),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(preferences.updateCount, 0);

    device.timeZone = 'Europe/London';
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();

    expect(preferences.updateCount, 1);
    expect(preferences.saved.timeZone, 'Europe/London');
  });
}

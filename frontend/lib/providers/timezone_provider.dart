import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/account_preferences.dart';
import '../services/account_preferences_service.dart';
import '../services/device_timezone_service.dart';
import 'auth_provider.dart';

final deviceTimezoneServiceProvider = Provider<DeviceTimezoneService>((ref) {
  return const DeviceTimezoneService();
});

final accountPreferencesServiceProvider = Provider<AccountPreferencesService>((
  ref,
) {
  return AccountPreferencesService(api: ref.watch(apiClientProvider));
});

final timezonePreferencesProvider = AsyncNotifierProvider<
  TimezonePreferencesController,
  TimezonePreferencesState
>(TimezonePreferencesController.new);

class TimezonePreferencesState {
  const TimezonePreferencesState({
    required this.userId,
    required this.detectedTimeZone,
    required this.savedTimeZone,
    required this.followDeviceTimeZone,
    required this.preferencesLoaded,
    this.isUpdating = false,
    this.syncPending = false,
  });

  const TimezonePreferencesState.signedOut()
    : userId = null,
      detectedTimeZone = null,
      savedTimeZone = null,
      followDeviceTimeZone = null,
      preferencesLoaded = false,
      isUpdating = false,
      syncPending = false;

  final String? userId;
  final String? detectedTimeZone;
  final String? savedTimeZone;
  final bool? followDeviceTimeZone;
  final bool preferencesLoaded;
  final bool isUpdating;
  final bool syncPending;

  String? get displayedTimeZone {
    if (followDeviceTimeZone == true) {
      return detectedTimeZone ?? savedTimeZone;
    }
    return savedTimeZone ?? detectedTimeZone;
  }

  TimezonePreferencesState copyWith({
    String? detectedTimeZone,
    String? savedTimeZone,
    bool? followDeviceTimeZone,
    bool? preferencesLoaded,
    bool? isUpdating,
    bool? syncPending,
  }) {
    return TimezonePreferencesState(
      userId: userId,
      detectedTimeZone: detectedTimeZone ?? this.detectedTimeZone,
      savedTimeZone: savedTimeZone ?? this.savedTimeZone,
      followDeviceTimeZone: followDeviceTimeZone ?? this.followDeviceTimeZone,
      preferencesLoaded: preferencesLoaded ?? this.preferencesLoaded,
      isUpdating: isUpdating ?? this.isUpdating,
      syncPending: syncPending ?? this.syncPending,
    );
  }
}

class TimezonePreferencesController
    extends AsyncNotifier<TimezonePreferencesState> {
  Future<void>? _syncInFlight;

  @override
  Future<TimezonePreferencesState> build() async {
    final auth = ref.watch(authControllerProvider).value;
    if (auth?.isAuthenticated != true) {
      return const TimezonePreferencesState.signedOut();
    }

    return _loadAndSync(auth!.user!.id);
  }

  Future<void> syncDeviceTimeZone() {
    final running = _syncInFlight;
    if (running != null) {
      return running;
    }

    final operation = _syncDeviceTimeZone();
    _syncInFlight = operation;
    return operation.whenComplete(() {
      if (identical(_syncInFlight, operation)) {
        _syncInFlight = null;
      }
    });
  }

  Future<bool> setFollowDeviceTimeZone(bool follow) async {
    final current = state.value;
    if (current == null ||
        current.userId == null ||
        !current.preferencesLoaded ||
        current.isUpdating) {
      return false;
    }

    String? timeZone = current.savedTimeZone ?? current.detectedTimeZone;
    if (follow) {
      timeZone = await _detectTimeZone();
    }
    if (timeZone == null || !_isCurrentUser(current.userId!)) {
      return false;
    }

    if (current.followDeviceTimeZone == follow &&
        current.savedTimeZone == timeZone) {
      return true;
    }

    state = AsyncValue.data(current.copyWith(isUpdating: true));
    try {
      final updated = await ref
          .read(accountPreferencesServiceProvider)
          .updatePreferences(
            expectedUserId: current.userId!,
            timeZone: timeZone,
            followDeviceTimeZone: follow,
          );
      if (!_isCurrentUser(current.userId!)) {
        return false;
      }
      state = AsyncValue.data(
        _stateFromPreferences(
          userId: current.userId!,
          detectedTimeZone:
              follow ? timeZone : current.detectedTimeZone ?? timeZone,
          preferences: updated,
        ),
      );
      return true;
    } catch (_) {
      if (_isCurrentUser(current.userId!)) {
        state = AsyncValue.data(
          current.copyWith(isUpdating: false, syncPending: true),
        );
      }
      return false;
    }
  }

  Future<void> _syncDeviceTimeZone() async {
    final auth = ref.read(authControllerProvider).value;
    if (auth?.isAuthenticated != true) {
      return;
    }
    final userId = auth!.user!.id;
    final current = state.value;
    if (current == null ||
        current.userId != userId ||
        !current.preferencesLoaded) {
      final refreshed = await _loadAndSync(userId);
      if (_isCurrentUser(userId)) {
        state = AsyncValue.data(refreshed);
      }
      return;
    }

    final detectedTimeZone = await _detectTimeZone();
    if (!_isCurrentUser(userId)) {
      return;
    }
    if (detectedTimeZone == null) {
      state = AsyncValue.data(current.copyWith(syncPending: true));
      return;
    }
    if (current.followDeviceTimeZone != true) {
      state = AsyncValue.data(
        current.copyWith(
          detectedTimeZone: detectedTimeZone,
          syncPending: false,
        ),
      );
      return;
    }
    if (current.savedTimeZone == detectedTimeZone) {
      state = AsyncValue.data(
        current.copyWith(
          detectedTimeZone: detectedTimeZone,
          syncPending: false,
        ),
      );
      return;
    }

    final synced = await _updateAutomaticTimeZone(
      userId: userId,
      detectedTimeZone: detectedTimeZone,
      current: current,
    );
    if (_isCurrentUser(userId)) {
      state = AsyncValue.data(synced);
    }
  }

  Future<TimezonePreferencesState> _loadAndSync(String userId) async {
    final detectedTimeZone = await _detectTimeZone();
    AccountPreferences? preferences;
    try {
      preferences = await ref
          .read(accountPreferencesServiceProvider)
          .getPreferences(expectedUserId: userId);
    } catch (_) {
      return TimezonePreferencesState(
        userId: userId,
        detectedTimeZone: detectedTimeZone,
        savedTimeZone: null,
        followDeviceTimeZone: null,
        preferencesLoaded: false,
        syncPending: true,
      );
    }

    final loaded = _stateFromPreferences(
      userId: userId,
      detectedTimeZone: detectedTimeZone,
      preferences: preferences,
    );
    if (!_isCurrentUser(userId) ||
        !preferences.followDeviceTimeZone ||
        detectedTimeZone == null ||
        (preferences.timeZoneIsExplicit &&
            preferences.timeZone == detectedTimeZone)) {
      return loaded.copyWith(syncPending: detectedTimeZone == null);
    }

    return _updateAutomaticTimeZone(
      userId: userId,
      detectedTimeZone: detectedTimeZone,
      current: loaded,
    );
  }

  Future<TimezonePreferencesState> _updateAutomaticTimeZone({
    required String userId,
    required String detectedTimeZone,
    required TimezonePreferencesState current,
  }) async {
    if (!_isCurrentUser(userId)) {
      return current;
    }
    try {
      final updated = await ref
          .read(accountPreferencesServiceProvider)
          .updatePreferences(
            expectedUserId: userId,
            timeZone: detectedTimeZone,
            followDeviceTimeZone: true,
          );
      return _stateFromPreferences(
        userId: userId,
        detectedTimeZone: detectedTimeZone,
        preferences: updated,
      );
    } catch (_) {
      return current.copyWith(syncPending: true);
    }
  }

  Future<String?> _detectTimeZone() async {
    try {
      return await ref.read(deviceTimezoneServiceProvider).getLocalTimeZone();
    } catch (_) {
      return null;
    }
  }

  bool _isCurrentUser(String userId) {
    final auth = ref.read(authControllerProvider).value;
    return auth?.isAuthenticated == true && auth?.user?.id == userId;
  }

  TimezonePreferencesState _stateFromPreferences({
    required String userId,
    required String? detectedTimeZone,
    required AccountPreferences preferences,
  }) {
    return TimezonePreferencesState(
      userId: userId,
      detectedTimeZone: detectedTimeZone,
      savedTimeZone: preferences.timeZone,
      followDeviceTimeZone: preferences.followDeviceTimeZone,
      preferencesLoaded: true,
    );
  }
}

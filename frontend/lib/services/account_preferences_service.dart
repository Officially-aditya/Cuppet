import 'package:dio/dio.dart';

import '../models/account_preferences.dart';
import 'api.dart';

class AccountPreferencesService {
  AccountPreferencesService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<AccountPreferences> getPreferences({
    required String expectedUserId,
  }) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/users/me/preferences',
        options: _accountBoundOptions(expectedUserId),
      );
      final preferences = response.data?['preferences'];
      if (preferences is! Map) {
        throw const ApiException(
          'The server did not return account preferences.',
        );
      }
      return AccountPreferences.fromJson(
        Map<String, dynamic>.from(preferences),
      );
    } catch (error) {
      throw apiExceptionFrom(error, 'Could not load account preferences.');
    }
  }

  Future<AccountPreferences> updatePreferences({
    required String expectedUserId,
    required String timeZone,
    required bool followDeviceTimeZone,
  }) async {
    final requested = AccountPreferences(
      timeZone: timeZone,
      followDeviceTimeZone: followDeviceTimeZone,
    );
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '/users/me/preferences',
        data: requested.toJson(),
        options: _accountBoundOptions(expectedUserId),
      );
      final preferences = response.data?['preferences'];
      if (preferences is Map) {
        return AccountPreferences.fromJson(
          Map<String, dynamic>.from(preferences),
        );
      }
      return requested;
    } catch (error) {
      throw apiExceptionFrom(error, 'Could not update account preferences.');
    }
  }

  Options _accountBoundOptions(String userId) {
    return Options(headers: {'X-Cuppet-Expected-User': userId});
  }
}

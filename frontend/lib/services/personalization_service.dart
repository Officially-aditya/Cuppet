import '../config/env.dart';
import '../models/assistant_suggestion.dart';
import '../models/personalization_consent.dart';
import '../models/personalization_settings.dart';
import '../models/preference_profile.dart';
import '../models/preference_profile_item.dart';
import 'api.dart';

class PersonalizationService {
  PersonalizationService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<PreferenceProfile> loadProfile() async {
    if (Env.useMockData) {
      return const PreferenceProfile(
        settings: PersonalizationSettings.defaults(),
        consents: [],
        items: [],
      );
    }
    try {
      final settingsResponse = await _api.get<Map<String, dynamic>>(
        '/users/me/personalization',
      );
      final profileResponse = await _api.get<Map<String, dynamic>>(
        '/users/me/preference-profile',
      );
      final settings = settingsResponse.data?['settings'];
      final consents = settingsResponse.data?['consents'];
      return PreferenceProfile(
        settings:
            settings is Map
                ? PersonalizationSettings.fromJson(
                  Map<String, dynamic>.from(settings),
                )
                : const PersonalizationSettings.defaults(),
        consents: (consents is List ? consents : const [])
            .whereType<Map>()
            .map(
              (item) => PersonalizationConsent.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList(growable: false),
        items: (profileResponse.data?['items'] is List
                ? profileResponse.data!['items'] as List
                : const [])
            .whereType<Map>()
            .map(
              (item) => PreferenceProfileItem.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList(growable: false),
        browserConnected: settingsResponse.data?['browser_connected'] == true,
        recentSuggestions: (settingsResponse.data?['recent_suggestions'] is List
                ? settingsResponse.data!['recent_suggestions'] as List
                : const [])
            .whereType<Map>()
            .map(
              (item) =>
                  AssistantSuggestion.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList(growable: false),
      );
    } catch (error) {
      throw apiExceptionFrom(error, 'Personalization could not be loaded.');
    }
  }

  Future<PersonalizationSettings> updateSettings(
    PersonalizationSettings settings,
  ) async {
    if (Env.useMockData) return settings;
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '/users/me/personalization',
        data: settings.toJson(),
      );
      final data = response.data?['settings'];
      if (data is! Map) {
        throw const ApiException('Personalization settings were not returned.');
      }
      return PersonalizationSettings.fromJson(Map<String, dynamic>.from(data));
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'Personalization settings could not be updated.',
      );
    }
  }

  Future<PersonalizationConsent> grantConsent(String purpose) async {
    if (Env.useMockData) {
      return _mockConsent(purpose, granted: true);
    }
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/users/me/personalization/consents',
        data: {'purpose': purpose, 'source': 'settings'},
      );
      final data = response.data?['consent'];
      if (data is! Map) throw const ApiException('Consent was not returned.');
      return PersonalizationConsent.fromJson(Map<String, dynamic>.from(data));
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'That personalization permission could not be enabled.',
      );
    }
  }

  Future<PersonalizationConsent> revokeConsent(String purpose) async {
    if (Env.useMockData) {
      return _mockConsent(purpose, granted: false);
    }
    try {
      final response = await _api.delete<Map<String, dynamic>>(
        '/users/me/personalization/consents/$purpose',
      );
      final data = response.data?['consent'];
      if (data is! Map) throw const ApiException('Consent was not returned.');
      return PersonalizationConsent.fromJson(Map<String, dynamic>.from(data));
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'That personalization permission could not be disabled.',
      );
    }
  }

  Future<PreferenceProfileItem> updateItem(
    String itemId, {
    double? weight,
    String? key,
  }) async {
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '/users/me/preference-profile/$itemId',
        data: {
          if (weight != null) 'weight': weight,
          if (key != null) 'key': key,
        },
      );
      final data = response.data?['item'];
      if (data is! Map) {
        throw const ApiException('The preference was not returned.');
      }
      return PreferenceProfileItem.fromJson(Map<String, dynamic>.from(data));
    } catch (error) {
      throw apiExceptionFrom(error, 'That preference could not be updated.');
    }
  }

  Future<void> deleteItem(String itemId) async {
    try {
      await _api.delete<void>('/users/me/preference-profile/$itemId');
    } catch (error) {
      throw apiExceptionFrom(error, 'That preference could not be removed.');
    }
  }

  Future<void> resetProfile() async {
    try {
      await _api.delete<void>('/users/me/preference-profile');
    } catch (error) {
      throw apiExceptionFrom(error, 'Personalization data could not be reset.');
    }
  }

  Future<String> connectBrowser() async {
    if (Env.useMockData) return 'mock-browser-connection-token';
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/users/me/personalization/browser-connection',
      );
      final connection = response.data?['connection'];
      final token = connection is Map ? connection['token']?.toString() : null;
      if (token == null || token.isEmpty) {
        throw const ApiException(
          'The browser connection token was not returned.',
        );
      }
      return token;
    } catch (error) {
      throw apiExceptionFrom(error, 'Browser activity could not be connected.');
    }
  }

  Future<void> disconnectBrowser() async {
    if (Env.useMockData) return;
    try {
      await _api.delete<void>('/users/me/personalization/browser-connection');
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'Browser activity could not be disconnected.',
      );
    }
  }

  Future<void> createExclusion({
    required String subjectType,
    required String subjectKey,
  }) async {
    if (Env.useMockData) return;
    try {
      await _api.post<Map<String, dynamic>>(
        '/users/me/preference-profile/exclusions',
        data: {'subject_type': subjectType, 'subject_key': subjectKey},
      );
    } catch (error) {
      throw apiExceptionFrom(error, 'The exclusion could not be saved.');
    }
  }

  Future<Map<String, dynamic>> exportData() async {
    if (Env.useMockData) {
      return const {
        'consents': <Object>[],
        'profile': <Object>[],
        'events': <Object>[],
        'suggestions': <Object>[],
        'exclusions': <Object>[],
        'analytics': <Object>[],
      };
    }
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/users/me/preference-profile/export',
      );
      return response.data ?? const {};
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'Personalization data could not be exported.',
      );
    }
  }

  Future<bool> submitFeedback({
    required String messageId,
    required String feedbackType,
    String? subjectType,
    String? subjectKey,
  }) async {
    if (Env.useMockData) return true;
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/messages/$messageId/feedback',
        data: {
          'feedback_type': feedbackType,
          if (subjectType != null) 'subject_type': subjectType,
          if (subjectKey != null) 'subject_key': subjectKey,
        },
      );
      return response.data?['stored'] != false;
    } catch (error) {
      throw apiExceptionFrom(error, 'That feedback could not be saved.');
    }
  }

  Future<void> deleteFeedback(String messageId) async {
    try {
      await _api.delete<void>('/messages/$messageId/feedback');
    } catch (error) {
      throw apiExceptionFrom(error, 'That feedback could not be removed.');
    }
  }

  Future<bool> recordActivity({
    required String messageId,
    required String activityType,
    required String subjectType,
    required String subjectKey,
  }) async {
    if (Env.useMockData) return true;
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/messages/$messageId/activity',
        data: {
          'activity_type': activityType,
          'subject_type': subjectType,
          'subject_key': subjectKey,
        },
      );
      return response.data?['stored'] != false;
    } catch (error) {
      throw apiExceptionFrom(error, 'That activity signal could not be saved.');
    }
  }

  PersonalizationConsent _mockConsent(String purpose, {required bool granted}) {
    final now = DateTime.now();
    return PersonalizationConsent(
      id: 'mock-consent-$purpose',
      purpose: purpose,
      status: granted ? 'granted' : 'revoked',
      policyVersion: 'mock',
      createdAt: now,
      grantedAt: granted ? now : null,
      revokedAt: granted ? null : now,
      source: 'mock',
    );
  }
}

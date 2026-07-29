import 'personalization_consent.dart';
import 'personalization_settings.dart';
import 'preference_profile_item.dart';
import 'assistant_suggestion.dart';

class PreferenceProfile {
  const PreferenceProfile({
    required this.settings,
    required this.consents,
    required this.items,
    this.browserConnected = false,
    this.recentSuggestions = const [],
  });

  final PersonalizationSettings settings;
  final List<PersonalizationConsent> consents;
  final List<PreferenceProfileItem> items;
  final bool browserConnected;
  final List<AssistantSuggestion> recentSuggestions;

  factory PreferenceProfile.fromJson(Map<String, dynamic> json) {
    final rawSettings = json['settings'];
    final rawConsents = json['consents'];
    final rawItems = json['items'];
    return PreferenceProfile(
      settings:
          rawSettings is Map
              ? PersonalizationSettings.fromJson(
                Map<String, dynamic>.from(rawSettings),
              )
              : const PersonalizationSettings.defaults(),
      consents: (rawConsents is List ? rawConsents : const [])
          .whereType<Map>()
          .map(
            (item) => PersonalizationConsent.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(growable: false),
      items: (rawItems is List ? rawItems : const [])
          .whereType<Map>()
          .map(
            (item) =>
                PreferenceProfileItem.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(growable: false),
      browserConnected: json['browser_connected'] == true,
      recentSuggestions: (json['recent_suggestions'] is List
              ? json['recent_suggestions'] as List
              : const [])
          .whereType<Map>()
          .map(
            (item) =>
                AssistantSuggestion.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(growable: false),
    );
  }

  bool consentGranted(String purpose) => consents.any(
    (consent) => consent.purpose == purpose && consent.isGranted,
  );
}

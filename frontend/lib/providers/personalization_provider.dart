import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/personalization_settings.dart';
import '../models/preference_profile.dart';
import '../services/personalization_service.dart';
import '../services/suggestion_service.dart';
import 'auth_provider.dart';

final personalizationServiceProvider = Provider<PersonalizationService>((ref) {
  return PersonalizationService(api: ref.watch(apiClientProvider));
});

final suggestionServiceProvider = Provider<SuggestionService>((ref) {
  return SuggestionService(api: ref.watch(apiClientProvider));
});

final personalizationProvider = FutureProvider<PreferenceProfile>((ref) {
  final auth = ref.watch(authControllerProvider).value;
  if (auth?.isAuthenticated != true) {
    return const PreferenceProfile(
      settings: PersonalizationSettings.defaults(),
      consents: [],
      items: [],
    );
  }
  return ref.watch(personalizationServiceProvider).loadProfile();
});

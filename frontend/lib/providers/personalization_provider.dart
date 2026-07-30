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

final messageFeedbackProvider =
    NotifierProvider<MessageFeedbackController, Map<String, String>>(
      MessageFeedbackController.new,
    );

class MessageFeedbackController extends Notifier<Map<String, String>> {
  final Map<String, String> _localFeedback = {};

  @override
  Map<String, String> build() {
    ref.watch(authControllerProvider);
    final profile = ref.watch(personalizationProvider).asData?.value;
    if (profile != null && profile.feedback.isNotEmpty) {
      _localFeedback.addAll(profile.feedback);
    }
    return Map<String, String>.from(_localFeedback);
  }

  void setFeedback(String messageId, String feedbackType) {
    _localFeedback[messageId] = feedbackType;
    state = Map<String, String>.from(_localFeedback);
  }
}


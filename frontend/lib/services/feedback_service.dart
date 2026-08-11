import '../config/env.dart';
import 'api.dart';

class FeedbackService {
  FeedbackService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<void> submitFeedback({
    required String topic,
    required String message,
  }) async {
    final trimmedMessage = message.trim();
    if (trimmedMessage.isEmpty) {
      throw const ApiException('Write a note before sending your feedback.');
    }

    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 180));
      return;
    }

    try {
      await _api.post<Map<String, dynamic>>(
        '/feedback',
        data: {'topic': topic, 'message': trimmedMessage},
      );
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not send your feedback. Please try again.',
      );
    }
  }
}

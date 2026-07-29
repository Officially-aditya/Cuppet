import 'package:dio/dio.dart';

import '../models/assistant_suggestion.dart';
import 'api.dart';

class SuggestionDecisionResult {
  const SuggestionDecisionResult({this.nextMessage});

  final Map<String, dynamic>? nextMessage;
}

class SuggestionService {
  SuggestionService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<SuggestionDecisionResult> decide({
    required String suggestionId,
    required String decision,
  }) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/assistant/suggestions/$suggestionId/decision',
        data: {'decision': decision},
      );
      final next = response.data?['next_message'];
      return SuggestionDecisionResult(
        nextMessage: next is Map ? Map<String, dynamic>.from(next) : null,
      );
    } catch (error) {
      throw apiExceptionFrom(error, 'That suggestion could not be updated.');
    }
  }

  Future<Map<String, dynamic>> explain(String suggestionId) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/assistant/suggestions/$suggestionId/explanation',
      );
      final explanation = response.data?['explanation'];
      return explanation is Map
          ? Map<String, dynamic>.from(explanation)
          : const {};
    } on DioException catch (error) {
      throw apiExceptionFrom(
        error,
        'The suggestion explanation could not be loaded.',
      );
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'The suggestion explanation could not be loaded.',
      );
    }
  }

  Future<void> continueSuggestion(String suggestionId) async {
    try {
      await _api.post<Map<String, dynamic>>(
        '/assistant/suggestions/$suggestionId/continue',
      );
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'The original request could not be resumed after connecting.',
      );
    }
  }
}

AssistantSuggestion? assistantSuggestionFromData(Map<String, dynamic> data) {
  if (data['suggestion_id'] == null) return null;
  return AssistantSuggestion.fromJson(data);
}

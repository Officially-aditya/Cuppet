import '../models/assistant_memory.dart';
import 'api.dart';

class MemoryService {
  MemoryService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  Future<List<AssistantMemory>> listMemories() async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/users/me/assistant-memories',
      );
      final raw = response.data?['memories'];
      return (raw is List ? raw : const [])
          .whereType<Map>()
          .map(
            (item) => AssistantMemory.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(growable: false);
    } catch (error) {
      throw apiExceptionFrom(error, 'We could not load Assistant memory.');
    }
  }

  Future<CompactedMemory?> loadCompactedMemory() async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/users/me/assistant-memories',
      );
      final raw = response.data?['compacted_memory'];
      return raw is Map
          ? CompactedMemory.fromJson(Map<String, dynamic>.from(raw))
          : null;
    } catch (error) {
      throw apiExceptionFrom(error, 'We could not load compacted memory.');
    }
  }

  Future<void> deleteMemory(String memoryId) async {
    try {
      await _api.delete<void>('/users/me/assistant-memories/$memoryId');
    } catch (error) {
      throw apiExceptionFrom(error, 'That memory could not be deleted.');
    }
  }

  Future<void> deleteAllMemories() async {
    try {
      await _api.delete<void>('/users/me/assistant-memories');
    } catch (error) {
      throw apiExceptionFrom(error, 'Assistant memories could not be deleted.');
    }
  }

  Future<void> deleteCompactedMemory() async {
    try {
      await _api.delete<void>('/users/me/assistant-memories/compacted');
    } catch (error) {
      throw apiExceptionFrom(error, 'Compacted memory could not be deleted.');
    }
  }
}

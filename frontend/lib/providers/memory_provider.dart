import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/assistant_memory.dart';
import '../services/memory_service.dart';
import 'auth_provider.dart';

final memoryServiceProvider = Provider<MemoryService>((ref) {
  return MemoryService(api: ref.watch(apiClientProvider));
});

final assistantMemoriesProvider = FutureProvider<List<AssistantMemory>>((ref) {
  return ref.watch(memoryServiceProvider).listMemories();
});

final compactedMemoryProvider = FutureProvider<CompactedMemory?>((ref) {
  return ref.watch(memoryServiceProvider).loadCompactedMemory();
});

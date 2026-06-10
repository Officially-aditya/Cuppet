import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/agent.dart';
import '../services/agent_service.dart';
import 'auth_provider.dart';

final agentServiceProvider = Provider<AgentService>((ref) {
  return AgentService(api: ref.watch(apiClientProvider));
});

final agentsProvider = AsyncNotifierProvider<AgentsController, List<Agent>>(
  AgentsController.new,
);

class AgentsController extends AsyncNotifier<List<Agent>> {
  @override
  Future<List<Agent>> build() {
    return ref.watch(agentServiceProvider).listAgents();
  }

  Future<Agent> createAgent(CreateAgentRequest request) async {
    final created = await ref.read(agentServiceProvider).createAgent(request);
    final current = state.asData?.value ?? const <Agent>[];
    state = AsyncValue.data(Agent.sortForInbox([...current, created]));
    return created;
  }

  Future<void> refresh() async {
    state = const AsyncValue<List<Agent>>.loading();
    state = await AsyncValue.guard(
      () => ref.read(agentServiceProvider).listAgents(),
    );
  }
}

import '../config/env.dart';
import '../models/agent.dart';
import 'api.dart';

class CreateAgentRequest {
  const CreateAgentRequest({required this.prompt, required this.templateId});

  final String prompt;
  final String templateId;

  Map<String, dynamic> toJson() {
    return {'prompt': prompt};
  }
}

class AgentService {
  AgentService({required ApiClient api}) : _api = api;

  final ApiClient _api;
  List<Agent>? _mockAgents;

  Future<List<Agent>> listAgents() async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 260));
      _mockAgents ??= _buildMockAgents();
      return Agent.sortForInbox(_mockAgents!);
    }

    try {
      final response = await _api.get<Map<String, dynamic>>('/agents');
      final rawAgents = response.data?['agents'];
      final agents =
          (rawAgents is List ? rawAgents : const [])
              .whereType<Map>()
              .map((agent) => Agent.fromJson(Map<String, dynamic>.from(agent)))
              .toList();
      return Agent.sortForInbox(agents);
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not load your agents. Pull to refresh and try again.',
      );
    }
  }

  Future<Agent> createAgent(CreateAgentRequest request) async {
    final prompt = request.prompt.trim();
    if (prompt.isEmpty) {
      throw const ApiException('Describe the agent in one sentence first.');
    }

    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 450));
      _mockAgents ??= _buildMockAgents();
      final created = Agent(
        id: 'agent_${DateTime.now().millisecondsSinceEpoch}',
        threadId: 'thread_${DateTime.now().millisecondsSinceEpoch}',
        name: _nameFor(request.templateId),
        avatarInitials: _initialsFor(request.templateId),
        description: prompt,
        lastMessagePreview: 'Setup checklist finalized.',
        latestMessageAt: DateTime.now(),
        accentColor: 0xFF006046,
        parsedIntent: request.templateId == 'tracker'
            ? const {
                'intent': 'habit_tracker',
                'output_template': 'streak_counter',
                'history': {},
              }
            : null,
      );
      _mockAgents = Agent.sortForInbox([..._mockAgents!, created]);
      return created;
    }

    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/agents',
        data: request.toJson(),
      );
      final data = response.data?['agent'];
      if (data is! Map) {
        throw const ApiException('The server did not return the new agent.');
      }
      return Agent.fromJson(Map<String, dynamic>.from(data));
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not create that agent. Please try again.',
      );
    }
  }

  Future<void> archiveAgent(String agentId) async {
    if (Env.useMockData) {
      _mockAgents =
          (_mockAgents ?? _buildMockAgents())
              .where((agent) => agent.id != agentId)
              .toList();
      return;
    }

    try {
      await _api.delete<void>('/agents/$agentId');
    } catch (error) {
      throw apiExceptionFrom(error, 'We could not archive that agent.');
    }
  }

  Future<void> runAgent(String agentId) async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 300));
      return;
    }

    try {
      await _api.post<Map<String, dynamic>>('/agents/$agentId/run');
    } catch (error) {
      throw apiExceptionFrom(error, 'We could not run that agent.');
    }
  }

  Future<void> patchAgent(String agentId, Map<String, dynamic> patch) async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 200));
      return;
    }

    try {
      await _api.patch<Map<String, dynamic>>(
        '/agents/$agentId',
        data: patch,
      );
    } catch (error) {
      throw apiExceptionFrom(error, 'Could not update the agent.');
    }
  }

  Future<Map<String, dynamic>> parseAgentPrompt(String prompt) async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 300));
      return {
        'action': 'Reviews and tracks your study topics.',
        'permissions_needed': ['Google Drive Access'],
        'output_template': 'study_guide',
        'schedule_cron': '0 9 * * *',
      };
    }
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/agents/parse',
        data: {'prompt': prompt},
      );
      final responseData = response.data;
      final parsed = responseData?['parsed_intent'];
      final data = agentConfigurationCompatibilityView({
        if (parsed != null) 'parsed_intent': parsed,
        if (responseData?['configuration'] != null)
          'configuration': responseData?['configuration'],
        if (responseData?['agent_preview'] != null)
          'agent_preview': responseData?['agent_preview'],
      });
      if (data == null) {
        throw const ApiException('The server did not return the parsed intent.');
      }
      return data;
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not analyze that prompt. Please try again.',
      );
    }
  }

  Future<void> executeMessageAction(
    String agentId,
    String messageId,
    String action,
  ) async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 250));
      return;
    }
    try {
      final now = DateTime.now();
      final dateString =
          '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      await _api.post<void>(
        '/agents/$agentId/messages/$messageId/action',
        data: {
          'action': action,
          'date': dateString,
        },
      );
    } catch (error) {
      throw apiExceptionFrom(error, 'Could not complete the study action.');
    }
  }

  Future<void> clearChat(String agentId) async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 200));
      return;
    }

    try {
      await _api.delete<void>('/agents/$agentId/messages');
    } catch (error) {
      throw apiExceptionFrom(error, 'Could not clear the chat.');
    }
  }
}

List<Agent> _buildMockAgents() {
  final now = DateTime.now();
  final yesterday = now.subtract(const Duration(days: 1));
  final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  final yesterdayStr = '${yesterday.year}-${yesterday.month.toString().padLeft(2, '0')}-${yesterday.day.toString().padLeft(2, '0')}';
  final todayAt941 = DateTime(now.year, now.month, now.day, 9, 41);
  return [
    Agent(
      id: 'assistant',
      threadId: 'thread_assistant',
      name: 'Assistant',
      avatarInitials: 'S',
      description: 'Your home base for delegation.',
      lastMessagePreview:
          'I can help you turn a sentence into a useful micro-agent.',
      latestMessageAt: now.subtract(const Duration(minutes: 4)),
      isAssistant: true,
      isPinned: true,
      availability: AgentAvailability.ready,
      accentColor: 0xFF1D7A5C,
    ),
    Agent(
      id: 'ops-watch',
      threadId: 'thread_ops',
      name: 'Ops Watch',
      avatarInitials: 'OW',
      description: 'Tracks deadlines and flags anything slipping.',
      lastMessagePreview: 'Two items need attention before Friday.',
      latestMessageAt: todayAt941,
      unreadCount: 1,
      availability: AgentAvailability.thinking,
      accentColor: 0xFFEA580C,
    ),
    Agent(
      id: 'research-scout',
      threadId: 'thread_research',
      name: 'Research Scout',
      avatarInitials: 'RS',
      description: 'Collects weekly market notes.',
      lastMessagePreview: 'I summarized the latest category shifts.',
      latestMessageAt: now.subtract(const Duration(days: 1)),
      accentColor: 0xFF1E40AF,
    ),
    Agent(
      id: 'dsa-practice',
      threadId: 'thread_dsa_practice',
      name: 'DSA Daily Practice',
      avatarInitials: 'DP',
      description: 'Sends a daily DSA problem and tracks streak progress.',
      lastMessagePreview: 'Problem of the day: Two Sum.',
      latestMessageAt: now.subtract(const Duration(minutes: 10)),
      accentColor: 0xFF0D9488,
      parsedIntent: {
        'intent': 'dsa_question',
        'output_template': 'dsa_question',
        'history': {
          todayStr: true,
          yesterdayStr: true,
        }
      },
    ),
  ];
}

String _nameFor(String templateId) {
  return switch (templateId) {
    'tracker' => 'Progress Agent',
    'urgent' => 'Priority Agent',
    'summary' => 'Summary Agent',
    'checklist' => 'Checklist Agent',
    _ => 'Custom Agent',
  };
}

String _initialsFor(String templateId) {
  return switch (templateId) {
    'tracker' => 'PA',
    'urgent' => 'PR',
    'summary' => 'SA',
    'checklist' => 'CA',
    _ => 'NA',
  };
}

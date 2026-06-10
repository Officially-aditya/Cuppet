import '../config/env.dart';
import '../models/message.dart';
import 'api.dart';

class MessageService {
  MessageService({required ApiClient api}) : _api = api;

  final ApiClient _api;
  final Map<String, List<Message>> _mockThreads = {};

  Future<List<Message>> fetchThread(String threadId) async {
    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 260));
      _mockThreads.putIfAbsent(threadId, () => _mockThread(threadId));
      return List<Message>.unmodifiable(_mockThreads[threadId]!);
    }

    try {
      final response = await _api.get<Map<String, dynamic>>(
        '/agents/$threadId/messages',
      );
      final rawMessages = response.data?['messages'];
      return (rawMessages is List ? rawMessages : const [])
          .whereType<Map>()
          .map(
            (message) => Message.fromJson(Map<String, dynamic>.from(message)),
          )
          .toList();
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not load this conversation. Check your connection and try again.',
      );
    }
  }

  Future<Message> sendReply({
    required String threadId,
    required String text,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) {
      throw const ApiException('Write a reply before sending.');
    }

    if (Env.useMockData) {
      await Future<void>.delayed(const Duration(milliseconds: 180));
      _mockThreads.putIfAbsent(threadId, () => _mockThread(threadId));
      final message = Message.plainText(
        id: 'message_${DateTime.now().microsecondsSinceEpoch}',
        threadId: threadId,
        sender: MessageSender.user,
        text: trimmed,
      );
      _mockThreads[threadId] = [..._mockThreads[threadId]!, message];
      return message;
    }

    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/agents/$threadId/messages',
        data: {'text': trimmed},
      );
      final data = response.data?['message'];
      if (data is! Map) {
        throw const ApiException('The server did not return your message.');
      }
      return Message.fromJson(Map<String, dynamic>.from(data));
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'Your reply was not sent. Please try again.',
      );
    }
  }
}

List<Message> _mockThread(String threadId) {
  final now = DateTime.now();
  if (threadId == 'thread_ops') {
    return [
      Message.system(
        id: 'ops_system_1',
        threadId: threadId,
        text: 'Ops Watch was created from your Monday planning prompt.',
        createdAt: now.subtract(const Duration(days: 1, hours: 3)),
      ),
      Message(
        id: 'ops_1',
        threadId: threadId,
        sender: MessageSender.agent,
        createdAt: now.subtract(const Duration(hours: 2, minutes: 40)),
        content: {
          'template': 'urgency_list',
          'data': {
            'title': 'Needs attention',
            'items': [
              {
                'label': 'Approve vendor renewal',
                'urgency': 'high',
                'due': 'Today',
              },
              {
                'label': 'Send launch notes to support',
                'urgency': 'medium',
                'due': 'Tomorrow',
              },
            ],
          },
        },
      ),
      Message(
        id: 'ops_2',
        threadId: threadId,
        sender: MessageSender.agent,
        createdAt: now.subtract(const Duration(hours: 1, minutes: 22)),
        content: {
          'template': 'checklist',
          'data': {
            'title': 'Launch handoff',
            'items': [
              {'label': 'Draft owner notes', 'checked': true},
              {'label': 'Confirm support coverage', 'checked': false},
              {'label': 'Share customer list', 'checked': false},
            ],
          },
        },
      ),
    ];
  }

  if (threadId == 'thread_research') {
    return [
      Message.system(
        id: 'research_system_1',
        threadId: threadId,
        text: 'Assistant is pinned so you always have a place to start.',
        createdAt: now.subtract(const Duration(hours: 7)),
      ),
      Message(
        id: 'research_intro',
        threadId: threadId,
        sender: MessageSender.agent,
        createdAt: now.subtract(const Duration(hours: 6, minutes: 45)),
        content: {
          'template': 'plain_text',
          'data': {
            'text':
                'Tell me what you want watched, summarized, reminded, or prepared. One sentence is enough.',
          },
        },
      ),
      Message.plainText(
        id: 'research_user_1',
        threadId: threadId,
        sender: MessageSender.user,
        text: 'Summarize the latest category shifts for the market pulse.',
        createdAt: now.subtract(const Duration(hours: 6, minutes: 15)),
      ),
      Message(
        id: 'research_1',
        threadId: threadId,
        sender: MessageSender.agent,
        createdAt: now.subtract(const Duration(hours: 6)),
        content: {
          'template': 'data_summary',
          'data': {
            'title': 'Market pulse',
            'summary':
                'Demand is shifting toward lighter setup and clearer privacy controls.',
            'metrics': [
              {'label': 'Sources checked', 'value': '18'},
              {'label': 'Strong signals', 'value': '5'},
              {'label': 'Noise filtered', 'value': '42%'},
            ],
          },
        },
      ),
      Message(
        id: 'research_2',
        threadId: threadId,
        sender: MessageSender.agent,
        createdAt: now.subtract(const Duration(hours: 5, minutes: 8)),
        content: {
          'template': 'streak_counter',
          'data': {
            'label': 'Delegation streak',
            'count': 3,
            'unit': 'days',
            'caption': 'Small, steady handoffs build trust.',
          },
        },
      ),
    ];
  }

  return [
    Message.system(
      id: 'assistant_system_1',
      threadId: threadId,
      text: 'Assistant is pinned so you always have a place to start.',
      createdAt: now.subtract(const Duration(hours: 2)),
    ),
    Message(
      id: 'assistant_1',
      threadId: threadId,
      sender: MessageSender.agent,
      createdAt: now.subtract(const Duration(minutes: 44)),
      content: {
        'template': 'plain_text',
        'data': {
          'text':
              'Tell me what you want watched, summarized, reminded, or prepared. One sentence is enough.',
        },
      },
    ),
    Message(
      id: 'assistant_2',
      threadId: threadId,
      sender: MessageSender.agent,
      createdAt: now.subtract(const Duration(minutes: 22)),
      content: {
        'template': 'progress_tracker',
        'data': {
          'title': 'Agent setup guide',
          'current': 2,
          'total': 4,
          'steps': [
            {'label': 'Describe the job', 'done': true},
            {'label': 'Review the plan', 'done': true},
            {'label': 'Connect tools', 'done': false},
            {'label': 'Start receiving updates', 'done': false},
          ],
        },
      },
    ),
    Message(
      id: 'assistant_3',
      threadId: threadId,
      sender: MessageSender.agent,
      createdAt: now.subtract(const Duration(minutes: 4)),
      content: {
        'template': 'streak_counter',
        'data': {
          'label': 'Delegation streak',
          'count': 3,
          'unit': 'days',
          'caption': 'Small, steady handoffs build trust.',
        },
      },
    ),
  ];
}

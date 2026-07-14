import 'dart:convert';

import '../config/env.dart';
import '../models/agent.dart';
import '../models/message.dart';
import 'api.dart';

class SendReplyResult {
  const SendReplyResult({required this.message, this.updatedAgent});

  final Message message;
  final Agent? updatedAgent;
}

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
      final messages =
          (rawMessages is List ? rawMessages : const [])
              .whereType<Map>()
              .map(
                (message) =>
                    Message.fromJson(Map<String, dynamic>.from(message)),
              )
              .toList();
      return deduplicateMessages(messages);
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not load this conversation. Check your connection and try again.',
      );
    }
  }

  Future<List<Message>> fetchBriefings() async {
    if (Env.useMockData) return const [];
    try {
      final response = await _api.get<Map<String, dynamic>>('/briefings');
      final rawBriefings = response.data?['briefings'];
      return (rawBriefings is List ? rawBriefings : const [])
          .whereType<Map>()
          .map(
            (message) => Message.fromJson(Map<String, dynamic>.from(message)),
          )
          .toList();
    } catch (error) {
      throw apiExceptionFrom(error, 'We could not load your briefings.');
    }
  }

  Future<SendReplyResult> sendReply({
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
      final reply = Message(
        id: 'reply_${DateTime.now().microsecondsSinceEpoch}',
        threadId: threadId,
        sender: MessageSender.agent,
        createdAt: DateTime.now().add(const Duration(milliseconds: 1)),
        content: {
          'template': 'data_summary',
          'data': {
            'text':
                "Processed instructions: '$trimmed'. Based on your connected tools, I identified relevant items matching this pattern.",
            'title': 'Dynamic Agent Insights',
            'summary': 'Auto-analysis matching query filters.',
            'metrics': [
              {'label': 'SOURCES ANALYZED', 'value': '14'},
              {'label': 'RELEVANCE LEVEL', 'value': 'High'},
              {'label': 'CONFIDENCE', 'value': '98%'},
            ],
          },
        },
      );
      _mockThreads[threadId] = [..._mockThreads[threadId]!, message, reply];
      return SendReplyResult(message: message);
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
      final rawAgent = response.data?['agent'];
      return SendReplyResult(
        message: Message.fromJson(Map<String, dynamic>.from(data)),
        updatedAgent:
            rawAgent is Map
                ? Agent.fromJson(Map<String, dynamic>.from(rawAgent))
                : null,
      );
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'Your reply was not sent. Please try again.',
      );
    }
  }

  Future<String> handoffToAssistant({
    required String agentId,
    required String messageId,
  }) async {
    if (Env.useMockData) return 'assistant';
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/agents/$agentId/messages/$messageId/assistant-handoff',
      );
      final assistantId = response.data?['assistant_agent_id']?.toString();
      if (assistantId == null || assistantId.isEmpty) {
        throw const ApiException(
          'The Assistant conversation was not returned.',
        );
      }
      return assistantId;
    } catch (error) {
      throw apiExceptionFrom(
        error,
        'We could not open this briefing with Assistant.',
      );
    }
  }
}

List<Message> deduplicateMessages(
  List<Message> messages, {
  Duration window = const Duration(minutes: 10),
}) {
  final result = <Message>[];

  for (final message in messages) {
    final previous = result.isEmpty ? null : result.last;
    final isAdjacentAgentDuplicate =
        previous != null &&
        message.sender == MessageSender.agent &&
        previous.sender == MessageSender.agent &&
        message.threadId == previous.threadId &&
        message.createdAt.difference(previous.createdAt).abs() <= window &&
        jsonEncode(message.content) == jsonEncode(previous.content);

    if (!isAdjacentAgentDuplicate) {
      result.add(message);
    }
  }

  return result;
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
            'text':
                'Ready to summarize. Below is the parsed market pulse summary generated based on connected insights.',
            'title': 'Market pulse',
            'summary':
                'Demand is shifting toward lighter setup and clearer privacy controls.',
            'metrics': [
              {'label': 'SOURCES CHECKED', 'value': '18'},
              {'label': 'STRONG SIGNALS', 'value': '5'},
              {'label': 'NOISE FILTERED', 'value': '42%'},
            ],
          },
        },
      ),
      Message.system(
        id: 'research_2',
        threadId: threadId,
        text: 'Delegation streak: 3 days. Small, steady handoffs build trust.',
        createdAt: now.subtract(const Duration(hours: 5, minutes: 8)),
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
      id: 'assistant_user_1',
      threadId: threadId,
      sender: MessageSender.user,
      createdAt: now.subtract(const Duration(minutes: 22)),
      content: {
        'template': 'plain_text',
        'data': {
          'text': 'Summarize the latest category shifts for the market pulse.',
        },
      },
    ),
    Message(
      id: 'assistant_2',
      threadId: threadId,
      sender: MessageSender.agent,
      createdAt: now.subtract(const Duration(minutes: 4)),
      content: {
        'template': 'data_summary',
        'data': {
          'text':
              'Ready to summarize. Below is the parsed market pulse summary generated based on connected insights.',
          'title': 'Market pulse',
          'summary':
              'Demand is shifting toward lighter setup and clearer privacy controls.',
          'metrics': [
            {'label': 'SOURCES CHECKED', 'value': '18'},
            {'label': 'STRONG SIGNALS', 'value': '5'},
            {'label': 'NOISE FILTERED', 'value': '42%'},
          ],
        },
      },
    ),
    Message.system(
      id: 'assistant_system_2',
      threadId: threadId,
      text: 'Delegation streak: 3 days. Small, steady handoffs build trust.',
      createdAt: now.subtract(const Duration(minutes: 3)),
    ),
  ];
}

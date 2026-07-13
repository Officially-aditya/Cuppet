import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/agent.dart';
import 'package:sydney/models/message.dart';
import 'package:sydney/models/connector.dart';
import 'package:sydney/services/message_service.dart';

void main() {
  test('agent maps Sydney backend fields', () {
    final agent = Agent.fromJson({
      'id': 'agent_1',
      'name': 'Tech News',
      'prompt': 'Send me a tech news brief.',
      'parsed_intent': {'action': 'Searches and summarizes technology news.'},
      'description': 'Searches and summarizes technology news.',
      'last_message_preview': 'Tech news brief is ready.',
      'status': 'active',
      'is_assistant': false,
      'last_message_at': '2026-06-09T12:00:00.000Z',
    });

    expect(agent.id, 'agent_1');
    expect(agent.threadId, 'agent_1');
    expect(agent.avatarInitials, 'TN');
    expect(agent.description, 'Searches and summarizes technology news.');
    expect(agent.lastMessagePreview, 'Tech news brief is ready.');
    expect(agent.availability, AgentAvailability.ready);
  });

  test('agent maps its persisted notification preference', () {
    final muted = Agent.fromJson({
      'id': 'agent_1',
      'parsed_intent': {'notifications_muted': true},
    });
    final defaultAgent = Agent.fromJson({'id': 'agent_2'});

    expect(muted.notificationsMuted, isTrue);
    expect(defaultAgent.notificationsMuted, isFalse);
  });

  test('message maps Sydney backend fields', () {
    final message = Message.fromJson({
      'id': 'message_1',
      'agent_id': 'agent_1',
      'role': 'agent',
      'content': {
        'template': 'plain_text',
        'version': '1.0',
        'data': {'body': 'Tech news brief for today.'},
      },
      'created_at': '2026-06-09T12:01:00.000Z',
    });

    expect(message.id, 'message_1');
    expect(message.threadId, 'agent_1');
    expect(message.sender, MessageSender.agent);
    expect(message.template, 'plain_text');
    expect(message.preview, 'Tech news brief for today.');
  });

  test('adjacent duplicate agent deliveries are collapsed', () {
    final first = Message.plainText(
      id: 'message_1',
      threadId: 'agent_1',
      sender: MessageSender.agent,
      text: 'Daily goal',
      createdAt: DateTime.utc(2026, 6, 20, 9),
    );
    final duplicate = Message.plainText(
      id: 'message_2',
      threadId: 'agent_1',
      sender: MessageSender.agent,
      text: 'Daily goal',
      createdAt: DateTime.utc(2026, 6, 20, 9, 1),
    );

    expect(deduplicateMessages([first, duplicate]), [first]);
  });

  test(
    'known GitHub connector always uses OAuth instead of a status toggle',
    () {
      const connector = Connector(
        id: 'github',
        name: 'GitHub',
        description: 'Repository activity',
        status: ConnectorStatus.disconnected,
        requiredScopes: ['Read GitHub profile'],
        authConfigured: false,
      );

      expect(connector.shouldUseOAuth, isTrue);
    },
  );
}

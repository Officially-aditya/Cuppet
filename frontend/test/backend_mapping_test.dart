import 'package:flutter_test/flutter_test.dart';
import 'package:sydney/models/agent.dart';
import 'package:sydney/models/message.dart';
import 'package:sydney/models/connector.dart';
import 'package:sydney/models/access_connection.dart';
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

  test('agent prefers the versioned configuration over legacy intent', () {
    final agent = Agent.fromJson({
      'id': 'agent_1',
      'name': 'News',
      'parsed_intent': {
        'intent': 'stale_intent',
        'action': 'Stale action',
        'notifications_muted': false,
      },
      'configuration': {
        'schema_version': 1,
        'recipe_id': 'news_brief',
        'supports_realtime': false,
        'goal': 'Current goal',
        'instructions': ['Current action'],
        'trigger': {'type': 'schedule', 'cron': '0 7 * * *'},
        'output': {'contract': 'news_brief'},
        'policy': {
          'response_limit': 'concise',
          'notifications_muted': true,
          'active_until': null,
        },
        'permissions_needed': ['Web search (no login needed)'],
      },
    });

    expect(agent.description, 'Current action');
    expect(agent.notificationsMuted, isTrue);
    expect(agent.parsedIntent?['intent'], 'news_brief');
    expect(agent.parsedIntent?['schedule_cron'], '0 7 * * *');
    expect(agent.parsedIntent?['output_template'], 'news_brief');
    expect(agent.parsedIntent?['supports_realtime'], isFalse);
    expect(agent.supportsRealtime, isFalse);
  });

  test('agent chat update response refreshes its functional description', () {
    final updated = Agent.fromJson({
      'id': 'agent_1',
      'name': 'Tech News',
      'prompt': 'Original prompt\n\nUser update: include security news',
      'parsed_intent': {
        'action': 'Summarizes technology news. Also: include security news.',
      },
      'status': 'active',
    });

    expect(
      updated.description,
      'Summarizes technology news. Also: include security news.',
    );
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

  test('adjacent duplicate agent deliveries retain the newest message', () {
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

    expect(deduplicateMessages([first, duplicate]), [duplicate]);
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

  test(
    'known Slack connector always uses OAuth instead of a status toggle',
    () {
      const connector = Connector(
        id: 'slack',
        name: 'Slack',
        description: 'Channel activity',
        status: ConnectorStatus.disconnected,
        requiredScopes: ['Read selected channels'],
        authConfigured: false,
      );

      expect(connector.shouldUseOAuth, isTrue);
    },
  );

  test(
    'known Notion connector always uses OAuth instead of a status toggle',
    () {
      const connector = Connector(
        id: 'notion',
        name: 'Notion',
        description: 'Workspace pages',
        status: ConnectorStatus.disconnected,
        requiredScopes: ['Read selected pages'],
        authConfigured: false,
      );

      expect(connector.shouldUseOAuth, isTrue);
    },
  );

  test('generic connectors use server-declared OAuth metadata', () {
    final connector = Connector.fromJson({
      'id': 'mcp.crm',
      'provider_id': 'mcp.crm',
      'name': 'CRM',
      'description': 'Read CRM records',
      'status': 'disconnected',
      'auth_method': 'oauth2',
      'connection_id': 'connection_1',
      'required_scopes': const <String>[],
    });

    expect(connector.shouldUseOAuth, isTrue);
    expect(connector.providerId, 'mcp.crm');
    expect(connector.connectionId, 'connection_1');
  });

  test('generic access connections accept backend snake case fields', () {
    final connection = AccessConnection.fromJson({
      'id': 'connection_1',
      'provider_id': 'mcp.crm',
      'provider_kind': 'mcp',
      'status': 'action_required',
      'account_label': 'Workspace',
      'capabilities': ['records.read'],
    });

    expect(connection.providerId, 'mcp.crm');
    expect(connection.status, AccessConnectionStatus.actionRequired);
    expect(connection.accountLabel, 'Workspace');
  });
}

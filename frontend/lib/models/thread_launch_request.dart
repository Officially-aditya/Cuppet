import 'agent.dart';

class ThreadLaunchRequest {
  const ThreadLaunchRequest({required this.agent, this.initialMessage});

  final Agent agent;
  final String? initialMessage;
}

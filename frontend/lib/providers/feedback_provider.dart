import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/feedback_service.dart';
import 'auth_provider.dart';

final feedbackServiceProvider = Provider<FeedbackService>((ref) {
  return FeedbackService(api: ref.watch(apiClientProvider));
});

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/access_connection.dart';
import '../services/access_service.dart';
import 'auth_provider.dart';

final accessServiceProvider = Provider<AccessService>((ref) {
  return AccessService(api: ref.watch(apiClientProvider));
});

final accessConnectionsProvider =
    AsyncNotifierProvider<AccessConnectionsController, List<AccessConnection>>(
      AccessConnectionsController.new,
    );

class AccessConnectionsController
    extends AsyncNotifier<List<AccessConnection>> {
  @override
  Future<List<AccessConnection>> build() {
    final auth = ref.watch(authControllerProvider).value;
    if (auth?.isAuthenticated != true) {
      return Future.value(const <AccessConnection>[]);
    }
    return ref.watch(accessServiceProvider).listConnections();
  }

  Future<void> disconnect(String connectionId) async {
    await ref.read(accessServiceProvider).disconnect(connectionId);
    ref.invalidateSelf();
  }
}

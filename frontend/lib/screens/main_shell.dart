import 'package:flutter/material.dart';

import '../widgets/app_bottom_nav.dart';
import 'connectors/connectors_screen.dart';
import 'inbox/inbox_screen.dart';
import 'settings/settings_screen.dart';

/// Keeps the app's primary navigation mounted while destinations change.
class MainShell extends StatefulWidget {
  const MainShell({this.initialIndex = 0, super.key})
    : assert(initialIndex >= 0 && initialIndex < 3);

  final int initialIndex;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  late int _currentIndex;

  static const _destinations = <Widget>[
    InboxScreen(),
    ConnectorsScreen(),
    SettingsScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
  }

  void _selectDestination(int index) {
    if (index == _currentIndex) return;
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _destinations),
      bottomNavigationBar: AppBottomNav(
        key: const ValueKey('main-bottom-navigation'),
        currentIndex: _currentIndex,
        onSelected: _selectDestination,
      ),
    );
  }
}

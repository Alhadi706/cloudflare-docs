import 'package:flutter/material.dart';

class ScopedHomeScreen extends StatelessWidget {
  const ScopedHomeScreen({
    super.key,
    required this.scope,
    required this.onLogout,
  });

  final String scope;
  final VoidCallback onLogout;

  String get _title {
    switch (scope) {
      case 'maintenance':
        return 'واجهة إدارة الصيانة';
      case 'corrosion':
        return 'واجهة إدارة التآكل';
      case 'admin-affairs':
        return 'واجهة الشؤون الإدارية';
      case 'finance':
        return 'واجهة الإدارة المالية';
      case 'materials':
        return 'واجهة إدارة المواد';
      case 'services':
        return 'واجهة الذكاء والخدمات';
      case 'remote-sensing':
        return 'واجهة الاستشعار عن بعد';
      default:
        return 'واجهة الإدارة';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_title),
        actions: [
          IconButton(
            onPressed: onLogout,
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              'App Scope: $scope',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 10),
            const Text(
              'هذا أساس Flutter Native.\nالخطوة التالية: نقل صفحات الإدارة من React إلى Widgets.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

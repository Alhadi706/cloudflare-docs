import 'package:flutter/material.dart';

class InstallScreen extends StatelessWidget {
  const InstallScreen({
    super.key,
    required this.onScopeSelected,
  });

  final ValueChanged<String> onScopeSelected;

  static const _scopes = <Map<String, String>>[
    {'id': 'maintenance', 'label': 'إدارة الصيانة'},
    {'id': 'corrosion', 'label': 'إدارة التآكل'},
    {'id': 'admin-affairs', 'label': 'الشؤون الإدارية'},
    {'id': 'finance', 'label': 'الإدارة المالية'},
    {'id': 'materials', 'label': 'إدارة المواد'},
    {'id': 'services', 'label': 'الذكاء والخدمات'},
    {'id': 'remote-sensing', 'label': 'الاستشعار عن بعد'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('اختر الإدارة')),
      body: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 2.4,
        ),
        itemCount: _scopes.length,
        itemBuilder: (context, index) {
          final scope = _scopes[index];
          return ElevatedButton(
            onPressed: () => onScopeSelected(scope['id']!),
            child: Text(scope['label']!),
          );
        },
      ),
    );
  }
}

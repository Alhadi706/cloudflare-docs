import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../config/env.dart';

class ScopedHomeScreen extends StatefulWidget {
  const ScopedHomeScreen({
    super.key,
    required this.scope,
    required this.token,
    required this.role,
    required this.tenantId,
    required this.tenantCode,
    required this.departmentCode,
    required this.homeRoute,
    required this.onLogout,
  });

  final String scope;
  final String token;
  final String role;
  final String? tenantId;
  final String? tenantCode;
  final String? departmentCode;
  final String homeRoute;
  final VoidCallback onLogout;

  @override
  State<ScopedHomeScreen> createState() => _ScopedHomeScreenState();
}

class _ScopedHomeScreenState extends State<ScopedHomeScreen> {
  late final WebViewController _controller;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  String get _startUrl {
    final base = Env.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
    // Go to the department's specific home route
    final path = widget.homeRoute.isNotEmpty ? widget.homeRoute : '/dashboard';
    return '$base$path';
  }

  /// Injects auth context into the WebView's localStorage and sets cookies
  /// so the Next.js app treats the user as authenticated.
  String _buildInjectionScript() {
    // Escape values for JS string literals
    String esc(String? v) {
      if (v == null || v.isEmpty) return '';
      return v
          .replaceAll('\\', '\\\\')
          .replaceAll("'", "\\'")
          .replaceAll('\n', '\\n');
    }

    final base = Env.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
    final scope = widget.scope == 'all' ? '' : widget.scope;
    final exp = DateTime.now().add(const Duration(days: 7)).toUtc().toString();

    return '''
(function() {
  // Auth token + user context
  localStorage.setItem('auth_token',     '${esc(widget.token)}');
  localStorage.setItem('user_role',      '${esc(widget.role)}');
  localStorage.setItem('dept_code',      '${esc(widget.departmentCode)}');
  localStorage.setItem('tenant_id',      '${esc(widget.tenantId)}');
  localStorage.setItem('active_tenant_id','${esc(widget.tenantId)}');
  localStorage.setItem('tenant_code',    '${esc(widget.tenantCode)}');
  localStorage.setItem('active_tenant_code','${esc(widget.tenantCode)}');
  if ('${esc(scope)}'.length > 0) {
    localStorage.setItem('launch_app', '${esc(scope)}');
  }

  // Session cookies so middleware sees the user as authenticated
  document.cookie = 'auth_session=1; path=/; SameSite=Lax';
  document.cookie = 'user_role=${esc(widget.role)}; path=/; SameSite=Lax';
  document.cookie = 'user_dept=${esc(widget.departmentCode ?? '')}; path=/; SameSite=Lax';
  if ('${esc(scope)}'.length > 0) {
    document.cookie = 'app_scope=${esc(scope)}; path=/; SameSite=Lax';
  }
  window.__dsf_flutter = true;
})();
''';
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0a0a0f))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _ready = false),
          onPageFinished: (url) async {
            // Inject auth after page HTML loaded
            await _controller.runJavaScript(_buildInjectionScript());
            // If landed on /entry (not yet authenticated), push to homeRoute
            if (url.contains('/entry') && !url.contains('/entry/install')) {
              await _controller.runJavaScript(
                "window.location.href = '${_startUrl.replaceAll("'", "\\'")}';",
              );
            }
            setState(() => _ready = true);
          },
        ),
      )
      ..loadRequest(Uri.parse(_startUrl));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0a0a0f),
        foregroundColor: Colors.white,
        title: Text(
          _deptLabel(widget.scope),
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        actions: [
          if (!_ready)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 12),
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white54),
              ),
            ),
          IconButton(
            onPressed: widget.onLogout,
            icon: const Icon(Icons.logout, size: 20),
            tooltip: 'تسجيل الخروج',
          ),
        ],
      ),
      body: WebViewWidget(controller: _controller),
    );
  }

  String _deptLabel(String scope) {
    switch (scope) {
      case 'maintenance':    return 'إدارة الصيانة';
      case 'corrosion':      return 'إدارة التآكل';
      case 'admin-affairs':  return 'الشؤون الإدارية';
      case 'finance':        return 'الإدارة المالية';
      case 'materials':      return 'إدارة المواد';
      case 'services':       return 'الذكاء والخدمات';
      case 'remote-sensing': return 'الاستشعار عن بعد';
      default:               return 'DSF Dashboard';
    }
  }
}


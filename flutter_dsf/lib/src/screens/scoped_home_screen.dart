import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_windows/webview_windows.dart';

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
  final _controller = WebviewController();
  StreamSubscription<LoadingState>? _loadingSub;

  bool _initialized = false;
  bool _loading     = false;
  String? _errorMsg;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  @override
  void dispose() {
    _loadingSub?.cancel();
    _controller.dispose();
    super.dispose();
  }

  String get _startUrl {
    final base = Env.apiBaseUrl.replaceAll(RegExp(r'/$'), '');
    final path = widget.homeRoute.isNotEmpty ? widget.homeRoute : '/dashboard';
    return '$base$path';
  }

  /// Injects auth context into the WebView's localStorage and sets cookies
  /// so the Next.js app treats the user as authenticated.
  String _buildInjectionScript() {
    String esc(String? v) {
      if (v == null || v.isEmpty) return '';
      return v
          .replaceAll('\\', '\\\\')
          .replaceAll("'", "\\'")
          .replaceAll('\n', '\\n');
    }

    final scope = widget.scope == 'all' ? '' : widget.scope;

    return '''
(function() {
  localStorage.setItem('auth_token',          '${esc(widget.token)}');
  localStorage.setItem('user_role',           '${esc(widget.role)}');
  localStorage.setItem('dept_code',           '${esc(widget.departmentCode)}');
  localStorage.setItem('tenant_id',           '${esc(widget.tenantId)}');
  localStorage.setItem('active_tenant_id',    '${esc(widget.tenantId)}');
  localStorage.setItem('tenant_code',         '${esc(widget.tenantCode)}');
  localStorage.setItem('active_tenant_code',  '${esc(widget.tenantCode)}');
  if ('${esc(scope)}'.length > 0) {
    localStorage.setItem('launch_app', '${esc(scope)}');
  }

  // Auth cookies for Next.js middleware (auth_session must contain the JWT)
  document.cookie = 'auth_session=${esc(widget.token)}; path=/; SameSite=Lax';
  document.cookie = 'user_role=${esc(widget.role)}; path=/; SameSite=Lax';
  document.cookie = 'user_dept=${esc(widget.departmentCode ?? '')}; path=/; SameSite=Lax';
  if ('${esc(scope)}'.length > 0) {
    document.cookie = 'app_scope=${esc(scope)}; path=/; SameSite=Lax';
  }
  window.__dsf_flutter = true;
})();
''';
  }

  Future<void> _initWebView() async {
    try {
      await _controller.initialize();

      _loadingSub = _controller.loadingState.listen((state) async {
        if (!mounted) return;
        if (state == LoadingState.loading) {
          setState(() => _loading = true);
          return;
        }
        if (state == LoadingState.navigationCompleted) {
          await _controller.executeScript(_buildInjectionScript());
          final url = await _controller.url;
          if ((url ?? '').contains('/entry') &&
              !(url ?? '').contains('/entry/install')) {
            await _controller.loadUrl(_startUrl);
            return;
          }
          if (mounted) setState(() { _initialized = true; _loading = false; });
        }
      });

      await _controller.loadUrl(_startUrl);
    } catch (e) {
      if (mounted) setState(() => _errorMsg = e.toString());
    }
  }

  Future<void> _openInBrowser() async {
    final uri = Uri.parse(_startUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_errorMsg != null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0a0a0f),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 56),
                const SizedBox(height: 20),
                const Text(
                  'يتطلب التطبيق Microsoft Edge WebView2',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                const Text(
                  'قم بتثبيت Microsoft Edge أو WebView2 Runtime\nثم أعد تشغيل التطبيق',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white60, height: 1.6),
                ),
                const SizedBox(height: 28),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF38bdf8),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                  onPressed: _openInBrowser,
                  icon: const Icon(Icons.open_in_browser),
                  label: const Text('فتح لوحة التحكم في المتصفح'),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: widget.onLogout,
                  child: const Text('تسجيل الخروج', style: TextStyle(color: Colors.white38)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF0a0a0f),
        foregroundColor: Colors.white,
        elevation: 0,
        title: Text(
          _deptLabel(widget.scope),
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        actions: [
          if (_loading)
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
      body: _initialized
          ? WebviewWidget(controller: _controller)
          : const Center(child: CircularProgressIndicator()),
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


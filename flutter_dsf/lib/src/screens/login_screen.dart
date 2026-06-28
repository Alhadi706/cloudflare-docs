import 'package:flutter/material.dart';

import '../models/auth_session.dart';
import '../services/auth_api.dart';
import '../config/env.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.onLoginSuccess,
  });

  final ValueChanged<AuthSession> onLoginSuccess;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  // Stage 1
  final _tenantCtrl = TextEditingController();
  String? _orgName;        // confirmed org display name
  bool   _orgVerified = false;

  // Stage 2
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();

  final _api = AuthApi();
  bool  _loading = false;
  String? _error;
  int _stage = 1;         // 1 = org, 2 = credentials

  @override
  void dispose() {
    _tenantCtrl.dispose();
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  // ── Stage 1: Verify org code ─────────────────────────────────────────────
  Future<void> _verifyOrg() async {
    final code = _tenantCtrl.text.trim().toLowerCase();
    if (code.isEmpty) {
      setState(() => _error = 'أدخل رمز المؤسسة');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final uri = Uri.parse('${Env.apiBaseUrl}/api/auth/lookup-tenant');
      final res = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'tenant_code': code}),
      );
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        setState(() {
          _orgName   = body['name']?.toString() ?? code;
          _orgVerified = true;
          _stage     = 2;
        });
      } else {
        setState(() => _error = 'رمز المؤسسة غير موجود أو غير مفعّل');
      }
    } catch (_) {
      setState(() => _error = 'تعذر الاتصال بالخادم');
    } finally {
      setState(() => _loading = false);
    }
  }

  // ── Stage 2: Login with credentials ──────────────────────────────────────
  Future<void> _login() async {
    if (_userCtrl.text.trim().isEmpty) {
      setState(() => _error = 'أدخل اسم المستخدم');
      return;
    }
    if (_passCtrl.text.isEmpty) {
      setState(() => _error = 'أدخل كلمة المرور');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final session = await _api.loginCredentials(
        tenantCode: _tenantCtrl.text,
        username:   _userCtrl.text,
        password:   _passCtrl.text,
      );
      widget.onLoginSuccess(session);
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: const Color(0xFF0a0a0f),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Card(
              color: const Color(0xFF0d1a2d),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              margin: const EdgeInsets.all(24),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header
                    Row(
                      children: [
                        Container(
                          width: 36, height: 36,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF3b82f6), Color(0xFF06b6d4)],
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.shield, color: Colors.white, size: 18),
                        ),
                        const SizedBox(width: 10),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('منصة الخدمات السيادية',
                              style: TextStyle(fontSize: 10, color: Colors.white54)),
                            Text('Digital Sovereignty Force',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Progress bar
                    Row(children: [
                      Expanded(child: Container(height: 3,
                        decoration: BoxDecoration(
                          color: _stage >= 1 ? const Color(0xFF06b6d4) : const Color(0xFF1e293b),
                          borderRadius: BorderRadius.circular(2),
                        ))),
                      const SizedBox(width: 4),
                      Expanded(child: Container(height: 3,
                        decoration: BoxDecoration(
                          color: _stage >= 2 ? const Color(0xFF3b82f6) : const Color(0xFF1e293b),
                          borderRadius: BorderRadius.circular(2),
                        ))),
                    ]),
                    const SizedBox(height: 20),

                    // ── Stage 1: Org code ──
                    if (_stage == 1) ...[
                      const Text('دخول المنصة',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                      const SizedBox(height: 4),
                      const Text('أدخل رمز مؤسستك للمتابعة',
                        style: TextStyle(fontSize: 12, color: Colors.white38)),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _tenantCtrl,
                        textDirection: TextDirection.ltr,
                        decoration: const InputDecoration(
                          labelText: 'رمز المؤسسة',
                          hintText: 'مثال: 20-6',
                          prefixIcon: Icon(Icons.business),
                        ),
                        onSubmitted: (_) => _verifyOrg(),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: _loading ? null : _verifyOrg,
                        icon: _loading
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.arrow_back_ios, size: 16),
                        label: Text(_loading ? 'جارٍ التحقق...' : 'التالي'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1d4ed8),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ],

                    // ── Stage 2: Credentials ──
                    if (_stage == 2) ...[
                      // Org banner
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0f2236),
                          border: Border.all(color: const Color(0xFF1e3a5f)),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle, color: Color(0xFF06b6d4), size: 18),
                            const SizedBox(width: 8),
                            Expanded(child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('المؤسسة',
                                  style: TextStyle(fontSize: 10, color: Colors.white38)),
                                Text(_orgName ?? _tenantCtrl.text,
                                  style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
                              ],
                            )),
                            TextButton(
                              onPressed: () => setState(() { _stage = 1; _error = null; }),
                              child: const Text('تغيير', style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _userCtrl,
                        textDirection: TextDirection.ltr,
                        autofocus: true,
                        decoration: const InputDecoration(
                          labelText: 'اسم المستخدم أو البريد',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _passCtrl,
                        obscureText: true,
                        textDirection: TextDirection.ltr,
                        decoration: const InputDecoration(
                          labelText: 'كلمة المرور',
                          prefixIcon: Icon(Icons.lock_outline),
                        ),
                        onSubmitted: (_) => _login(),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: _loading ? null : _login,
                        icon: _loading
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.login, size: 18),
                        label: Text(_loading ? 'جارٍ الدخول...' : 'دخول المنصة'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1d4ed8),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ],

                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

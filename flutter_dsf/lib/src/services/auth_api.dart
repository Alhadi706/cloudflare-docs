import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/env.dart';
import '../models/auth_session.dart';

class AuthApi {
  final http.Client _client;

  AuthApi({http.Client? client}) : _client = client ?? http.Client();

  Future<AuthSession> loginCredentials({
    required String tenantCode,
    required String username,
    required String password,
  }) async {
    final normalizedTenantCode = _resolveTenantCode(
      tenantCode: tenantCode,
      username: username,
    );
    final normalizedUsername = username.trim();

    final loginUri = Uri.parse('${Env.apiBaseUrl}/api/auth/login-credentials');

    final loginRes = await _client.post(
      loginUri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'tenant_code': normalizedTenantCode,
        'username': normalizedUsername,
        'password': password,
      }),
    );

    final loginBody = _decode(loginRes.body);
    if (loginRes.statusCode < 200 || loginRes.statusCode >= 300) {
      final fallback = await _loginDevFallback(
        tenantCode: normalizedTenantCode,
        username: normalizedUsername,
        password: password,
      );
      if (fallback != null) {
        return fallback;
      }
      throw Exception(loginBody['detail'] ?? 'Login failed');
    }

    final token = (loginBody['token'] ?? '').toString();
    if (token.isEmpty) {
      throw Exception('Missing auth token from login response');
    }

    final meUri = Uri.parse('${Env.apiBaseUrl}/api/auth/me');
    final meRes = await _client.get(
      meUri,
      headers: {'Authorization': 'Bearer $token'},
    );

    String role = (loginBody['role'] ?? 'member').toString();
    String? departmentCode = loginBody['department_code']?.toString();
    String homeRoute = (loginBody['home_route'] ?? '').toString().trim();
    if (homeRoute.isEmpty) {
      homeRoute = _fallbackHomeRoute(
        role: role,
        departmentCode: departmentCode,
      );
    }
    String? tenantId = loginBody['tenant_id']?.toString();
    String? tenantCodeOut = loginBody['tenant_code']?.toString();

    if (meRes.statusCode >= 200 && meRes.statusCode < 300) {
      final meBody = _decode(meRes.body);
      final meHome = (meBody['home_route'] ?? '').toString().trim();
      if (meHome.isNotEmpty) {
        homeRoute = meHome;
      }
      role = (meBody['role'] ?? role).toString();
      departmentCode = meBody['department_code']?.toString() ?? departmentCode;
      tenantId = meBody['tenant_id']?.toString() ?? tenantId;
      tenantCodeOut = meBody['tenant_code']?.toString() ?? tenantCodeOut;
    }

    return AuthSession(
      token: token,
      role: role,
      homeRoute: homeRoute,
      tenantCode: tenantCodeOut,
      tenantId: tenantId,
      departmentCode: departmentCode,
    );
  }

  String _fallbackHomeRoute({required String role, String? departmentCode}) {
    final r = role.trim().toLowerCase();
    final dept = (departmentCode ?? '').trim().toUpperCase();

    if (r == 'admin' || r == 'founder') return '/dashboard/admin-gateway/system';
    if (dept == 'CORR') return '/dashboard/admin-gateway/corrosion';
    if (dept == 'MAINT') return '/dashboard/admin-gateway/maintenance';
    if (dept == 'HR') return '/dashboard/hr-center';
    if (dept == 'FIN') return '/dashboard/finance-hub';
    if (dept == 'ASSET') return '/dashboard/digital-assets';
    if (dept == 'PROC') return '/dashboard/procurement';
    if (dept == 'GIS') return '/dashboard/gis-sovereignty';
    return '/entry/install';
  }

  String _resolveTenantCode({
    required String tenantCode,
    required String username,
  }) {
    final provided = tenantCode.trim().toLowerCase();
    if (provided.isNotEmpty) {
      return provided;
    }

    // Allow simple copy/paste flows: section.corrosion-2@20-6.local -> 20-6
    final identity = username.trim().toLowerCase();
    if (!identity.contains('@')) return '';
    final domain = identity.split('@').last;
    if (domain.isEmpty) return '';
    return domain.split('.').first.trim();
  }

  Future<AuthSession?> _loginDevFallback({
    required String tenantCode,
    required String username,
    required String password,
  }) async {
    final devKey = Env.devPortalKey.trim();
    if (devKey.isEmpty) {
      return null;
    }

    final quickLoginUri = Uri.parse('${Env.apiBaseUrl}/api/dev/quick-login?key=$devKey');
    final quickRes = await _client.post(
      quickLoginUri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'tenant_code': tenantCode,
        'username': username,
        'password': password,
      }),
    );

    if (quickRes.statusCode < 200 || quickRes.statusCode >= 300) {
      return null;
    }

    final quickBody = _decode(quickRes.body);
    final token = (quickBody['token'] ?? '').toString();
    if (token.isEmpty) {
      return null;
    }

    final user = quickBody['user'] is Map<String, dynamic>
        ? quickBody['user'] as Map<String, dynamic>
        : const <String, dynamic>{};

    return AuthSession(
      token: token,
      role: (user['role'] ?? 'member').toString(),
      homeRoute: '/entry/install',
      tenantCode: (user['tenant_code'] ?? tenantCode).toString(),
      tenantId: quickBody['tenant_id']?.toString(),
    );
  }

  Map<String, dynamic> _decode(String body) {
    try {
      final dynamic parsed = jsonDecode(body);
      if (parsed is Map<String, dynamic>) {
        return parsed;
      }
      return <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }
}

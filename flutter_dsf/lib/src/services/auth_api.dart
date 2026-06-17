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
    final normalizedTenantCode = tenantCode.trim().toLowerCase();
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

    String homeRoute = '/entry/install';
    String role = (loginBody['role'] ?? 'member').toString();
    String? tenantId = loginBody['tenant_id']?.toString();
    String? tenantCodeOut = loginBody['tenant_code']?.toString();

    if (meRes.statusCode >= 200 && meRes.statusCode < 300) {
      final meBody = _decode(meRes.body);
      homeRoute = (meBody['home_route'] ?? homeRoute).toString();
      role = (meBody['role'] ?? role).toString();
      tenantId = meBody['tenant_id']?.toString() ?? tenantId;
      tenantCodeOut = meBody['tenant_code']?.toString() ?? tenantCodeOut;
    }

    return AuthSession(
      token: token,
      role: role,
      homeRoute: homeRoute,
      tenantCode: tenantCodeOut,
      tenantId: tenantId,
    );
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

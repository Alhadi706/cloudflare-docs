import 'package:shared_preferences/shared_preferences.dart';

class SessionStore {
  static const _kToken = 'auth_token';
  static const _kRole = 'user_role';
  static const _kTenantCode = 'tenant_code';
  static const _kTenantId = 'tenant_id';
  static const _kScope = 'launch_app';

  Future<void> saveAuth({
    required String token,
    required String role,
    String? tenantCode,
    String? tenantId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kToken, token);
    await prefs.setString(_kRole, role);
    if (tenantCode != null) {
      await prefs.setString(_kTenantCode, tenantCode);
    }
    if (tenantId != null) {
      await prefs.setString(_kTenantId, tenantId);
    }
  }

  Future<void> saveScope(String scope) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kScope, scope);
  }

  Future<String?> token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kToken);
  }

  Future<String?> scope() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kScope);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kToken);
    await prefs.remove(_kRole);
    await prefs.remove(_kTenantCode);
    await prefs.remove(_kTenantId);
    await prefs.remove(_kScope);
  }
}

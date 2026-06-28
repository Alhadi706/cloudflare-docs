import 'package:shared_preferences/shared_preferences.dart';

class SessionStore {
  static const _kToken      = 'auth_token';
  static const _kRole       = 'user_role';
  static const _kTenantCode = 'tenant_code';
  static const _kTenantId   = 'tenant_id';
  static const _kDeptCode   = 'dept_code';
  static const _kHomeRoute  = 'home_route';
  static const _kScope      = 'launch_app';

  Future<void> saveAuth({
    required String token,
    required String role,
    String? tenantCode,
    String? tenantId,
    String? departmentCode,
    String? homeRoute,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kToken, token);
    await prefs.setString(_kRole, role);
    // New login should not inherit an old scoped app from a previous session.
    await prefs.remove(_kScope);
    if (tenantCode != null)    await prefs.setString(_kTenantCode, tenantCode);
    if (tenantId != null)      await prefs.setString(_kTenantId, tenantId);
    if (departmentCode != null) await prefs.setString(_kDeptCode, departmentCode);
    if (homeRoute != null && homeRoute.isNotEmpty) {
      await prefs.setString(_kHomeRoute, homeRoute);
    }
  }

  Future<void> saveScope(String scope) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kScope, scope);
  }

  Future<String?> token()        async => (await SharedPreferences.getInstance()).getString(_kToken);
  Future<String?> role()         async => (await SharedPreferences.getInstance()).getString(_kRole);
  Future<String?> scope()        async => (await SharedPreferences.getInstance()).getString(_kScope);
  Future<String?> tenantId()     async => (await SharedPreferences.getInstance()).getString(_kTenantId);
  Future<String?> tenantCode()   async => (await SharedPreferences.getInstance()).getString(_kTenantCode);
  Future<String?> deptCode()     async => (await SharedPreferences.getInstance()).getString(_kDeptCode);
  Future<String?> homeRoute()    async => (await SharedPreferences.getInstance()).getString(_kHomeRoute);

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kToken);
    await prefs.remove(_kRole);
    await prefs.remove(_kTenantCode);
    await prefs.remove(_kTenantId);
    await prefs.remove(_kDeptCode);
    await prefs.remove(_kHomeRoute);
    await prefs.remove(_kScope);
  }
}

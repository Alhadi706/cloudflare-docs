import 'package:flutter/material.dart';

import 'models/auth_session.dart';
import 'screens/install_screen.dart';
import 'screens/login_screen.dart';
import 'screens/scoped_home_screen.dart';
import 'services/session_store.dart';

void runDsfApp() {
  runApp(const DsfApp());
}

class DsfApp extends StatefulWidget {
  const DsfApp({super.key});

  @override
  State<DsfApp> createState() => _DsfAppState();
}

class _DsfAppState extends State<DsfApp> {
  final _store = SessionStore();

  bool    _booting     = true;
  String? _token;
  String? _scope;
  String? _role;
  String? _tenantId;
  String? _tenantCode;
  String? _deptCode;
  String? _homeRoute;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final token     = await _store.token();
    final scope     = await _store.scope();
    final role      = await _store.role();
    final tenantId  = await _store.tenantId();
    final tenantCode = await _store.tenantCode();
    final deptCode  = await _store.deptCode();
    final homeRoute = await _store.homeRoute();
    setState(() {
      _token      = token;
      _scope      = scope;
      _role       = role;
      _tenantId   = tenantId;
      _tenantCode = tenantCode;
      _deptCode   = deptCode;
      _homeRoute  = homeRoute;
      _booting    = false;
    });
  }

  Future<void> _onLogin(AuthSession session) async {
    // Derive scope from dept code first (most reliable), then from homeRoute
    final deptScope = _scopeFromDeptCode(session.departmentCode);
    final routeScope = deptScope ?? _inferScopeFromHomeRoute(session.homeRoute);
    final finalScope = (routeScope != null && routeScope != 'all') ? routeScope : null;

    await _store.saveAuth(
      token:          session.token,
      role:           session.role,
      tenantCode:     session.tenantCode,
      tenantId:       session.tenantId,
      departmentCode: session.departmentCode,
      homeRoute:      session.homeRoute,
    );
    if (finalScope != null) {
      await _store.saveScope(finalScope);
    }

    setState(() {
      _token      = session.token;
      _scope      = finalScope;
      _role       = session.role;
      _tenantId   = session.tenantId;
      _tenantCode = session.tenantCode;
      _deptCode   = session.departmentCode;
      _homeRoute  = session.homeRoute;
    });
  }

  /// Maps department code to app scope (mirrors lib/appScope.ts)
  String? _scopeFromDeptCode(String? deptCode) {
    if (deptCode == null || deptCode.isEmpty) return null;
    final d = deptCode.toUpperCase();
    if (d == 'CORR')                          return 'corrosion';
    if (d == 'MAINT' || d == 'OPS')           return 'maintenance';
    if (d == 'FIN')                           return 'finance';
    if (d == 'HR' || d == 'ADMIN')            return 'admin-affairs';
    if (d == 'ASSET' || d == 'PROC')          return 'materials';
    if (d == 'GIS' || d == 'ENG')             return 'remote-sensing';
    if (d == 'IT' || d == 'CTRL')             return 'services';
    return null;
  }

  String? _inferScopeFromHomeRoute(String? route) {
    final v = (route ?? '').toLowerCase().trim();
    if (v.isEmpty) return null;
    if (v.contains('/corrosion'))  return 'corrosion';
    if (v.contains('/maintenance')) return 'maintenance';
    if (v.contains('/finance'))    return 'finance';
    if (v.contains('/materials') || v.contains('/inventory') ||
        v.contains('/procurement') || v.contains('/assets')) return 'materials';
    if (v.contains('/hr') || v.contains('/admin-control') ||
        v.contains('/correspondence') || v.contains('/workflow') ||
        v.contains('/contracts'))  return 'admin-affairs';
    if (v.contains('/gis') || v.contains('/spatial') ||
        v.contains('/remote-sensing')) return 'remote-sensing';
    if (v.contains('/command-center') || v.contains('/system-explorer') ||
        v.contains('/ai-assistant')) return 'services';
    if (v == '/dashboard' || v.contains('/admin-gateway/system')) return 'all';
    return null;
  }

  Future<void> _onScopeSelected(String scope) async {
    await _store.saveScope(scope);
    setState(() => _scope = scope);
  }

  Future<void> _logout() async {
    await _store.clear();
    setState(() {
      _token = null; _scope = null; _role = null;
      _tenantId = null; _tenantCode = null;
      _deptCode = null; _homeRoute = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'DSF Gateway',
      theme: ThemeData.dark(useMaterial3: true).copyWith(
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFF38bdf8),
          surface: const Color(0xFF0f172a),
        ),
        scaffoldBackgroundColor: const Color(0xFF0a0a0f),
      ),
      home: _buildHome(),
    );
  }

  Widget _buildHome() {
    if (_booting) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_token == null) {
      return LoginScreen(onLoginSuccess: _onLogin);
    }

    // Admin/founder or unscoped → show department selector
    if (_scope == null || _scope == 'all') {
      return InstallScreen(onScopeSelected: _onScopeSelected);
    }

    // Department user → open full web dashboard in WebView
    return ScopedHomeScreen(
      scope:          _scope!,
      token:          _token!,
      role:           _role ?? 'employee',
      tenantId:       _tenantId,
      tenantCode:     _tenantCode,
      departmentCode: _deptCode,
      homeRoute:      _homeRoute ?? '/dashboard',
      onLogout:       _logout,
    );
  }
}


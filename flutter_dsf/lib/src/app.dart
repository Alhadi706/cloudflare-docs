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

  bool _booting = true;
  String? _token;
  String? _scope;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final token = await _store.token();
    final scope = await _store.scope();
    setState(() {
      _token = token;
      _scope = scope;
      _booting = false;
    });
  }

  Future<void> _onLogin(AuthSession session) async {
    await _store.saveAuth(
      token: session.token,
      role: session.role,
      tenantCode: session.tenantCode,
      tenantId: session.tenantId,
    );

    // Installer-first behavior matches web policy.
    if (session.homeRoute == '/entry/install' || _scope == null) {
      setState(() {
        _token = session.token;
        _scope = null;
      });
      return;
    }

    setState(() {
      _token = session.token;
      _scope = _scope;
    });
  }

  Future<void> _onScopeSelected(String scope) async {
    await _store.saveScope(scope);
    setState(() {
      _scope = scope;
    });
  }

  Future<void> _logout() async {
    await _store.clear();
    setState(() {
      _token = null;
      _scope = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'DSF Flutter',
      theme: ThemeData.dark(useMaterial3: true),
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

    if (_scope == null || _scope == 'all') {
      return InstallScreen(onScopeSelected: _onScopeSelected);
    }

    return ScopedHomeScreen(scope: _scope!, onLogout: _logout);
  }
}

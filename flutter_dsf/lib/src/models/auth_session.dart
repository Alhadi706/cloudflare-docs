class AuthSession {
  final String token;
  final String role;
  final String? tenantCode;
  final String? tenantId;
  final String homeRoute;

  const AuthSession({
    required this.token,
    required this.role,
    required this.homeRoute,
    this.tenantCode,
    this.tenantId,
  });
}

class Env {
  static const String apiBaseUrl = String.fromEnvironment(
    'DSF_API_BASE_URL',
    defaultValue: 'https://dev.d-me.ly',
  );
}

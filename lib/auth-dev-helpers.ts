export function allowDevAuthHelpers(host?: string | null): boolean {
  const normalizedHost = (host || '').toLowerCase();
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || '').toLowerCase();
  const isKnownDevHost = normalizedHost.includes('dev.d-me.ly')
    || normalizedHost.includes('localhost')
    || normalizedHost.includes('127.0.0.1')
    || baseUrl.includes('dev.d-me.ly');

  if (isKnownDevHost) {
    return true;
  }

  if (process.env.NODE_ENV === 'production') {
    return process.env.ALLOW_DEV_AUTH_HELPERS === '1';
  }

  return process.env.ALLOW_DEV_OTP === '1'
    || process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH_HELPERS === '1'
    || process.env.ALLOW_DEV_AUTH_HELPERS === '1'
    || isKnownDevHost;
}

export function getRequestHost(headers: Headers): string {
  return (headers.get('x-forwarded-host') || headers.get('host') || '').toLowerCase();
}

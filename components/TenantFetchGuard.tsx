'use client';

import { useEffect } from 'react';

const DEFAULT_TENANT_ID = (process.env.NEXT_PUBLIC_TENANT_ID ?? '').trim();
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(v: string | null | undefined): v is string {
  return UUID_LIKE.test((v ?? '').trim());
}

function shouldHandle(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  return url.startsWith('/api/') || url.startsWith(window.location.origin + '/api/');
}

/**
 * Extract tenant_id from a JWT stored in localStorage.
 * The JWT format used by this app is `base64url_payload.hmac_sig` (2 parts).
 * We decode the payload only — no signature verification needed here since
 * the backend validates the full token.
 */
function extractTenantFromJwt(token: string): string {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 1) return '';
    const payload = token.slice(0, dot);
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const claims = JSON.parse(json) as Record<string, unknown>;
    const tid = String(claims.tenant_id ?? '').trim();
    return isValidUuid(tid) ? tid : '';
  } catch {
    return '';
  }
}

/**
 * Resolve tenant_id from multiple sources, in priority order:
 *  1. localStorage.tenant_id / active_tenant_id   (set by LoginPanel on login)
 *  2. JWT payload in localStorage.auth_token        (always present after login)
 *  3. NEXT_PUBLIC_TENANT_ID env var                 (deployment-level fallback)
 */
function resolveTenantId(): string {
  // 1. Explicit localStorage value
  for (const key of ['tenant_id', 'active_tenant_id']) {
    const v = localStorage.getItem(key)?.trim();
    if (isValidUuid(v)) return v as string;
  }

  // 2. JWT token payload
  const token = localStorage.getItem('auth_token')?.trim();
  if (token) {
    const fromJwt = extractTenantFromJwt(token);
    if (fromJwt) {
      // Cache it so subsequent calls are fast and the app works correctly
      localStorage.setItem('tenant_id', fromJwt);
      localStorage.setItem('active_tenant_id', fromJwt);
      return fromJwt;
    }
  }

  // 3. Build-time / deployment env var
  return isValidUuid(DEFAULT_TENANT_ID) ? DEFAULT_TENANT_ID : '';
}

export default function TenantFetchGuard() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (!shouldHandle(input)) {
        return originalFetch(input, init);
      }

      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => {
          headers.set(key, value);
        });
      }

      // Inject tenant_id if missing OR if set to empty string by the caller
      const existingTenant = headers.get('X-Tenant-ID')?.trim() ?? '';
      if (!isValidUuid(existingTenant)) {
        const tenantId = resolveTenantId();
        if (tenantId) {
          headers.set('X-Tenant-ID', tenantId);
        }
      }

      return originalFetch(input, { ...init, headers });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}

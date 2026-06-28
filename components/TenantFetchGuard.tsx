'use client';

import { useEffect } from 'react';

const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? '';
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function shouldHandle(input: RequestInfo | URL): boolean {
  const url = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  return url.startsWith('/api/') || url.startsWith(window.location.origin + '/api/');
}

function resolveTenantId(): string {
  const rawTenantId = localStorage.getItem('tenant_id') || '';
  if (UUID_LIKE.test(rawTenantId)) {
    return rawTenantId;
  }
  return UUID_LIKE.test(DEFAULT_TENANT_ID) ? DEFAULT_TENANT_ID : '';
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

      if (!headers.has('X-Tenant-ID')) {
        const tenantId = resolveTenantId();
        if (tenantId) {
          // Inject a tenant only when the request did not specify one explicitly.
          headers.set('X-Tenant-ID', tenantId);
        }
      }

      return originalFetch(input, {
        ...init,
        headers,
      });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}

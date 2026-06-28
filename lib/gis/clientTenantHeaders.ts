export function getEnvTenantId(): string {
  return process.env.NEXT_PUBLIC_TENANT_ID || '';
}

function getEnvTenantCode(): string {
  return process.env.NEXT_PUBLIC_TENANT_CODE || '';
}

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getStoredTenantId(): string {
  if (typeof window === 'undefined') return '';
  return (
    window.localStorage.getItem('tenant_id') ||
    window.localStorage.getItem('active_tenant_id') ||
    ''
  );
}

function getStoredTenantCode(): string {
  if (typeof window === 'undefined') return '';
  return (
    window.localStorage.getItem('tenant_code') ||
    window.localStorage.getItem('active_tenant_code') ||
    ''
  );
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers as Record<string, string>;
}

function getStoredAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return (
    window.localStorage.getItem('auth_token') ||
    window.localStorage.getItem('token') ||
    window.sessionStorage.getItem('auth_token') ||
    window.sessionStorage.getItem('token') ||
    ''
  );
}

export function buildClientTenantHeaders(
  headers?: HeadersInit,
  tenantOverride?: string,
): Record<string, string> {
  const normalized = normalizeHeaders(headers);
  if (typeof window === 'undefined') return normalized;

  const tenantId = tenantOverride || getStoredTenantId() || getEnvTenantId() || '';
  const tenantCode = getStoredTenantCode();
  const authToken = getStoredAuthToken();
  const merged: Record<string, string> = { ...normalized };

  if (tenantId) merged['X-Tenant-ID'] = tenantId;
  if (tenantCode) merged['X-Tenant-Code'] = tenantCode;
  // Add Bearer token so middleware can inject x-verified-tenant-id
  if (authToken && !merged['Authorization']) {
    merged['Authorization'] = `Bearer ${authToken}`;
  }

  return merged;
}

function persistTenantId(tenantId: string): void {
  if (typeof window === 'undefined' || !tenantId) return;
  window.localStorage.setItem('tenant_id', tenantId);
  window.localStorage.setItem('active_tenant_id', tenantId);
}

function persistTenantCode(tenantCode: string): void {
  if (typeof window === 'undefined' || !tenantCode) return;
  window.localStorage.setItem('tenant_code', tenantCode);
  window.localStorage.setItem('active_tenant_code', tenantCode);
}

function persistTenantContext(tenantId: string): void {
  persistTenantId(tenantId);
  persistTenantCode(getEnvTenantCode());
}

export function syncClientTenantFromEnv(): boolean {
  if (typeof window === 'undefined') return false;
  const envTenantId = getEnvTenantId();
  if (!envTenantId) return false;

  const currentTenantId = getStoredTenantId();
  if (currentTenantId === envTenantId) return false;

  if (!currentTenantId || !UUID_LIKE.test(currentTenantId)) {
    persistTenantContext(envTenantId);
    return true;
  }

  return false;
}

export async function fetchWithClientTenantRetry(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const first = await fetch(url, {
    ...init,
    headers: buildClientTenantHeaders(init.headers),
  });

  if (first.ok) return first;

  const text = await first.clone().text().catch(() => first.statusText);
  const envTenantId = getEnvTenantId();
  const currentTenantId = getStoredTenantId();

  if (
    (first.status === 404 || first.status === 400) &&
    (text.includes('tenant_not_found') || text.includes('tenant context') || text.includes('invalid tenant')) &&
    envTenantId &&
    envTenantId !== currentTenantId
  ) {
    const retry = await fetch(url, {
      ...init,
      headers: buildClientTenantHeaders(init.headers, envTenantId),
    });
    if (retry.ok) {
      persistTenantContext(envTenantId);
    }
    return retry;
  }

  return first;
}
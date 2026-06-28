const DEFAULT_TENANT_ID = (process.env.NEXT_PUBLIC_TENANT_ID || '').trim();
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isTenantIdLike(value: string | null | undefined): boolean {
  return UUID_LIKE.test(String(value || '').trim());
}

export function getClientTenantId(): string {
  if (typeof window !== 'undefined') {
    const rawTenantId = (
      localStorage.getItem('tenant_id') ||
      localStorage.getItem('active_tenant_id') ||
      ''
    ).trim();

    if (isTenantIdLike(rawTenantId)) {
      return rawTenantId;
    }
  }

  return isTenantIdLike(DEFAULT_TENANT_ID) ? DEFAULT_TENANT_ID : '';
}

export function getClientTenantHeaders(): Record<string, string> {
  const tenantId = getClientTenantId();
  return tenantId ? { 'X-Tenant-ID': tenantId } : {};
}
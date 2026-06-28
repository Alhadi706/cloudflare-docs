'use client';
import { getClientTenantId } from '@/lib/getClientTenantId';

export type TenantContext = {
  tenantId: string | null;
  tenantCode: string | null;
};

export function resolveTenantContext(): TenantContext {
  const resolvedTenant = getClientTenantId();
  const lsTenantCode =
    typeof window !== 'undefined'
      ? (
    window.localStorage.getItem('tenant_code') ||
        window.localStorage.getItem('active_tenant_code')
      )
      : null;

  return {
    tenantId: resolvedTenant || null,
    tenantCode: lsTenantCode || process.env.NEXT_PUBLIC_TENANT_CODE || null,
  };
}

export function tenantHeaders(ctx?: TenantContext): HeadersInit {
  const { tenantId, tenantCode } = ctx ?? resolveTenantContext();
  const headers: Record<string, string> = {};
  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (tenantCode) headers['X-Tenant-Code'] = tenantCode;
  return headers;
}

export function withTenantQuery(path: string, ctx?: TenantContext): string {
  const { tenantId } = ctx ?? resolveTenantContext();
  if (!tenantId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}tenant_id=${encodeURIComponent(tenantId)}`;
}

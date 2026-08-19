import { NextRequest } from 'next/server';

export function resolveTenantIdFromRequest(req: NextRequest): string {
  return (req.headers.get('x-verified-tenant-id') || '').trim();
}

export function forwardAuthHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  const tenantId = resolveTenantIdFromRequest(req);
  const auth = (req.headers.get('authorization') || '').trim();
  const userId = (req.headers.get('x-verified-user-id') || '').trim();
  const userRole = (req.headers.get('x-verified-role') || '').trim();

  if (tenantId) headers['X-Tenant-ID'] = tenantId;
  if (auth) headers.Authorization = auth;
  headers['x-user-id'] = userId;
  headers['x-user-role'] = userRole;
  return headers;
}

export async function loadAssetCenterFromApi(req: NextRequest, assetId: string): Promise<any> {
  const origin = req.nextUrl.origin;
  const url = `${origin}/api/v1/workspace/assets/${encodeURIComponent(assetId)}/center`;
  const res = await fetch(url, {
    method: 'GET',
    headers: forwardAuthHeaders(req),
    cache: 'no-store',
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`asset_center_fetch_failed:${res.status}:${txt.slice(0, 200)}`);
  }

  return res.json();
}

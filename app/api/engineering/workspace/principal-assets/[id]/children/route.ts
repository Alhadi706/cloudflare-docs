/**
 * GET /api/engineering/workspace/principal-assets/[id]/children
 * Returns child assets of a principal asset
 */
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND, extractTenantId, buildBackendHeaders } from '@/lib/backendProxy';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ error: 'tenant_id مطلوب' }, { status: 401 });

  // Try children endpoint first
  const url = `${BACKEND}/api/v1/workspace/assets/${params.id}/children?tenant_id=${tenantId}`;
  try {
    const res = await fetch(url, { headers: buildBackendHeaders(tenantId), signal: AbortSignal.timeout(10_000) });
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.features ?? data?.results ?? [];
      return NextResponse.json(items.map((f: any) => {
        const p = f?.properties ?? {};
        return {
          id:               f.id ?? p.asset_id ?? p.id,
          name:             p.asset_name ?? p.name ?? 'بدون اسم',
          asset_type:       p.asset_type ?? p.classification ?? 'unknown',
          owner_department: p.department_owner ?? p.owner_department ?? '',
          status:           p.status ?? 'active',
          geometry:         f.geometry ?? null,
          created_at:       p.created_at ?? null,
        };
      }));
    }
    // If no children endpoint, return empty
    return NextResponse.json([]);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ error: 'tenant_id مطلوب' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url  = `${BACKEND}/api/v1/workspace/assets/${params.id}/children?tenant_id=${tenantId}`;
  try {
    const res = await fetch(url, {
      method: 'POST', headers: buildBackendHeaders(tenantId),
      body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

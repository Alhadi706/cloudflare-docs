/**
 * GET    /api/engineering/workspace/principal-assets/[id]
 * PATCH  /api/engineering/workspace/principal-assets/[id]
 * DELETE /api/engineering/workspace/principal-assets/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND, extractTenantId, buildBackendHeaders } from '@/lib/backendProxy';

function featureToPrincipal(f: any): any {
  const p = f?.properties ?? {};
  return {
    id:               f.id ?? p.asset_id ?? p.id,
    name:             p.asset_name ?? p.name ?? 'بدون اسم',
    geometry_type:    p.geometry_type ?? (f.geometry?.type === 'LineString' ? 'path' : 'polygon'),
    classification:   p.asset_type ?? p.classification ?? null,
    owner_department: p.department_owner ?? p.owner_department ?? null,
    status:           p.status ?? null,
    health_score:     p.health_score ?? null,
    geometry:         f.geometry ?? null,
    geometry_json:    f.geometry ?? null,
    created_at:       p.created_at ?? p.installation_date ?? null,
    tenant_id:        p.tenant_id ?? null,
    site_id:          p.site_id ?? null,
    length_km:        p.length_km ?? null,
    description:      p.description ?? null,
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ error: 'tenant_id مطلوب' }, { status: 401 });

  const url = `${BACKEND}/api/v1/workspace/assets/${params.id}?tenant_id=${tenantId}`;
  try {
    const res = await fetch(url, { headers: buildBackendHeaders(tenantId, {
      'X-User-Role': req.headers.get('x-verified-role') || '',
    }), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return NextResponse.json({ error: `${res.status}` }, { status: res.status });
    const data = await res.json();
    return NextResponse.json(featureToPrincipal(data));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

/** Map Next.js roles → backend asset permission roles */
function mapRole(role: string): string {
  switch (role) {
    case 'super_admin':   return 'super_admin';
    case 'admin':         return 'super_admin';   // admin = full access
    case 'founder':       return 'super_admin';
    case 'owner':         return 'super_admin';
    case 'dept_manager':  return 'layer_owner';
    case 'section_manager': return 'layer_owner';
    case 'engineer':      return 'layer_owner';
    case 'viewer':        return 'viewer';
    default:              return role || 'viewer';
  }
}

/** Forward user role + id headers from Next.js request → backend */
function buildMutateHeaders(req: NextRequest, tenantId: string): Record<string, string> {
  const rawRole = req.headers.get('x-verified-role') || '';
  const userId  = req.headers.get('x-verified-employee-no') ||
                  req.headers.get('x-verified-email') || '';
  return buildBackendHeaders(tenantId, {
    'x-user-role': mapRole(rawRole),
    'x-user-id':   userId,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ error: 'tenant_id مطلوب' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url  = `${BACKEND}/api/v1/workspace/assets/${params.id}?tenant_id=${tenantId}`;
  try {
    const res = await fetch(url, {
      method: 'PATCH', headers: buildMutateHeaders(req, tenantId),
      body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return PATCH(req, { params });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ error: 'tenant_id مطلوب' }, { status: 401 });

  const url = `${BACKEND}/api/v1/workspace/assets/${params.id}?tenant_id=${tenantId}`;
  try {
    const res = await fetch(url, {
      method: 'DELETE', headers: buildMutateHeaders(req, tenantId), signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return NextResponse.json({ error: `${res.status}`, detail }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

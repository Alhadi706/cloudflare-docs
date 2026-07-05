/**
 * GET  /api/engineering/workspace/principal-assets  — list all assets
 * POST /api/engineering/workspace/principal-assets  — create a new asset
 *
 * Proxies to the Python backend at BACKEND_URL/api/v1/workspace/assets
 * Transforms GeoJSON Feature format → PrincipalAsset flat format for the UI
 */
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND, extractTenantId, buildBackendHeaders } from '@/lib/backendProxy';

const BACKEND_ASSETS = `${BACKEND}/api/v1/workspace/assets`;

/** Convert a backend GeoJSON Feature → PrincipalAsset shape expected by the UI */
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
    // Extra fields the UI uses for display
    site_id:          p.site_id ?? null,
    length_km:        p.length_km ?? null,
    description:      p.description ?? null,
  };
}

export async function GET(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id مطلوب' }, { status: 401 });
  }

  const qs = req.nextUrl.searchParams.toString();
  const url = qs ? `${BACKEND_ASSETS}?tenant_id=${tenantId}&${qs}` : `${BACKEND_ASSETS}?tenant_id=${tenantId}`;

  try {
    const res = await fetch(url, {
      headers: buildBackendHeaders(tenantId),
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      return NextResponse.json({ error: `backend ${res.status}`, detail: err.slice(0, 200) }, { status: res.status });
    }
    const data = await res.json();
    // Backend returns GeoJSON FeatureCollection or array of Features
    const features: any[] = Array.isArray(data) ? data :
                            data?.features ? data.features :
                            data?.results  ? data.results : [];
    return NextResponse.json(features.map(featureToPrincipal));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id مطلوب' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const url  = `${BACKEND_ASSETS}?tenant_id=${tenantId}`;

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: buildBackendHeaders(tenantId),
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    // Return in PrincipalAsset format
    return NextResponse.json(featureToPrincipal(data));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}

/**
 * GET /api/v1/satellite/registered-assets
 * جلب الأصول المسجلة من إدارة الأصول لمركز الاستشعار عن بعد
 *
 * Public endpoint (لا يحتاج JWT) — يستخدم tenant_id من الهيدر أو query param
 * يُستخدم من WaterScannerPanel لعرض الأصول في وضع "أصل"
 */
import { NextRequest, NextResponse } from 'next/server';
import { BACKEND } from '@/lib/backendProxy';

export async function GET(req: NextRequest) {
  // Extract tenant ID from multiple sources (no JWT required)
  const tenantId = (
    req.headers.get('x-verified-tenant-id') ||
    req.headers.get('x-tenant-id') ||
    req.headers.get('X-Tenant-ID') ||
    req.nextUrl.searchParams.get('tenant_id') ||
    req.cookies.get('tenant_id')?.value ||
    'aaaaaaaa-0000-4000-a000-000000000001' // fallback to default INFRA_OPS tenant
  ).trim();

  const limit = req.nextUrl.searchParams.get('limit') ?? '500';

  try {
    const url = `${BACKEND}/api/v1/workspace/assets?tenant_id=${tenantId}&limit=${limit}`;
    const res = await fetch(url, {
      headers: {
        'Content-Type':  'application/json',
        'X-Tenant-ID':   tenantId,
        'X-User-Role':   'super_admin',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json({ assets: [], error: `backend ${res.status}` });
    }

    const data = await res.json();
    // Backend returns array of GeoJSON Features
    const features: any[] = Array.isArray(data) ? data :
      data?.features ?? data?.results ?? [];

    const assets = features.map((f: any) => {
      const p = f?.properties ?? {};
      const g = f?.geometry ?? {};
      return {
        id:         f.id ?? p.asset_id ?? p.id ?? '',
        name:       p.asset_name ?? p.name ?? 'بدون اسم',
        asset_type: p.asset_type ?? p.classification ?? '',
        geom_type:  g.type ?? '',
        status:     p.status ?? 'active',
        geometry:   g,  // include full geometry for direct use in scanner
      };
    }).filter((a: any) => a.id && a.name !== 'بدون اسم');

    return NextResponse.json({ assets, total: assets.length });
  } catch (e: any) {
    console.warn('[registered-assets] fetch failed:', e.message);
    return NextResponse.json({ assets: [], error: e.message });
  }
}

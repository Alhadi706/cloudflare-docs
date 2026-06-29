import { NextRequest, NextResponse } from 'next/server';

/** Mock audit reports — sourced from satellite image ingestion events */
export async function GET(req: NextRequest) {
  const url   = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);

  const reports = Array.from({ length: Math.min(limit, 20) }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i * 3);
    return {
      id:          `audit-${1000 + i}`,
      type:        i % 3 === 0 ? 'ingestion' : i % 3 === 1 ? 'analysis' : 'export',
      status:      i % 5 === 0 ? 'warning' : 'ok',
      scene_uid:   `MSIL2A_${d.toISOString().slice(0,10).replace(/-/g,'')}_T33SUJ`,
      operator:    'system',
      created_at:  d.toISOString(),
      summary:     i % 5 === 0
        ? 'تحذير: بيانات DEM ناقصة لجزء من المنطقة'
        : 'اكتملت العملية بنجاح',
      metadata:    { tiles: 4, bands: 12, cloud_cover_pct: (i * 7) % 35 },
    };
  });

  return NextResponse.json({ reports, total: reports.length });
}

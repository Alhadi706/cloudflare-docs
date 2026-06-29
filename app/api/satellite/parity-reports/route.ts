import { NextRequest, NextResponse } from 'next/server';

/** Mock parity reports — cross-validation between satellite sources */
export async function GET(req: NextRequest) {
  const url   = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '10', 10);

  const reports = Array.from({ length: Math.min(limit, 20) }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i * 4);
    const parity = 0.82 + (i % 5) * 0.03;
    return {
      id:           `parity-${2000 + i}`,
      scene_a:      `MSIL2A_${d.toISOString().slice(0,10).replace(/-/g,'')}_T33SUJ_S2`,
      scene_b:      `VIIRS_${d.toISOString().slice(0,10).replace(/-/g,'')}_NTL`,
      parity_score: +parity.toFixed(3),
      status:       parity >= 0.90 ? 'ok' : parity >= 0.80 ? 'warning' : 'fail',
      created_at:   d.toISOString(),
      summary:      parity >= 0.90
        ? 'تطابق جيد بين المصادر'
        : 'فجوة طفيفة في التوافق الطيفي',
      channels_checked: ['NDVI', 'NDWI', 'TIR', 'SAR_VV'],
      drift_metrics: { mean_pct: +((1 - parity) * 100).toFixed(1), max_pct: +((1 - parity) * 180).toFixed(1) },
    };
  });

  return NextResponse.json({ reports, total: reports.length });
}

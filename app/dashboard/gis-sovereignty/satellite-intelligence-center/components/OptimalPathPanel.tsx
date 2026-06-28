'use client';

import React, { useState, useCallback } from 'react';
import { Navigation, Loader2, AlertCircle, CheckCircle2, Triangle, Waves, Building2, ShieldAlert, Route, ChevronDown, ChevronUp, BarChart3, Download } from 'lucide-react';

// ── Export helpers ────────────────────────────────────────────────────────────

function exportGeoJSON(result: PathResult, infraType: string) {
  const eng = result.engineering as any;
  const features: any[] = [
    // ── 1. Main path ──────────────────────────────────────────────────────────
    {
      type: 'Feature',
      geometry: result.path,
      properties: {
        layer:               'optimal_path',
        infrastructure_type: infraType,
        total_distance_km:   result.stats.total_distance_km,
        direct_distance_km:  result.stats.direct_distance_km,
        detour_pct:          result.stats.detour_pct,
        max_slope_deg:       result.stats.max_slope_deg,
        avg_slope_deg:       result.stats.avg_slope_deg,
        difficulty:          result.stats.difficulty,
        dem_source:          eng?.dem_source ?? 'unknown',
        design_speed_kmh:    eng?.design_speed_kmh ?? 0,
        min_curve_radius_m:  eng?.min_curve_radius_m ?? 0,
        cut_m3:              eng?.cut_m3 ?? 0,
        fill_m3:             eng?.fill_m3 ?? 0,
        cut_m3_refined:      eng?.cut_m3_refined ?? 0,
        fill_m3_refined:     eng?.fill_m3_refined ?? 0,
        switchbacks_added:   eng?.switchbacks_added ?? 0,
        sharp_curves_fixed:  eng?.sharp_curves_fixed ?? 0,
        standards_ref:       eng?.standards_ref ?? '',
        notes:               result.notes,
        generated_at:        new Date().toISOString(),
      },
    },
    // ── 2. Direct line ────────────────────────────────────────────────────────
    {
      type: 'Feature',
      geometry: result.direct_line,
      properties: { layer: 'direct_line', infrastructure_type: infraType },
    },
  ];

  // ── 3. Cross-sections as Points ───────────────────────────────────────────
  if (eng?.cross_sections?.length) {
    for (const xs of eng.cross_sections) {
      // Interpolate point on path at this chainage
      const frac  = xs.chainage_m / (result.stats.total_distance_km * 1000);
      const idx   = Math.min(Math.round(frac * (result.path.coordinates.length - 1)), result.path.coordinates.length - 1);
      const coord = result.path.coordinates[idx];
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coord },
        properties: {
          layer:         'cross_section',
          chainage_m:    xs.chainage_m,
          ground_elev_m: xs.ground_elev_m,
          design_elev_m: xs.design_elev_m,
          cut_m:         xs.cut_m,
          fill_m:        xs.fill_m,
          cut_area_m2:   xs.cut_area_m2,
          fill_area_m2:  xs.fill_area_m2,
        },
      });
    }
  }

  // ── 4. Geotechnical stations as Points ────────────────────────────────────
  if (eng?.geotechnics?.stations?.length) {
    for (const s of eng.geotechnics.stations) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          layer:          'geotechnics',
          soil:           s.soil,
          soil_ar:        s.soil_ar,
          bearing_kPa:    s.bearing_kPa,
          gw_depth_m:     s.gw_depth_m,
          bulking_factor: s.bulking_factor,
          difficulty:     s.difficulty,
          note:           s.note,
        },
      });
    }
  }

  // ── 5. PI curve points ────────────────────────────────────────────────────
  if (eng?.pi_table?.length) {
    for (const pi of eng.pi_table.filter((p: any) => p.type === 'curve')) {
      const idx   = Math.min(pi.pi, result.path.coordinates.length - 1);
      const coord = result.path.coordinates[idx];
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coord },
        properties: {
          layer:      'pi_curve',
          pi:         pi.pi,
          delta_deg:  pi.delta_deg,
          R_m:        pi.R_m,
          T_m:        pi.T_m,
          L_m:        pi.L_m,
          Ls_m:       pi.Ls_m,
        },
      });
    }
  }

  // ── 6. PVI vertical curve points ─────────────────────────────────────────
  if (eng?.pvi_table?.length) {
    for (const pvi of eng.pvi_table.filter((p: any) => p.type !== 'TANGENT')) {
      const idx   = Math.min(pvi.pvi_index, result.path.coordinates.length - 1);
      const coord = result.path.coordinates[idx];
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coord },
        properties: {
          layer:     'pvi_curve',
          type:      pvi.type,
          dist_km:   pvi.dist_km,
          elev_m:    pvi.elev_m,
          g1_pct:    pvi.g1_pct,
          g2_pct:    pvi.g2_pct,
          K:         pvi.K,
          L_m:       pvi.L_m,
        },
      });
    }
  }

  const gj = {
    type: 'FeatureCollection',
    name: `مسار ${infraType} — ${new Date().toLocaleDateString('ar')}`,
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
    features,
  };
  const blob = new Blob([JSON.stringify(gj, null, 2)], { type: 'application/geo+json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `optimal_path_${infraType}_${Date.now()}.geojson`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportKML(result: PathResult, infraType: string) {
  const coords = result.path.coordinates
    .map(([lon, lat]) => `${lon},${lat},0`)
    .join(' ');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>المسار الأمثل — ${infraType}</name>
    <description>المسافة: ${result.stats.total_distance_km} كم | الصعوبة: ${result.stats.difficulty}</description>
    <Style id="pathStyle">
      <LineStyle><color>ff00aaff</color><width>3</width></LineStyle>
    </Style>
    <Placemark>
      <name>المسار الأمثل</name>
      <styleUrl>#pathStyle</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>
    <Placemark>
      <name>نقطة البداية</name>
      <Point><coordinates>${result.path.coordinates[0].join(',')},0</coordinates></Point>
    </Placemark>
    <Placemark>
      <name>نقطة النهاية</name>
      <Point><coordinates>${result.path.coordinates[result.path.coordinates.length - 1].join(',')},0</coordinates></Point>
    </Placemark>
  </Document>
</kml>`;
  const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `optimal_path_${infraType}_${Date.now()}.kml`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── PDF engineering report ────────────────────────────────────────────────────
function exportPDF(
  result: PathResult,
  infraType: string,
  startPoint: [number, number] | null,
  endPoint:   [number, number] | null,
) {
  const eng = result.engineering as any;
  const date = new Date().toLocaleDateString('ar-LY', { year: 'numeric', month: 'long', day: 'numeric' });

  const profileSvgPoints = result.terrain_profile.length > 1
    ? (() => {
        const maxD = result.terrain_profile[result.terrain_profile.length - 1].dist_km;
        const maxE = Math.max(...result.terrain_profile.map(p => p.elev_m));
        const minE = Math.min(...result.terrain_profile.map(p => p.elev_m));
        const range = maxE - minE || 1;
        const W = 600, H = 100;
        return result.terrain_profile
          .map(p => `${(p.dist_km / maxD) * W},${H - ((p.elev_m - minE) / range) * H}`)
          .join(' ');
      })()
    : '';

  const altRows = eng?.alternatives?.map((alt: any) => `
    <tr style="border-bottom:1px solid #e2e8f0; background:${alt.selected ? '#ebf8ff' : 'white'}">
      <td style="padding:4px 8px;font-weight:${alt.selected ? 'bold' : 'normal'};color:${alt.selected ? '#2b6cb0' : '#4a5568'}">${alt.selected ? '✓ ' : ''}${alt.label}</td>
      <td style="padding:4px 8px;text-align:center">${(alt.length_m / 1000).toFixed(2)}</td>
      <td style="padding:4px 8px;text-align:center;color:${alt.max_slope_pct > 10 ? '#c53030' : '#2d3748'}">${alt.max_slope_pct}%</td>
      <td style="padding:4px 8px;text-align:center">${(alt.cut_m3 / 1000).toFixed(1)}k</td>
      <td style="padding:4px 8px;text-align:center">${(alt.fill_m3 / 1000).toFixed(1)}k</td>
      <td style="padding:4px 8px;text-align:center;color:${alt.violations > 0 ? '#c53030' : '#276749'}">${alt.violations}</td>
    </tr>`).join('') ?? '';

  const quantRows = eng?.quantities?.map((q: any) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:4px 8px">${q.desc}<br/><small style="color:#718096">${q.note}</small></td>
      <td style="padding:4px 8px;text-align:center;font-weight:bold">${q.qty.toLocaleString('ar')}</td>
      <td style="padding:4px 8px;text-align:center;color:#718096">${q.unit}</td>
    </tr>`).join('') ?? '';

  const culvertRows = eng?.culverts?.map((c: any) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:4px 8px">${c.culvert_type}</td>
      <td style="padding:4px 8px;text-align:center">${c.catchment_km2}</td>
      <td style="padding:4px 8px;text-align:center;font-weight:bold">${c.Q_m3s}</td>
      <td style="padding:4px 8px;text-align:center">${c.velocity_ms}</td>
      <td style="padding:4px 8px;text-align:center">${c.headwater_m}</td>
    </tr>`).join('') ?? '';

  const notesHtml = result.notes.map(n => `<li style="margin:3px 0">${n}</li>`).join('');

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>تقرير المسار الهندسي</title>
<style>
  body{font-family:'Segoe UI',Tahoma,sans-serif;margin:24px;color:#1a202c;font-size:12px;direction:rtl}
  h1{font-size:18px;color:#1a365d;border-bottom:3px solid #2b6cb0;padding-bottom:6px;margin-bottom:16px}
  h2{font-size:13px;color:#2c5282;margin-top:18px;margin-bottom:6px;border-right:4px solid #3182ce;padding-right:8px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}
  th{background:#2b6cb0;color:white;padding:5px 8px;text-align:right}
  td{padding:4px 8px;vertical-align:top}
  .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
  .kpi{border:1px solid #bee3f8;border-radius:6px;padding:8px 10px;background:#ebf8ff}
  .kpi-label{font-size:10px;color:#4a5568}
  .kpi-value{font-size:14px;font-weight:bold;color:#2b6cb0}
  .notes{background:#fffbeb;border:1px solid #f6e05e;border-radius:6px;padding:10px;margin-bottom:12px}
  .footer{margin-top:24px;font-size:9px;color:#a0aec0;border-top:1px solid #e2e8f0;padding-top:8px;text-align:center}
  @media print{body{margin:10px}}
</style>
</head>
<body>
<h1>📋 تقرير المسار الهندسي الأمثل</h1>
<table style="margin-bottom:16px;border:1px solid #bee3f8;border-radius:6px">
  <tr><td style="color:#4a5568">التاريخ</td><td style="font-weight:bold">${date}</td>
      <td style="color:#4a5568">نوع البنية التحتية</td><td style="font-weight:bold">${infraType}</td></tr>
  <tr><td style="color:#4a5568">نقطة البداية</td><td>${startPoint ? startPoint.map(v => v.toFixed(5)).join(', ') : '—'}</td>
      <td style="color:#4a5568">نقطة النهاية</td><td>${endPoint ? endPoint.map(v => v.toFixed(5)).join(', ') : '—'}</td></tr>
  <tr><td style="color:#4a5568">مصدر الارتفاعات</td><td>${eng?.dem_source === 'real' ? 'Copernicus DEM / SRTM-30م حقيقي' : 'محاكاة'}</td>
      <td style="color:#4a5568">المسار المختار</td><td>${eng?.path_selected ?? '—'}</td></tr>
</table>

<h2>المؤشرات الرئيسية</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">المسافة الكلية</div><div class="kpi-value">${result.stats.total_distance_km} كم</div></div>
  <div class="kpi"><div class="kpi-label">المسافة المستقيمة</div><div class="kpi-value">${result.stats.direct_distance_km} كم</div></div>
  <div class="kpi"><div class="kpi-label">الانحراف</div><div class="kpi-value">${result.stats.detour_pct}%</div></div>
  <div class="kpi"><div class="kpi-label">درجة الصعوبة</div><div class="kpi-value">${result.stats.difficulty === 'easy' ? 'سهل' : result.stats.difficulty === 'moderate' ? 'متوسط' : 'صعب'}</div></div>
  <div class="kpi"><div class="kpi-label">الحفر (كات)</div><div class="kpi-value">${(eng?.cut_m3 ?? 0).toLocaleString('ar')} م³</div></div>
  <div class="kpi"><div class="kpi-label">الردم</div><div class="kpi-value">${(eng?.fill_m3 ?? 0).toLocaleString('ar')} م³</div></div>
  <div class="kpi"><div class="kpi-label">ارتفاع أدنى</div><div class="kpi-value">${eng?.elev_min_m ?? '—'} م</div></div>
  <div class="kpi"><div class="kpi-label">ارتفاع أقصى</div><div class="kpi-value">${eng?.elev_max_m ?? '—'} م</div></div>
</div>

${profileSvgPoints ? `
<h2>المقطع الطولي للارتفاع</h2>
<svg width="600" height="110" viewBox="0 0 600 110" style="background:#f7fafc;border:1px solid #e2e8f0;border-radius:4px;display:block;margin-bottom:12px">
  <polyline points="${profileSvgPoints}" fill="none" stroke="#3182ce" stroke-width="2"/>
  <line x1="0" y1="100" x2="600" y2="100" stroke="#cbd5e0" stroke-width="1"/>
  <text x="4" y="12" font-size="9" fill="#718096">↑ ارتفاع (م)</text>
  <text x="540" y="108" font-size="9" fill="#718096">مسافة (كم) →</text>
</svg>` : ''}

${notesHtml ? `<h2>الملاحظات الهندسية</h2><div class="notes"><ul style="margin:0;padding-right:16px">${notesHtml}</ul></div>` : ''}

${altRows ? `
<h2>مقارنة المسارات البديلة</h2>
<table><thead><tr><th>المسار</th><th>المسافة (كم)</th><th>أقصى ميل</th><th>كات (م³)</th><th>ردم (م³)</th><th>تجاوزات</th></tr></thead>
<tbody>${altRows}</tbody></table>` : ''}

${quantRows ? `
<h2>جدول الكميات التقديرية</h2>
<table><thead><tr><th>البند</th><th>الكمية</th><th>الوحدة</th></tr></thead>
<tbody>${quantRows}</tbody></table>` : ''}

${culvertRows ? `
<h2>تصميم الكلفرتات</h2>
<table><thead><tr><th>النوع</th><th>حوض (كم²)</th><th>Q (م³/ث)</th><th>سرعة (م/ث)</th><th>ارتداد (م)</th></tr></thead>
<tbody>${culvertRows}</tbody></table>` : ''}

${eng?.standards?.length ? `
<h2>المعايير الهندسية المطبقة</h2>
<ul style="margin:0;padding-right:16px">${eng.standards.map((s: string) => `<li style="margin:3px 0">${s}</li>`).join('')}</ul>
<p style="font-size:10px;color:#718096">المرجع: ${eng.standards_ref ?? ''}</p>` : ''}

<div class="footer">نظام المعلومات الجغرافية — مركز الاستشعار عن بُعد — تاريخ الطباعة: ${date}</div>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ObstacleOptions {
  buildings:        boolean;
  water:            boolean;
  steep_slope:      boolean;
  restricted_zones: boolean;
  existing_roads:   boolean;
}

interface PathStats {
  total_distance_km:  number;
  direct_distance_km: number;
  detour_pct:         number;
  estimated_time_min: number;
  segment_count:      number;
  avg_slope_deg:      number;
  max_slope_deg:      number;
  difficulty:         'easy' | 'moderate' | 'hard';
}

interface ObstacleStats {
  buildings_crossed:    number;
  water_crossings:      number;
  steep_segments:       number;
  restricted_crossings: number;
  total_avoided:        number;
  avoidance_detour_km:  number;
}

interface PathResult {
  status:        'ok';
  priority:      string;
  path:          { type: 'LineString'; coordinates: [number, number][] };
  direct_line:   { type: 'LineString'; coordinates: [number, number][] };
  stats:          PathStats;
  obstacle_stats: ObstacleStats;
  terrain_profile: { dist_km: number; elev_m: number }[];
  notes:          string[];
  engineering?: {
    dem_source:         'real' | 'simulated';
    path_selected:      string;
    alternatives_count: number;
    alternatives: { label: string; length_m: number; max_slope_pct: number; cut_m3: number; fill_m3: number; violations: number; selected: boolean; points_sample?: [number, number][] }[];
    standards:     string[];
    standards_ref: string;
    quantities:    { desc: string; qty: number; unit: string; note: string }[];
    cut_m3:        number;
    fill_m3:       number;
    elev_min_m:    number;
    elev_max_m:    number;
    elev_range_m:  number;
  };
}

interface Props {
  /** When active, the next two map clicks pick start/end points */
  routingPickMode: 'idle' | 'picking_start' | 'picking_end';
  startPoint: [number, number] | null;
  endPoint:   [number, number] | null;
  onStartPicking: (which: 'start' | 'end') => void;
  onClearPoints:  () => void;
  onResultReady:  (result: PathResult | null) => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiBox({ label, value, sub, color = 'slate' }: { label: string; value: string; sub?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    slate:  'text-slate-200',
    green:  'text-green-400',
    yellow: 'text-yellow-400',
    red:    'text-rose-400',
    blue:   'text-blue-400',
  };
  return (
    <div className="rounded-lg bg-slate-900/50 px-2.5 py-2 flex flex-col gap-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-[13px] font-bold ${colorMap[color] ?? colorMap.slate}`}>{value}</span>
      {sub && <span className="text-xs text-slate-600">{sub}</span>}
    </div>
  );
}

function MiniProfile({ profile }: { profile: { dist_km: number; elev_m: number }[] }) {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  if (profile.length < 2) return null;

  const maxE   = Math.max(...profile.map(p => p.elev_m));
  const minE   = Math.min(...profile.map(p => p.elev_m));
  const maxD   = profile[profile.length - 1].dist_km;
  const range  = maxE - minE || 1;

  // SVG dimensions (with left margin for Y labels, bottom margin for X labels)
  const ML = 36, MB = 18, MT = 6, MR = 6;
  const IW = 240, IH = 72;
  const W  = IW + ML + MR, H = IH + MT + MB;

  const toX = (d: number) => ML + (d / maxD) * IW;
  const toY = (e: number) => MT + IH - ((e - minE) / range) * IH;

  const pts     = profile.map(p => `${toX(p.dist_km)},${toY(p.elev_m)}`).join(' ');
  const fillPts = `${ML},${MT + IH} ${pts} ${toX(maxD)},${MT + IH}`;

  // Grade labels: compute % slope between consecutive points
  const gradeLabels: { x: number; y: number; pct: string; color: string }[] = [];
  for (let i = 1; i < profile.length; i++) {
    const dKm = profile[i].dist_km - profile[i - 1].dist_km;
    const dElev = profile[i].elev_m - profile[i - 1].elev_m;
    const pct = dKm > 0 ? (dElev / (dKm * 1000)) * 100 : 0;
    if (Math.abs(pct) > 2) {
      gradeLabels.push({
        x: toX((profile[i - 1].dist_km + profile[i].dist_km) / 2),
        y: toY((profile[i - 1].elev_m + profile[i].elev_m) / 2) - 6,
        pct: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`,
        color: Math.abs(pct) > 8 ? '#f87171' : Math.abs(pct) > 4 ? '#fbbf24' : '#4ade80',
      });
    }
  }

  // Y-axis ticks (3 evenly spaced)
  const yTicks = [minE, minE + range / 2, maxE].map(e => ({
    e: Math.round(e),
    y: toY(e),
  }));

  // X-axis ticks (evenly spaced, max 5)
  const nXTicks = Math.min(5, profile.length);
  const xTicks = Array.from({ length: nXTicks }, (_, i) => {
    const d = (i / (nXTicks - 1)) * maxD;
    return { d: d.toFixed(1), x: toX(d) };
  });

  const hov = hoveredIdx !== null ? profile[hoveredIdx] : null;

  return (
    <div className="rounded-lg bg-slate-900/60 border border-slate-700/40 p-2.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-400 font-semibold">المقطع الطولي للارتفاع</p>
        <span className="text-[9px] text-slate-600">الفرق: {Math.round(range)}م</span>
      </div>

      <svg
        width={W} height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ direction: 'ltr' }}
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line key={i} x1={ML} y1={t.y} x2={ML + IW} y2={t.y}
            stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />
        ))}

        {/* Filled area */}
        <polygon points={fillPts} fill="rgba(96,165,250,0.07)" />

        {/* Profile line */}
        <polyline points={pts} fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinejoin="round" />

        {/* Grade labels */}
        {gradeLabels.map((g, i) => (
          <text key={i} x={g.x} y={g.y} textAnchor="middle"
            fontSize="7" fill={g.color} fontWeight="bold">
            {g.pct}
          </text>
        ))}

        {/* Y-axis labels */}
        {yTicks.map((t, i) => (
          <text key={i} x={ML - 3} y={t.y + 3} textAnchor="end"
            fontSize="7" fill="#64748b">{t.e}م</text>
        ))}

        {/* X-axis labels */}
        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={H - 2} textAnchor="middle"
            fontSize="7" fill="#64748b">{t.d}كم</text>
        ))}

        {/* Axes */}
        <line x1={ML} y1={MT} x2={ML} y2={MT + IH} stroke="#475569" strokeWidth="0.8" />
        <line x1={ML} y1={MT + IH} x2={ML + IW} y2={MT + IH} stroke="#475569" strokeWidth="0.8" />

        {/* Hover dots */}
        {profile.map((p, i) => (
          <rect
            key={i}
            x={toX(p.dist_km) - 5} y={MT}
            width={10} height={IH}
            fill="transparent"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* Hover indicator */}
        {hov && hoveredIdx !== null && (
          <>
            <line
              x1={toX(hov.dist_km)} y1={MT}
              x2={toX(hov.dist_km)} y2={MT + IH}
              stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2"
            />
            <circle cx={toX(hov.dist_km)} cy={toY(hov.elev_m)} r={3}
              fill="#60a5fa" stroke="#1e293b" strokeWidth="1.5" />
            <rect
              x={Math.min(toX(hov.dist_km) + 4, W - 60)} y={toY(hov.elev_m) - 16}
              width={56} height={14} rx={2}
              fill="#1e293b" stroke="#334155" strokeWidth="0.8"
            />
            <text
              x={Math.min(toX(hov.dist_km) + 32, W - 32)} y={toY(hov.elev_m) - 5}
              textAnchor="middle" fontSize="7" fill="#e2e8f0"
            >
              {hov.dist_km}كم · {hov.elev_m}م
            </text>
          </>
        )}
      </svg>

      <div className="flex items-center gap-3 text-[9px] text-slate-600 mt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" />ارتفاع</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />{`<4%`} مناسب</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />4-8% تحذير</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{`>8%`} تجاوز</span>
      </div>
    </div>
  );
}

const DIFFICULTY_COLOR = { easy: 'text-green-400', moderate: 'text-yellow-400', hard: 'text-rose-400' } as const;
const DIFFICULTY_LABEL = { easy: 'سهل', moderate: 'متوسط', hard: 'صعب' } as const;

const PRIORITY_OPTIONS = [
  { value: 'shortest',         label: 'أقصر مسار',       desc: 'أقل مسافة كلومترية' },
  { value: 'easiest_terrain',  label: 'أسهل تضاريس',     desc: 'تجنب الميول الحادة' },
  { value: 'least_obstacles',  label: 'أقل عوائق',       desc: 'أقصى تجنب للعقبات' },
  { value: 'balanced',         label: 'متوازن',           desc: 'توازن بين المسافة والعوائق' },
] as const;

type InfraType = 'road' | 'water_pipe' | 'sewer' | 'power_line' | 'telecom' | 'general';

const INFRA_OPTIONS: { value: InfraType; label: string; icon: string; color: string; hint: string }[] = [
  { value: 'road',       label: 'طريق',           icon: '🛣️',  color: 'border-amber-500  bg-amber-900/30  text-amber-200',  hint: 'يراعي الانحدار الأقصى والممرات القائمة' },
  { value: 'water_pipe', label: 'أنبوب مياه',     icon: '💧',  color: 'border-blue-500   bg-blue-900/30   text-blue-200',   hint: 'يحسب التدفق بالجاذبية والعمق المناسب' },
  { value: 'sewer',      label: 'صرف صحي',        icon: '🔩',  color: 'border-green-600  bg-green-900/30  text-green-200',  hint: 'يتجنب مصادر المياه — انحدار ثابت ضروري' },
  { value: 'power_line', label: 'خط كهرباء',      icon: '⚡',  color: 'border-yellow-500 bg-yellow-900/30 text-yellow-200', hint: 'يفضل المسار المستقيم — نقل يتطلب أقل انعطافات' },
  { value: 'telecom',    label: 'اتصالات / كابل', icon: '📡',  color: 'border-purple-500 bg-purple-900/30 text-purple-200', hint: 'يتبع محاور الطرق للصيانة السهلة' },
  { value: 'general',    label: 'عام',             icon: '📍',  color: 'border-slate-500  bg-slate-800/50  text-slate-200',  hint: 'معايير متوازنة بدون تخصص' },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function OptimalPathPanel({
  routingPickMode, startPoint, endPoint,
  onStartPicking, onClearPoints, onResultReady,
}: Props) {
  const [infraType, setInfraType]   = useState<InfraType>('general');
  const [priority, setPriority]     = useState<'shortest' | 'easiest_terrain' | 'least_obstacles' | 'balanced'>('balanced');
  const [obstacles, setObstacles]   = useState<ObstacleOptions>({
    buildings: true, water: true, steep_slope: true, restricted_zones: true, existing_roads: false,
  });

  // Auto-set sensible defaults when infra type changes
  const handleInfraChange = (t: InfraType) => {
    setInfraType(t);
    if (t === 'road')       { setPriority('easiest_terrain'); setObstacles(p => ({ ...p, steep_slope: true, existing_roads: true })); }
    if (t === 'water_pipe') { setPriority('least_obstacles'); setObstacles(p => ({ ...p, water: true, steep_slope: true })); }
    if (t === 'sewer')      { setPriority('easiest_terrain'); setObstacles(p => ({ ...p, water: true, steep_slope: false })); }
    if (t === 'power_line') { setPriority('shortest');        setObstacles(p => ({ ...p, buildings: true, restricted_zones: true, existing_roads: false })); }
    if (t === 'telecom')    { setPriority('least_obstacles'); setObstacles(p => ({ ...p, existing_roads: true })); }
    if (t === 'general')    { setPriority('balanced'); }
  };
  const [loading, setLoading]       = useState(false);
  const [loadStep, setLoadStep]     = useState(0);  // 0=idle 1-5=progress steps
  const [error, setError]           = useState<string | null>(null);
  const [result, setResult]         = useState<PathResult | null>(null);
  const [showSegments, setShowSegments] = useState(false);

  const LOAD_STEPS = [
    'جارٍ جلب بيانات OSM والتضاريس...',
    'تحليل مسارات A* (7 مسارات)...',
    'تحميل ارتفاعات Copernicus DEM...',
    'تطبيق المعايير الهندسية (PI / PVI)...',
    'حساب الكميات والكلفرتات...',
  ];

  const toggleObs = (key: keyof ObstacleOptions) =>
    setObstacles(p => ({ ...p, [key]: !p[key] }));

  // ── Distance guard ──────────────────────────────────────────────────────────
  function haversineKm(a: [number, number], b: [number, number]): number {
    const R = 6371;
    const dLat = (b[1] - a[1]) * Math.PI / 180;
    const dLon = (b[0] - a[0]) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }

  const handleRun = useCallback(async () => {
    if (!startPoint || !endPoint) {
      setError('حدد نقطة البداية والنهاية على الخريطة أولاً');
      return;
    }
    const distKm = haversineKm(startPoint, endPoint);
    if (distKm < 0.05) {
      setError('نقطتا البداية والنهاية متقاربتان جداً (أقل من 50م) — حدد مسافة أطول');
      return;
    }
    if (distKm > 300) {
      setError(`المسافة المستقيمة ${distKm.toFixed(0)} كم — الحد الأقصى المدعوم 300 كم`);
      return;
    }

    setLoading(true);
    setLoadStep(1);
    setError(null);
    setResult(null);
    onResultReady(null);

    // Simulate progress steps while the server is working
    const stepTimer = setInterval(() => {
      setLoadStep(prev => prev < LOAD_STEPS.length ? prev + 1 : prev);
    }, 2800);

    try {
      const res = await fetch('/api/gis/optimal-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startPoint, end: endPoint, obstacles, priority, infrastructure_type: infraType }),
      });
      clearInterval(stepTimer);
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data: PathResult = await res.json();
      setResult(data);
      onResultReady(data);
    } catch (e: any) {
      clearInterval(stepTimer);
      setError(e?.message ?? 'فشل حساب المسار');
    } finally {
      setLoading(false);
      setLoadStep(0);
    }
  }, [startPoint, endPoint, obstacles, priority, infraType, onResultReady]);

  const handleClear = () => {
    setResult(null);
    onResultReady(null);
    onClearPoints();
    setError(null);
  };

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Route size={14} className="text-cyan-400 shrink-0" />
        <span className="text-[12px] font-bold text-slate-200">تحليل المسار الأمثل</span>
      </div>

      {/* Point pickers */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-2">
        <p className="text-xs text-slate-400 font-semibold">نقاط المسار</p>

        {/* Start */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">A</span>
          </div>
          {startPoint ? (
            <span className="text-xs text-green-300 font-mono flex-1">
              {startPoint[0].toFixed(5)}, {startPoint[1].toFixed(5)}
            </span>
          ) : (
            <span className="text-xs text-slate-500 flex-1">لم يُحدد</span>
          )}
          <button
            onClick={() => onStartPicking('start')}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              routingPickMode === 'picking_start'
                ? 'bg-green-700 border-green-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-green-500'
            }`}
          >
            {routingPickMode === 'picking_start' ? '← انقر على الخريطة' : 'تحديد'}
          </button>
        </div>

        {/* End */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-rose-600 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">B</span>
          </div>
          {endPoint ? (
            <span className="text-xs text-rose-300 font-mono flex-1">
              {endPoint[0].toFixed(5)}, {endPoint[1].toFixed(5)}
            </span>
          ) : (
            <span className="text-xs text-slate-500 flex-1">لم يُحدد</span>
          )}
          <button
            onClick={() => onStartPicking('end')}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              routingPickMode === 'picking_end'
                ? 'bg-rose-700 border-rose-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-rose-500'
            }`}
          >
            {routingPickMode === 'picking_end' ? '← انقر على الخريطة' : 'تحديد'}
          </button>
        </div>

        {(startPoint || endPoint) && (
          <button onClick={handleClear} className="text-xs text-slate-500 hover:text-slate-300 underline mt-1">
            مسح النقاط
          </button>
        )}
      </div>

      {/* Infrastructure type picker */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-2">
        <p className="text-xs text-slate-400 font-semibold">نوع البنية التحتية</p>
        <div className="grid grid-cols-2 gap-1">
          {INFRA_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleInfraChange(opt.value)}
              title={opt.hint}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs border transition-colors text-right ${
                infraType === opt.value
                  ? opt.color
                  : 'bg-slate-800/60 border-slate-700/40 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
        {infraType !== 'general' && (
          <p className="text-xs text-slate-500 italic">
            {INFRA_OPTIONS.find(o => o.value === infraType)?.hint}
          </p>
        )}
      </div>

      {/* Priority */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-2">
        <p className="text-xs text-slate-400 font-semibold">معيار التحسين</p>
        <div className="grid grid-cols-2 gap-1">
          {PRIORITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPriority(opt.value)}
              title={opt.desc}
              className={`px-2 py-1.5 rounded text-xs border transition-colors text-right ${
                priority === opt.value
                  ? 'bg-cyan-700/50 border-cyan-500 text-cyan-200'
                  : 'bg-slate-800/60 border-slate-700/40 text-slate-300 hover:border-slate-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Obstacles */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-1.5">
        <p className="text-xs text-slate-400 font-semibold">العوائق المراعاة</p>

        {([
          { key: 'buildings',        label: 'مبانٍ وإنشاءات', Icon: Building2,   color: 'text-orange-400' },
          { key: 'water',            label: 'مجاري مائية',    Icon: Waves,        color: 'text-blue-400' },
          { key: 'steep_slope',      label: 'ميول حادة',       Icon: Triangle,     color: 'text-yellow-400' },
          { key: 'restricted_zones', label: 'مناطق محظورة',   Icon: ShieldAlert,  color: 'text-rose-400' },
          { key: 'existing_roads',   label: 'تفضيل الطرق القائمة', Icon: Route,   color: 'text-green-400' },
        ] as const).map(({ key, label, Icon, color }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer group">
            <div
              onClick={() => toggleObs(key as keyof ObstacleOptions)}
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                obstacles[key as keyof ObstacleOptions]
                  ? 'bg-cyan-600 border-cyan-500'
                  : 'bg-slate-800 border-slate-600'
              }`}
            >
              {obstacles[key as keyof ObstacleOptions] && (
                <CheckCircle2 size={10} className="text-white" />
              )}
            </div>
            <Icon size={10} className={color} />
            <span className="text-xs text-slate-300 group-hover:text-slate-100 select-none">
              {label}
            </span>
          </label>
        ))}
      </div>

      {/* Run */}
      <button
        onClick={handleRun}
        disabled={loading || !startPoint || !endPoint}
        className="w-full py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
        {loading ? LOAD_STEPS[(loadStep - 1) % LOAD_STEPS.length] : 'حساب المسار الأمثل'}
      </button>

      {/* Progress stepper */}
      {loading && (
        <div className="rounded-lg border border-cyan-800/30 bg-cyan-950/20 p-2.5 space-y-1.5">
          {LOAD_STEPS.map((step, i) => {
            const done    = i + 1 < loadStep;
            const current = i + 1 === loadStep;
            return (
              <div key={i} className={`flex items-center gap-2 text-[10px] transition-opacity ${done ? 'opacity-50' : current ? 'opacity-100' : 'opacity-25'}`}>
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${done ? 'bg-green-600 border-green-500' : current ? 'bg-cyan-600 border-cyan-400 animate-pulse' : 'border-slate-700 bg-slate-800'}`}>
                  {done && <span className="text-white text-[8px]">✓</span>}
                  {current && <Loader2 size={8} className="text-white animate-spin" />}
                </div>
                <span className={current ? 'text-cyan-300 font-semibold' : done ? 'text-green-400' : 'text-slate-600'}>{step}</span>
              </div>
            );
          })}
          <div className="h-1 rounded-full bg-slate-800 mt-1 overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all duration-700 rounded-full"
              style={{ width: `${Math.min(100, (loadStep / LOAD_STEPS.length) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 px-3 py-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* ── Engineering verdict card ─────────────────────────── */}
          <VerdictCard result={result} infraType={infraType} />

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-1.5">
            <KpiBox label="المسافة الكلية"   value={`${result.stats.total_distance_km} كم`}  color="blue" />
            <KpiBox label="المسافة المستقيمة" value={`${result.stats.direct_distance_km} كم`} color="slate" />
            <KpiBox
              label="الصعوبة"
              value={DIFFICULTY_LABEL[result.stats.difficulty]}
              color={result.stats.difficulty === 'easy' ? 'green' : result.stats.difficulty === 'moderate' ? 'yellow' : 'red'}
            />
            <KpiBox label="الانحراف"          value={`${result.stats.detour_pct}%`}           color={result.stats.detour_pct < 15 ? 'green' : 'yellow'} />
            <KpiBox label="متوسط الميل"       value={`${result.stats.avg_slope_deg}°`}        color="slate" />
            <KpiBox label="وقت المشروع"       value={`${result.stats.estimated_time_min} د`} color="slate" sub="بسرعة 5كم/س" />
          </div>

          {/* Terrain profile */}
          <MiniProfile profile={result.terrain_profile} />

          {/* Obstacle stats */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <BarChart3 size={11} className="text-cyan-400" />
              <p className="text-xs text-slate-400 font-semibold">إحصائيات العوائق</p>
            </div>
            <div className="space-y-1">
              {[
                { label: 'مبانٍ مقاطَعة',    val: result.obstacle_stats.buildings_crossed,    color: 'text-orange-400' },
                { label: 'عبور مائي',          val: result.obstacle_stats.water_crossings,      color: 'text-blue-400' },
                { label: 'ميول حادة',          val: result.obstacle_stats.steep_segments,       color: 'text-yellow-400' },
                { label: 'مناطق محظورة مقاطَعة', val: result.obstacle_stats.restricted_crossings, color: 'text-rose-400' },
                { label: 'عوائق تم تجنبها',   val: result.obstacle_stats.total_avoided,        color: 'text-green-400' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{row.label}</span>
                  <span className={`font-bold ${row.color}`}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {result.notes.length > 0 && (
            <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-2.5 space-y-1">
              {result.notes.map((n, i) => (
                <p key={i} className="text-xs text-amber-200 leading-relaxed">{n}</p>
              ))}
            </div>
          )}

          {/* ── Export buttons ───────────────────────────────────── */}
          <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 p-2.5">
            <p className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
              <Download size={11} />
              تصدير المسار
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => exportGeoJSON(result, infraType)}
                className="flex-1 py-1.5 rounded text-xs bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-800/50 transition-colors font-semibold flex items-center justify-center gap-1"
              >
                <Download size={10} /> GeoJSON
              </button>
              <button
                onClick={() => exportKML(result, infraType)}
                className="flex-1 py-1.5 rounded text-xs bg-blue-900/40 border border-blue-700/50 text-blue-300 hover:bg-blue-800/50 transition-colors font-semibold flex items-center justify-center gap-1"
              >
                <Download size={10} /> KML
              </button>
              <button
                onClick={() => exportPDF(result, infraType, startPoint, endPoint)}
                className="flex-1 py-1.5 rounded text-xs bg-rose-900/40 border border-rose-700/50 text-rose-300 hover:bg-rose-800/50 transition-colors font-semibold flex items-center justify-center gap-1"
              >
                <Download size={10} /> PDF
              </button>
            </div>
            <p className="text-[9px] text-slate-600 mt-1.5">KML يُفتح في Google Earth · GeoJSON في QGIS / ArcGIS · PDF تقرير هندسي</p>
          </div>

          {/* Segments toggle */}
          <button
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded border border-slate-700/40 bg-slate-800/30"
            onClick={() => setShowSegments(s => !s)}
          >
            <span>تفاصيل المقاطع ({result.stats.segment_count})</span>
            {showSegments ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {showSegments && (
            <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900">
                  <tr className="text-slate-500">
                    <th className="px-2 py-1 text-right">#</th>
                    <th className="px-2 py-1 text-right">مسافة</th>
                    <th className="px-2 py-1 text-right">ميل</th>
                    <th className="px-2 py-1 text-right">تضاريس</th>
                    <th className="px-2 py-1 text-right">عائق</th>
                  </tr>
                </thead>
                <tbody>
                  {result.segments.map(seg => (
                    <tr key={seg.index} className="border-t border-slate-800/40">
                      <td className="px-2 py-0.5 text-slate-500">{seg.index}</td>
                      <td className="px-2 py-0.5 text-slate-300">{seg.distance_m}م</td>
                      <td className="px-2 py-0.5 text-slate-300">{seg.slope_deg}°</td>
                      <td className="px-2 py-0.5 text-slate-400">{
                        seg.terrain === 'flat' ? 'مستوي' :
                        seg.terrain === 'gentle' ? 'خفيف' :
                        seg.terrain === 'moderate' ? 'متوسط' : 'حاد'
                      }</td>
                      <td className={`px-2 py-0.5 ${seg.obstacle ? 'text-rose-400' : 'text-slate-600'}`}>
                        {seg.obstacle ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Engineering quantities ───────────────────────────── */}
          {result.engineering && result.engineering.quantities.length > 0 && (
            <div className="rounded-lg border border-cyan-700/30 bg-cyan-950/15 p-2.5 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">📋</span>
                <p className="text-xs font-bold text-cyan-300">جدول الكميات التقديرية</p>
                <span className="text-[9px] text-slate-500 mr-auto">
                  {result.engineering.dem_source === 'real' ? '📡 DEM حقيقي' : '⚠️ DEM تقريبي'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700/50">
                      <th className="py-1 text-right pr-1">البند</th>
                      <th className="py-1 text-center px-2">الكمية</th>
                      <th className="py-1 text-center">الوحدة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.engineering.quantities.map((q, i) => (
                      <tr key={i} className="border-b border-slate-800/30">
                        <td className="py-1 text-slate-200 pr-1 leading-tight">
                          {q.desc}
                          {q.note && <div className="text-[9px] text-slate-500">{q.note}</div>}
                        </td>
                        <td className="py-1 text-center text-blue-300 font-bold px-2">{q.qty.toLocaleString('ar')}</td>
                        <td className="py-1 text-center text-slate-400">{q.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Earthwork summary */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div className="rounded bg-orange-950/40 border border-orange-800/30 px-2 py-1.5 text-center">
                  <div className="text-[10px] text-orange-400 font-semibold">⛏ إجمالي الحفر (كات)</div>
                  <div className="text-sm font-bold text-orange-300">{result.engineering.cut_m3.toLocaleString('ar')} م³</div>
                </div>
                <div className="rounded bg-green-950/40 border border-green-800/30 px-2 py-1.5 text-center">
                  <div className="text-[10px] text-green-400 font-semibold">🪣 إجمالي الردم</div>
                  <div className="text-sm font-bold text-green-300">{result.engineering.fill_m3.toLocaleString('ar')} م³</div>
                </div>
              </div>

              {/* Elevation range */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>ارتفاع أدنى: <span className="text-slate-300">{result.engineering.elev_min_m}م</span></span>
                <span>ارتفاع أقصى: <span className="text-slate-300">{result.engineering.elev_max_m}م</span></span>
                <span>الفرق: <span className="text-yellow-300">{result.engineering.elev_range_m}م</span></span>
              </div>
            </div>
          )}

          {/* ── Engineering standards ──────────────────────────────── */}
          {result.engineering?.standards?.length > 0 && (
            <div className="rounded-lg border border-slate-700/30 bg-slate-800/20 p-2.5 space-y-1.5">
              <p className="text-xs font-bold text-slate-400">📏 المعايير الهندسية المطبقة</p>
              {result.engineering.standards.map((s, i) => (
                <p key={i} className="text-[10px] text-slate-400 leading-relaxed">• {s}</p>
              ))}
              {result.engineering.standards_ref && (
                <p className="text-[9px] text-slate-600 pt-0.5">المرجع: {result.engineering.standards_ref}</p>
              )}
            </div>
          )}

          {/* ── Path alternatives comparison + mini-map ──────────── */}
          {result.engineering?.alternatives?.length > 1 && (
            <AlternativesMiniMap
              alternatives={result.engineering.alternatives}
              startPoint={startPoint!}
              endPoint={endPoint!}
            />
          )}

          {/* ── PI table (horizontal alignment geometry) ─────────── */}
          {(result.engineering as any)?.pi_table?.filter((p: any) => p.type === 'curve').length > 0 && (
            <div className="rounded-lg border border-violet-700/30 bg-violet-950/15 p-2.5">
              <p className="text-xs font-bold text-violet-300 mb-2">📐 جدول PI — منحنيات SCS (حلزون + قوس + حلزون)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700/50 text-[9px]">
                      <th className="py-1 text-right pr-1">PI#</th>
                      <th className="py-1 text-center">Δ°</th>
                      <th className="py-1 text-center">R (م)</th>
                      <th className="py-1 text-center">T (م)</th>
                      <th className="py-1 text-center">L (م)</th>
                      <th className="py-1 text-center">Ls (م)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.engineering as any).pi_table
                      .filter((p: any) => p.type === 'curve')
                      .map((p: any, i: number) => (
                        <tr key={i} className="border-b border-slate-800/30 text-[10px]">
                          <td className="py-0.5 text-slate-400 pr-1">PI-{p.pi}</td>
                          <td className="py-0.5 text-center text-amber-300">{p.delta_deg}°</td>
                          <td className="py-0.5 text-center text-violet-300">{p.R_m}</td>
                          <td className="py-0.5 text-center text-slate-300">{p.T_m}</td>
                          <td className="py-0.5 text-center text-slate-300">{p.L_m}</td>
                          <td className={`py-0.5 text-center font-bold ${p.Ls_m > 0 ? 'text-cyan-300' : 'text-slate-600'}`}>
                            {p.Ls_m > 0 ? p.Ls_m : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] text-slate-600 mt-1">Δ = انعطاف · R = نصف قطر · T = مماس · L = قوس · Ls = حلزون Clothoid</p>
            </div>
          )}

          {/* ── PVI table (vertical alignment) ───────────────────── */}
          {(result.engineering as any)?.pvi_table?.filter((p: any) => p.type !== 'TANGENT').length > 0 && (
            <div className="rounded-lg border border-teal-700/30 bg-teal-950/15 p-2.5">
              <p className="text-xs font-bold text-teal-300 mb-2">📈 جدول المحاذاة الرأسية (PVI)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700/50 text-[9px]">
                      <th className="py-1 text-right pr-1">PVI</th>
                      <th className="py-1 text-center">النوع</th>
                      <th className="py-1 text-center">g1%</th>
                      <th className="py-1 text-center">g2%</th>
                      <th className="py-1 text-center">K</th>
                      <th className="py-1 text-center">L (م)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result.engineering as any).pvi_table
                      .filter((p: any) => p.type !== 'TANGENT')
                      .map((p: any, i: number) => (
                        <tr key={i} className="border-b border-slate-800/30 text-[10px]">
                          <td className="py-0.5 text-slate-400 pr-1">{p.dist_km}كم</td>
                          <td className={`py-0.5 text-center font-bold ${p.type === 'SAG' ? 'text-blue-300' : 'text-orange-300'}`}>
                            {p.type === 'SAG' ? '⌣ قعر' : '⌢ ذروة'}
                          </td>
                          <td className="py-0.5 text-center text-slate-400">{p.g1_pct}%</td>
                          <td className="py-0.5 text-center text-slate-400">{p.g2_pct}%</td>
                          <td className="py-0.5 text-center text-teal-300">{p.K}</td>
                          <td className="py-0.5 text-center text-slate-300">{p.L_m}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] text-slate-600 mt-1">K = معامل المنحنى · L = طول المنحنى الرأسي (AASHTO)</p>
            </div>
          )}

          {/* ── Cross-sections viewer ─────────────────────────────── */}
          {(result.engineering as any)?.cross_sections?.length > 0 && (
            <CrossSectionPanel
              sections={(result.engineering as any).cross_sections}
              cutRefined={(result.engineering as any).cut_m3_refined}
              fillRefined={(result.engineering as any).fill_m3_refined}
            />
          )}

          {/* ── Geotechnical analysis ─────────────────────────────── */}
          {(result.engineering as any)?.geotechnics?.summary && (
            <GeotechCard geotech={(result.engineering as any).geotechnics} />
          )}

          {/* ── Hydraulic culverts ────────────────────────────────── */}
          {(result.engineering as any)?.culverts?.length > 0 && (
            <CulvertCard culverts={(result.engineering as any).culverts} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Cross-section panel ───────────────────────────────────────────────────────

interface XsProps {
  sections: {
    chainage_m: number; chainage_km: number;
    ground_elev_m: number; design_elev_m: number;
    cut_m: number; fill_m: number;
    cut_area_m2: number; fill_area_m2: number;
    side_slope: string;
  }[];
  cutRefined: number;
  fillRefined: number;
}

function CrossSectionPanel({ sections, cutRefined, fillRefined }: XsProps) {
  const [open, setOpen] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);

  const maxCut  = Math.max(...sections.map(s => s.cut_m),  0.1);
  const maxFill = Math.max(...sections.map(s => s.fill_m), 0.1);
  const xs = sections[Math.min(activeIdx, sections.length - 1)];

  // Mini SVG cross-section diagram
  const W = 200, H = 80, CL = W / 2;
  const formHalfW = 20; // pixels representing half formation width
  const scaleH = (h: number) => Math.min(h / Math.max(maxCut, maxFill, 0.5) * 30, 35);
  const groundY = 50;

  return (
    <div className="rounded-lg border border-orange-700/30 bg-orange-950/10 p-2.5">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen(o => !o)}
      >
        <p className="text-xs font-bold text-orange-300">
          📏 المقاطع العرضية ({sections.length} مقطع · كل 25م)
        </p>
        {open ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
      </button>

      {/* Refined earthwork summary — always visible */}
      <div className="grid grid-cols-2 gap-1.5 mt-2">
        <div className="rounded bg-orange-950/50 border border-orange-800/40 px-2 py-1.5 text-center">
          <div className="text-[9px] text-orange-400 font-semibold">⛏ كات (prismatic)</div>
          <div className="text-xs font-bold text-orange-300">{cutRefined.toLocaleString('ar')} م³</div>
        </div>
        <div className="rounded bg-green-950/50 border border-green-800/40 px-2 py-1.5 text-center">
          <div className="text-[9px] text-green-400 font-semibold">🪣 ردم (prismatic)</div>
          <div className="text-xs font-bold text-green-300">{fillRefined.toLocaleString('ar')} م³</div>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {/* Mini diagram of selected section */}
          <div className="rounded bg-slate-900/60 p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-400 font-semibold">
                محطة {xs.chainage_m}م — أرضية {xs.ground_elev_m}م — تصميم {xs.design_elev_m}م
              </span>
              <span className={`text-[10px] font-bold ${xs.cut_m > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                {xs.cut_m > 0 ? `كات ${xs.cut_m}م` : `ردم ${xs.fill_m}م`}
              </span>
            </div>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ direction: 'ltr' }}>
              {/* Formation (road bed) */}
              <rect x={CL - formHalfW} y={groundY - 4} width={formHalfW * 2} height={4}
                fill="#475569" />
              {/* Cut area */}
              {xs.cut_m > 0 && (
                <polygon
                  points={`
                    ${CL - formHalfW},${groundY - 4}
                    ${CL - formHalfW - scaleH(xs.cut_m) * 1.5},${groundY - 4 - scaleH(xs.cut_m)}
                    ${CL + formHalfW + scaleH(xs.cut_m) * 1.5},${groundY - 4 - scaleH(xs.cut_m)}
                    ${CL + formHalfW},${groundY - 4}
                  `}
                  fill="rgba(251,146,60,0.25)" stroke="#f97316" strokeWidth="0.8"
                />
              )}
              {/* Fill area */}
              {xs.fill_m > 0 && (
                <polygon
                  points={`
                    ${CL - formHalfW},${groundY - 4}
                    ${CL - formHalfW - scaleH(xs.fill_m) * 1.5},${groundY - 4 + scaleH(xs.fill_m)}
                    ${CL + formHalfW + scaleH(xs.fill_m) * 1.5},${groundY - 4 + scaleH(xs.fill_m)}
                    ${CL + formHalfW},${groundY - 4}
                  `}
                  fill="rgba(74,222,128,0.15)" stroke="#4ade80" strokeWidth="0.8"
                />
              )}
              {/* Ground line */}
              <line x1={0} y1={groundY} x2={W} y2={groundY} stroke="#64748b" strokeWidth="0.8" />
              {/* Centre line */}
              <line x1={CL} y1={10} x2={CL} y2={H - 5}
                stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="3,2" />
              {/* Labels */}
              <text x={4}  y={groundY - 2} fontSize="7" fill="#64748b">طبيعي</text>
              <text x={CL - 8} y={H - 2} fontSize="6" fill="#94a3b8">محور</text>
            </svg>
          </div>

          {/* Station selector slider */}
          <div>
            <label className="text-[9px] text-slate-500">
              المحطة: {xs.chainage_m}م
              <input
                type="range" min={0} max={sections.length - 1}
                value={activeIdx}
                onChange={e => setActiveIdx(+e.target.value)}
                className="w-full accent-orange-500 mt-0.5"
              />
            </label>
          </div>

          {/* Table — first 10 rows visible, scrollable */}
          <div className="max-h-36 overflow-y-auto rounded border border-slate-700/40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-900">
                <tr className="text-slate-500 text-[9px]">
                  <th className="px-1.5 py-1 text-right">محطة</th>
                  <th className="px-1 py-1 text-center">أرضي</th>
                  <th className="px-1 py-1 text-center">تصميم</th>
                  <th className="px-1 py-1 text-center">كات</th>
                  <th className="px-1 py-1 text-center">ردم</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s, i) => (
                  <tr
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={`border-t border-slate-800/30 cursor-pointer transition-colors ${i === activeIdx ? 'bg-orange-900/20' : 'hover:bg-slate-800/30'}`}
                  >
                    <td className="px-1.5 py-0.5 text-slate-400">{s.chainage_m}م</td>
                    <td className="px-1 py-0.5 text-center text-slate-300">{s.ground_elev_m}</td>
                    <td className="px-1 py-0.5 text-center text-slate-400">{s.design_elev_m}</td>
                    <td className={`px-1 py-0.5 text-center font-bold ${s.cut_m > 0 ? 'text-orange-400' : 'text-slate-600'}`}>
                      {s.cut_m > 0 ? `${s.cut_m}م` : '—'}
                    </td>
                    <td className={`px-1 py-0.5 text-center font-bold ${s.fill_m > 0 ? 'text-green-400' : 'text-slate-600'}`}>
                      {s.fill_m > 0 ? `${s.fill_m}م` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── VerdictCard ───────────────────────────────────────────────────────────────
function VerdictCard({ result, infraType }: { result: PathResult; infraType: string }) {
  const eng = result.engineering as any;
  const diff = result.stats.difficulty;
  const diffColor = diff === 'easy' ? 'text-green-400 border-green-700/40 bg-green-950/20'
    : diff === 'moderate' ? 'text-yellow-400 border-yellow-700/40 bg-yellow-950/20'
    : 'text-rose-400 border-rose-700/40 bg-rose-950/20';
  const diffLabel = diff === 'easy' ? 'مسار ملائم' : diff === 'moderate' ? 'مسار متوسط' : 'مسار صعب';

  const earthworkM3 = (eng?.cut_m3 ?? 0) + (eng?.fill_m3 ?? 0);
  const netBalance  = (eng?.cut_m3 ?? 0) - (eng?.fill_m3 ?? 0);
  const balanceNote = netBalance > 10000
    ? `فائض حفر ${(netBalance / 1000).toFixed(0)}k م³ — يتطلب تصريف`
    : netBalance < -10000
    ? `عجز ردم ${(Math.abs(netBalance) / 1000).toFixed(0)}k م³ — يتطلب استيراد`
    : 'توازن جيد بين الحفر والردم';

  const violations = eng?.alternatives?.find((a: any) => a.selected)?.violations ?? 0;
  const piCount    = eng?.pi_table?.filter((p: any) => p.type === 'curve').length ?? 0;
  const culverts   = eng?.culverts?.length ?? 0;

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${diffColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold">{diffLabel}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{eng?.path_selected ?? ''}</p>
        </div>
        <div className="text-2xl font-black">{result.stats.total_distance_km} <span className="text-sm font-normal">كم</span></div>
      </div>

      <div className="grid grid-cols-4 gap-1 text-[9px]">
        <div className="rounded bg-slate-900/40 p-1.5 text-center">
          <div className="text-slate-500">حفر + ردم</div>
          <div className="font-bold text-slate-200">{(earthworkM3 / 1000).toFixed(0)}k م³</div>
        </div>
        <div className="rounded bg-slate-900/40 p-1.5 text-center">
          <div className="text-slate-500">توازن</div>
          <div className={`font-bold ${Math.abs(netBalance) < 10000 ? 'text-green-400' : 'text-yellow-400'}`}>
            {netBalance > 0 ? '+' : ''}{(netBalance / 1000).toFixed(0)}k
          </div>
        </div>
        <div className="rounded bg-slate-900/40 p-1.5 text-center">
          <div className="text-slate-500">منحنيات PI</div>
          <div className="font-bold text-violet-300">{piCount}</div>
        </div>
        <div className="rounded bg-slate-900/40 p-1.5 text-center">
          <div className="text-slate-500">كلفرتات</div>
          <div className="font-bold text-blue-300">{culverts}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[9px]">
        {violations === 0
          ? <span className="px-1.5 py-0.5 rounded bg-green-900/40 text-green-300 border border-green-800/40">✓ لا تجاوزات للميل</span>
          : <span className="px-1.5 py-0.5 rounded bg-rose-900/40 text-rose-300 border border-rose-800/40">⚠ {violations} تجاوز ميل</span>}
        <span className={`px-1.5 py-0.5 rounded border ${eng?.dem_source === 'real' ? 'bg-cyan-900/40 text-cyan-300 border-cyan-800/40' : 'bg-slate-800/40 text-slate-500 border-slate-700/40'}`}>
          {eng?.dem_source === 'real' ? '📡 DEM حقيقي' : '⚠ DEM تقريبي'}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-slate-800/40 text-slate-400 border border-slate-700/40">{balanceNote}</span>
      </div>
    </div>
  );
}

// ── AlternativesMiniMap ───────────────────────────────────────────────────────
const ALT_COLORS = ['#38bdf8','#fb923c','#4ade80','#f472b6','#a78bfa','#fbbf24','#34d399'];

function AlternativesMiniMap({
  alternatives,
  startPoint,
  endPoint,
}: {
  alternatives: { label: string; length_m: number; max_slope_pct: number; cut_m3: number; fill_m3: number; violations: number; selected: boolean; points_sample?: [number, number][] }[];
  startPoint: [number, number];
  endPoint: [number, number];
}) {
  const [hovIdx, setHovIdx] = React.useState<number | null>(null);

  // Compute bbox across all path points
  const allPts: [number, number][] = alternatives.flatMap(a => a.points_sample ?? []);
  if (allPts.length === 0) {
    // Fallback: plain table
    return (
      <div className="rounded-lg border border-slate-700/30 bg-slate-900/30 p-2.5">
        <p className="text-xs font-bold text-slate-400 mb-2">🔀 مقارنة المسارات البديلة</p>
        <div className="space-y-1">
          {alternatives.map((alt, i) => (
            <div key={i} className={`flex items-center justify-between text-[10px] px-1.5 py-1 rounded ${alt.selected ? 'bg-blue-900/30 border border-blue-700/40' : 'border border-transparent'}`}>
              <span className={alt.selected ? 'text-blue-300 font-semibold' : 'text-slate-400'}>{alt.selected ? '✅ ' : ''}{alt.label}</span>
              <div className="flex gap-2 text-slate-500">
                <span>{(alt.length_m / 1000).toFixed(2)}كم</span>
                <span className={alt.max_slope_pct > 10 ? 'text-rose-400' : ''}>{alt.max_slope_pct}٪</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const lons = allPts.map(p => p[0]);
  const lats = allPts.map(p => p[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const padLon = (maxLon - minLon) * 0.08 || 0.002;
  const padLat = (maxLat - minLat) * 0.08 || 0.002;
  const bMinLon = minLon - padLon, bMaxLon = maxLon + padLon;
  const bMinLat = minLat - padLat, bMaxLat = maxLat + padLat;
  const W = 280, H = 160;

  const toSvg = (lon: number, lat: number) => [
    ((lon - bMinLon) / (bMaxLon - bMinLon)) * W,
    H - ((lat - bMinLat) / (bMaxLat - bMinLat)) * H,
  ];

  return (
    <div className="rounded-lg border border-slate-700/30 bg-slate-900/30 p-2.5">
      <p className="text-xs font-bold text-slate-400 mb-2">🔀 مقارنة المسارات البديلة</p>

      {/* SVG mini-map */}
      <div className="relative mb-2 rounded overflow-hidden bg-slate-950/60 border border-slate-800/50">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          {/* Grid */}
          {[0.25, 0.5, 0.75].map(f => (
            <React.Fragment key={f}>
              <line x1={W * f} y1={0} x2={W * f} y2={H} stroke="#1e293b" strokeWidth="0.5" />
              <line x1={0} y1={H * f} x2={W} y2={H * f} stroke="#1e293b" strokeWidth="0.5" />
            </React.Fragment>
          ))}

          {/* Paths */}
          {alternatives.map((alt, i) => {
            const pts = alt.points_sample;
            if (!pts || pts.length < 2) return null;
            const d = pts.map((p, k) => {
              const [x, y] = toSvg(p[0], p[1]);
              return `${k === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
            }).join(' ');
            const isSelected = alt.selected;
            const isHovered  = hovIdx === i;
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={ALT_COLORS[i % ALT_COLORS.length]}
                strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.2}
                strokeOpacity={isSelected ? 1 : isHovered ? 0.9 : 0.45}
                strokeDasharray={isSelected ? undefined : '4,3'}
                onMouseEnter={() => setHovIdx(i)}
                onMouseLeave={() => setHovIdx(null)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* Start / End markers */}
          {(() => {
            const [sx, sy] = toSvg(startPoint[0], startPoint[1]);
            const [ex, ey] = toSvg(endPoint[0], endPoint[1]);
            return (
              <>
                <circle cx={sx} cy={sy} r={4} fill="#22c55e" stroke="#052e16" strokeWidth={1.5} />
                <circle cx={ex} cy={ey} r={4} fill="#ef4444" stroke="#450a0a" strokeWidth={1.5} />
                <text x={sx + 5} y={sy - 3} fontSize="7" fill="#86efac">A</text>
                <text x={ex + 5} y={ey - 3} fontSize="7" fill="#fca5a5">B</text>
              </>
            );
          })()}
        </svg>
      </div>

      {/* Legend + metrics table */}
      <div className="space-y-0.5">
        {alternatives.map((alt, i) => (
          <div
            key={i}
            onMouseEnter={() => setHovIdx(i)}
            onMouseLeave={() => setHovIdx(null)}
            className={`flex items-center gap-2 text-[10px] px-1.5 py-1 rounded cursor-default transition-colors
              ${alt.selected ? 'bg-blue-900/30 border border-blue-700/40' : hovIdx === i ? 'bg-slate-800/50' : 'border border-transparent'}`}
          >
            <span className="w-3 h-1.5 rounded-sm shrink-0" style={{ background: ALT_COLORS[i % ALT_COLORS.length], opacity: alt.selected ? 1 : 0.6 }} />
            <span className={`flex-1 truncate ${alt.selected ? 'font-bold text-blue-300' : 'text-slate-400'}`}>
              {alt.selected ? '✓ ' : ''}{alt.label}
            </span>
            <span className="text-slate-500 shrink-0">{(alt.length_m / 1000).toFixed(2)}كم</span>
            <span className={`shrink-0 ${alt.max_slope_pct > 10 ? 'text-rose-400' : 'text-slate-500'}`}>{alt.max_slope_pct}٪</span>
            <span className="text-slate-600 shrink-0">{((alt.cut_m3 + alt.fill_m3) / 1000).toFixed(0)}k م³</span>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-slate-700 mt-1.5">المسار المحدد بخط صلب · البدائل بخط متقطع</p>
    </div>
  );
}

// ── CulvertCard ───────────────────────────────────────────────────────────────
function CulvertCard({ culverts }: { culverts: any[] }) {
  const totalQ = culverts.reduce((a, c) => a + (c.Q_m3s ?? 0), 0);
  return (
    <div className="rounded-lg border border-blue-700/30 bg-blue-950/10 p-2.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-blue-300">🌊 تصميم الكلفرتات ({culverts.length} عبور)</p>
        <span className="text-[10px] text-blue-400">إجمالي تصريف: {totalQ.toFixed(2)} م³/ث</span>
      </div>
      <div className="space-y-2">
        {culverts.map((c, i) => (
          <div key={i} className="rounded bg-slate-800/40 border border-slate-700/30 p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-blue-200">عبور #{i + 1} — {c.culvert_type}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.Q_m3s > 20 ? 'bg-red-900/40 text-red-400' : c.Q_m3s > 5 ? 'bg-yellow-900/40 text-yellow-400' : 'bg-green-900/40 text-green-400'}`}>
                Q = {c.Q_m3s} م³/ث
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 text-[10px] mb-1">
              <div><span className="text-slate-500">حوض التصريف:</span> <span className="text-slate-300">{c.catchment_km2} كم²</span></div>
              <div><span className="text-slate-500">سرعة الجريان:</span> <span className="text-slate-300">{c.velocity_ms} م/ث</span></div>
              <div><span className="text-slate-500">ارتداد ماء:</span> <span className="text-slate-300">{c.headwater_m} م</span></div>
            </div>
            {c.dimensions && (
              <p className="text-[10px] text-cyan-300">الأبعاد: {c.dimensions}</p>
            )}
            {c.diameter_mm && !c.dimensions && (
              <p className="text-[10px] text-cyan-300">القطر: {c.diameter_mm} مم</p>
            )}
            {c.note && <p className="text-[9px] text-amber-300 mt-1">⚠ {c.note}</p>}
          </div>
        ))}
      </div>
      <p className="text-[9px] text-slate-600 mt-1.5">الطريقة العقلانية · عاصفة 10 سنوات · CSP · Manning n=0.024</p>
    </div>
  );
}

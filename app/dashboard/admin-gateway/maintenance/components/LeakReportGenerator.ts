/**
 * LeakReportGenerator — Generates an Arabic RTL HTML print window
 * and triggers browser Save-as-PDF for Leak Intelligence Reports.
 *
 * v2.0 — Redesigned:
 *  - Fixed MNDWI bar chart (inverted scale, anomaly-based bars)
 *  - Risk priority matrix comparing all zones side by side
 *  - Field GPS coordinates table (top emission points)
 *  - Zones sorted by risk priority (worsening trend > anomaly score)
 *  - Emission table capped at top-3 + summary count
 *  - Trend significance highlighted
 *  - Action plan with specific dates and priorities
 *
 * No external dependencies required. Uses browser native print API.
 */

export interface ReportEmissionPoint {
  point_id?: string;
  lon: number;
  lat: number;
  anomaly_score: number;
  mndwi_peak?: number;
  unmixed_water_frac?: number;
  color_code?: string;
  is_longitudinal?: boolean;
  description_ar?: string;
}

export interface ReportCandidate {
  candidate_id: string;
  label_ar: string;
  confidence: string;
  precision_level: string;
  first_seen: string;
  last_seen: string;
  score: number;
  anomaly_type: string;
  recommended_action: string;
  honest_note: string;
  frac_along_corridor: number;
  temporal_trend?: string;
  leak_subtype?: string;
  desert_anomaly_score?: number;
  longitudinal_score?: number;
  heatmap_peak_count?: number;
  valve_proximity_m?: number;
  nearest_valve_id?: string;
  intelligence_report_ar?: string;
  mndwi_growth_chart?: Record<string, number>;
  emission_points?: ReportEmissionPoint[];
  evidence?: Array<{ type: string; description_ar?: string; value?: number }>;
}

export interface ReportInput {
  jobId: string;
  corridorName: string;
  corridorCoords: [number, number][];
  bufferMeters: number;
  yearFrom: number;
  yearTo: number;
  candidates: ReportCandidate[];
  mapSnapshotDataUrl: string | null;
  generatedAt?: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function confidenceLabel(c: string) {
  return c === 'high' ? 'عالية' : c === 'moderate' ? 'متوسطة' : 'ضعيفة';
}
function confidenceColor(c: string) {
  return c === 'high' ? '#ef4444' : c === 'moderate' ? '#f59e0b' : '#60a5fa';
}
function trendLabel(t?: string) {
  const m: Record<string, string> = {
    expanding: 'متوسّع 📈', stable: 'ثابت →', new: 'حديث 🆕',
    seasonal: 'موسمي 〜', declining: 'متراجع 📉', unknown: 'غير محدد',
  };
  return t ? (m[t] ?? t) : '—';
}
function subtypeLabel(s?: string) {
  const m: Record<string, string> = {
    valve_chamber_leak: 'تسريب غرفة صمام',
    pipe_body_leak: 'تسريب جسم الأنبوب',
    chronic_wet_zone: 'منطقة رطبة مزمنة',
    seasonal_moisture: 'رطوبة موسمية',
  };
  return s ? (m[s] ?? s) : '—';
}

/** Detect worsening trend from mndwi_growth_chart (more negative over time = worsening). */
function detectTrendWorsening(chart?: Record<string, number>): { worsening: boolean; delta: number } {
  if (!chart) return { worsening: false, delta: 0 };
  const years = Object.keys(chart).sort();
  if (years.length < 2) return { worsening: false, delta: 0 };
  const first = chart[years[0]];
  const last  = chart[years[years.length - 1]];
  const delta = last - first; // negative delta = more negative MNDWI = worsening
  return { worsening: delta < -0.03, delta };
}

/** Compute risk priority score (higher = needs attention sooner). */
function riskPriority(z: ReportCandidate): number {
  const { worsening, delta } = detectTrendWorsening(z.mndwi_growth_chart);
  let score = (z.desert_anomaly_score ?? 0) * 40;   // up to 40 pts from anomaly
  score += z.score / 10;                              // up to ~2 pts from detection score
  if (worsening) score += 30 + Math.abs(delta) * 50; // major boost for worsening trend
  if (z.confidence === 'high')     score += 20;
  if (z.confidence === 'moderate') score += 10;
  return score;
}

// ─── SVG MNDWI anomaly bar chart ─────────────────────────────────────────────
// FIX v2.0: Use inverted MNDWI (−value) so that MORE moisture anomaly = TALLER bar.
// Shows trend direction clearly: rising bars = worsening leak.

function mndwiSvgChart(chart: Record<string, number>): string {
  const years = Object.keys(chart).sort();
  if (!years.length) return '';
  const vals    = years.map(y => chart[y] ?? 0);
  // Invert: more negative MNDWI = higher anomaly bar
  const invVals = vals.map(v => -v);
  const maxVal  = Math.max(...invVals, 0.01);
  const W = 480;
  const H = 90;
  const pad = 8;
  const barW = Math.floor((W - pad * 2) / years.length) - 2;

  const bars = years.map((yr, i) => {
    const v    = invVals[i];
    const barH = Math.max(4, (v / maxVal) * (H - 28));
    const x    = pad + i * ((W - pad * 2) / years.length);
    const y    = H - 18 - barH;
    // Color: higher anomaly = warmer color
    const ratio = v / maxVal;
    const fill  = ratio >= 0.85 ? '#ef4444'
                : ratio >= 0.65 ? '#f97316'
                : ratio >= 0.45 ? '#eab308'
                : '#3b82f6';
    return `
      <rect x="${x + 1}" y="${y}" width="${barW}" height="${barH}" fill="${fill}" rx="2"/>
      <text x="${x + barW / 2 + 1}" y="${y - 3}" text-anchor="middle" font-size="9" fill="#94a3b8">${vals[i].toFixed(2)}</text>
      <text x="${x + barW / 2 + 1}" y="${H - 4}" text-anchor="middle" font-size="9" fill="#64748b">'${yr.slice(-2)}</text>
    `;
  });

  // Add trend line
  const points = years.map((_, i) => {
    const v    = invVals[i];
    const barH = Math.max(4, (v / maxVal) * (H - 28));
    const x    = pad + i * ((W - pad * 2) / years.length) + barW / 2 + 1;
    const y    = H - 18 - barH;
    return `${x},${y}`;
  }).join(' ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#0f172a;border-radius:6px;display:block;margin:8px auto">
    ${bars.join('')}
    <polyline points="${points}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.7"/>
  </svg>`;
}

// ─── Risk priority comparison table ─────────────────────────────────────────

function riskMatrixHtml(candidates: ReportCandidate[]): string {
  if (candidates.length < 2) return '';
  const rows = candidates.map((z, i) => {
    const { worsening, delta } = detectTrendWorsening(z.mndwi_growth_chart);
    const anom = z.desert_anomaly_score != null ? Math.round(z.desert_anomaly_score * 100) + '٪' : '—';
    const trendStr = worsening
      ? `<span style="color:#ef4444;font-weight:700">↓ تفاقم (${Math.abs(delta).toFixed(2)})</span>`
      : `<span style="color:#22c55e">→ ثابت</span>`;
    const priority = i === 0 ? '<span style="background:#ef444422;color:#ef4444;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700">الأولى</span>'
                              : `<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:20px;font-size:10px">${i + 1}</span>`;
    const emCount = z.emission_points?.length ?? 0;
    return `<tr>
      <td>${priority}</td>
      <td style="font-weight:600;color:#0f172a">${z.label_ar}<br/><span style="font-size:9px;color:#94a3b8">ID: ${z.candidate_id.slice(-8)}</span></td>
      <td style="text-align:center">${z.score.toFixed(1)}</td>
      <td style="text-align:center">${anom}</td>
      <td style="text-align:center">${trendStr}</td>
      <td style="text-align:center">${z.first_seen} → ${z.last_seen}</td>
      <td style="text-align:center">${emCount}</td>
      <td style="text-align:center;font-size:10px;color:#64748b">${subtypeLabel(z.leak_subtype)}</td>
    </tr>`;
  }).join('');

  return `
  <div class="section">
    <h2>مصفوفة الأولويات والمقارنة</h2>
    <table class="data-table">
      <thead><tr>
        <th>الأولوية</th><th>المنطقة</th><th>الدرجة</th><th>شذوذ صحراوي</th>
        <th>الاتجاه الزمني</th><th>الفترة الزمنية</th><th>نقاط انبعاث</th><th>النوع</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:10px;color:#94a3b8;margin-top:6px">
      * المناطق مرتبة حسب الأولوية: يُعطى وزن أعلى للمناطق ذات الاتجاه المتفاقم والشذوذ الأعلى.
    </p>
  </div>`;
}

// ─── Field GPS coordinates table ─────────────────────────────────────────────

function fieldCoordinatesHtml(candidates: ReportCandidate[]): string {
  const rows: string[] = [];
  candidates.forEach((z, zi) => {
    const top3 = (z.emission_points ?? []).slice(0, 3);
    top3.forEach((ep, ei) => {
      const { worsening } = detectTrendWorsening(z.mndwi_growth_chart);
      const priority = zi === 0 && ei === 0
        ? '<span style="color:#ef4444;font-weight:700">★★★</span>'
        : zi === 0 ? '<span style="color:#f97316">★★</span>'
        : ei === 0 ? '<span style="color:#eab308">★★</span>'
        : '<span style="color:#94a3b8">★</span>';
      rows.push(`<tr>
        <td>${priority}</td>
        <td style="font-weight:600">${zi + 1}${String.fromCharCode(65 + ei)}</td>
        <td style="font-family:monospace;font-size:10px">${ep.lat.toFixed(5)}°N</td>
        <td style="font-family:monospace;font-size:10px">${ep.lon.toFixed(5)}°E</td>
        <td style="text-align:center">${Math.round(ep.anomaly_score * 100)}٪</td>
        <td style="text-align:center">${ep.mndwi_peak?.toFixed(3) ?? '—'}</td>
        <td style="text-align:center">${ep.is_longitudinal ? '✓' : '—'}</td>
        <td style="font-size:10px;color:#64748b">${worsening ? '⚠ تفاقم' : 'ثابت'} — ${z.first_seen}→${z.last_seen}</td>
      </tr>`);
    });
  });

  if (!rows.length) return '';
  return `
  <div class="section">
    <h2>إحداثيات GPS للفريق الميداني</h2>
    <p style="font-size:11px;color:#475569;margin-bottom:10px">أعلى نقاط الانبعاث الحراري لكل منطقة مرشّحة — مرتبة حسب الأولوية.</p>
    <table class="data-table">
      <thead><tr>
        <th>أولوية</th><th>نقطة</th><th>خط العرض</th><th>خط الطول</th>
        <th>شذوذ</th><th>MNDWI</th><th>طولي</th><th>ملاحظة</th>
      </tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    <p style="font-size:10px;color:#94a3b8;margin-top:6px">
      ★★★ = أعلى أولوية للفحص الميداني الفوري &nbsp;|&nbsp;
      دقة الإحداثيات: 10 م/بكسل (Sentinel-2 COG)
    </p>
  </div>`;
}

// ─── Action plan section ──────────────────────────────────────────────────────

function actionPlanHtml(candidates: ReportCandidate[], generatedAt: string): string {
  const actions = candidates.map((z, i) => {
    const { worsening } = detectTrendWorsening(z.mndwi_growth_chart);
    const urgency = worsening ? '7 أيام' : i === 0 ? '30 يوماً' : '60 يوماً';
    const urgencyColor = worsening ? '#ef4444' : i === 0 ? '#f97316' : '#eab308';
    const ep0 = z.emission_points?.[0];
    const coordStr = ep0 ? `(${ep0.lat.toFixed(4)}°N, ${ep0.lon.toFixed(4)}°E)` : '(راجع جدول الإحداثيات)';
    return `
    <div style="display:flex;gap:12px;margin-bottom:10px;align-items:flex-start">
      <div style="background:${urgencyColor};color:#fff;padding:4px 10px;border-radius:6px;font-size:10px;font-weight:700;white-space:nowrap;flex-shrink:0">
        خلال ${urgency}
      </div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:12px;color:#0f172a">المنطقة ${i + 1}: ${z.label_ar}</div>
        <div style="font-size:11px;color:#475569;margin-top:2px">
          الموقع: ${coordStr} — ${subtypeLabel(z.leak_subtype)}
          ${worsening ? '<br/><span style="color:#ef4444;font-weight:600">⚠ تحذير: الاتجاه الزمني يُظهر تفاقماً مستمراً</span>' : ''}
        </div>
        <div style="font-size:11px;color:#059669;margin-top:3px;font-weight:600">${z.recommended_action}</div>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="section">
    <h2>خطة العمل الميداني</h2>
    ${actions}
    <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;padding:12px;margin-top:12px">
      <p style="font-size:11px;color:#92400e;font-weight:600">ملاحظة هامة</p>
      <p style="font-size:11px;color:#78350f;margin-top:4px">
        هذه مناطق مرشّحة مشتبه بها — لا تُعدّ تأكيداً للتسرب.
        البيانات مشتقة من Sentinel-2 COG (دقة 10 م/بكسل).
        يُلزم التحقق الميداني قبل اتخاذ أي إجراء تشغيلي.
        تاريخ التقرير: ${generatedAt}
      </p>
    </div>
  </div>`;
}

// ─── candidate section HTML ──────────────────────────────────────────────────

function candidateHtml(z: ReportCandidate, idx: number): string {
  const cColor = confidenceColor(z.confidence);
  const chart  = z.mndwi_growth_chart && Object.keys(z.mndwi_growth_chart).length
    ? mndwiSvgChart(z.mndwi_growth_chart) : '';
  const { worsening, delta } = detectTrendWorsening(z.mndwi_growth_chart);

  // Top 3 emission points only
  const topEmissions = (z.emission_points ?? []).slice(0, 3);
  const extraCount   = (z.emission_points?.length ?? 0) - topEmissions.length;

  const emissionRows = topEmissions.map((ep, ei) => {
    const dotColor = ep.color_code === 'critical-red'  ? '#ef4444'
                   : ep.color_code === 'high-orange'   ? '#f97316'
                   : ep.color_code === 'medium-yellow' ? '#eab308'
                   : '#60a5fa';
    return `<tr>
      <td><span style="display:inline-block;width:10px;height:10px;background:${dotColor};border-radius:50%;"></span></td>
      <td>${ep.description_ar ?? `نقطة ${ei + 1}`}</td>
      <td style="text-align:center;font-family:monospace">${ep.lat.toFixed(5)}°N</td>
      <td style="text-align:center;font-family:monospace">${ep.lon.toFixed(5)}°E</td>
      <td style="text-align:center">${ep.anomaly_score != null ? Math.round(ep.anomaly_score * 100) + '٪' : '—'}</td>
      <td style="text-align:center">${ep.mndwi_peak != null ? ep.mndwi_peak.toFixed(3) : '—'}</td>
      <td style="text-align:center">${ep.is_longitudinal ? '✓' : '—'}</td>
    </tr>`;
  }).join('');

  const emissionTable = topEmissions.length
    ? `<div style="margin-top:12px">
        <p class="section-sub">أعلى نقاط الانبعاث الحراري ${extraCount > 0 ? `(عرض 3 من ${(z.emission_points?.length ?? 0)})` : ''}</p>
        <table class="data-table" style="margin-top:4px">
          <thead><tr>
            <th></th><th>الوصف</th><th>خط العرض</th><th>خط الطول</th><th>شذوذ</th><th>MNDWI</th><th>طولي</th>
          </tr></thead>
          <tbody>${emissionRows}</tbody>
        </table>
        ${extraCount > 0 ? `<p style="font-size:10px;color:#94a3b8;margin-top:4px">+ ${extraCount} نقاط إضافية — راجع جدول الإحداثيات الميدانية</p>` : ''}
      </div>` : '';

  const worseningBadge = worsening
    ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:8px 12px;margin-bottom:10px">
        <span style="color:#ef4444;font-weight:700;font-size:11px">⚠ تحذير: اتجاه زمني متفاقم — MNDWI تراجع ${Math.abs(delta).toFixed(2)} وحدة منذ أول رصد</span>
       </div>` : '';

  return `
  <div class="candidate-card" style="border-right:4px solid ${cColor}">
    <div class="candidate-header">
      <span class="cand-num">${idx + 1}</span>
      <span class="cand-label">${z.label_ar}</span>
      <span class="badge" style="background:${cColor}22;color:${cColor};border:1px solid ${cColor}44">${confidenceLabel(z.confidence)}</span>
      <span class="score-badge">درجة: ${z.score.toFixed(1)}</span>
      ${worsening ? '<span class="score-badge" style="background:#fef2f2;color:#ef4444">⚠ متفاقم</span>' : ''}
    </div>

    ${worseningBadge}

    <div class="meta-grid">
      <div class="meta-item"><span class="meta-key">النوع الفرعي</span><span>${subtypeLabel(z.leak_subtype)}</span></div>
      <div class="meta-item"><span class="meta-key">الاتجاه الزمني</span><span>${trendLabel(z.temporal_trend)}</span></div>
      <div class="meta-item"><span class="meta-key">أول ظهور</span><span>${z.first_seen}</span></div>
      <div class="meta-item"><span class="meta-key">آخر ظهور</span><span>${z.last_seen}</span></div>
      <div class="meta-item"><span class="meta-key">دقة التحليل</span><span>${z.precision_level}</span></div>
      <div class="meta-item"><span class="meta-key">الموضع على الممر</span><span>${Math.round(z.frac_along_corridor * 100)}٪</span></div>
      ${z.desert_anomaly_score != null ? `<div class="meta-item"><span class="meta-key">شذوذ صحراوي</span><span>${Math.round(z.desert_anomaly_score * 100)}٪</span></div>` : ''}
      ${z.valve_proximity_m != null && z.valve_proximity_m >= 0 ? `<div class="meta-item"><span class="meta-key">قرب الصمام</span><span>${Math.round(z.valve_proximity_m)} م (${z.nearest_valve_id ?? ''})</span></div>` : ''}
    </div>

    ${chart ? `<div class="chart-section"><p class="section-sub">شدة الشذوذ المائي عبر الزمن (الأعمدة الأعلى = شذوذ أكبر)</p>${chart}</div>` : ''}
    ${emissionTable}

    ${z.intelligence_report_ar ? `
    <div class="intel-box">
      <p class="section-sub">التقرير الاستخباراتي التفصيلي</p>
      <p class="intel-text">${z.intelligence_report_ar.replace(/\n/g, '<br/>')}</p>
    </div>` : ''}

    <div class="rec-box">
      <p class="rec-label">التوصية التشغيلية</p>
      <p class="rec-text">${z.recommended_action}</p>
      <p class="honest-note">${z.honest_note}</p>
    </div>
  </div>`;
}

// ─── full HTML document ──────────────────────────────────────────────────────

function buildHtml(input: ReportInput): string {
  const {
    jobId, corridorName, yearFrom, yearTo, bufferMeters,
    candidates: rawCandidates, mapSnapshotDataUrl, corridorCoords,
    generatedAt = new Date().toLocaleString('ar-LY'),
  } = input;

  // Sort candidates by risk priority descending (worst first)
  const candidates = [...rawCandidates].sort((a, b) => riskPriority(b) - riskPriority(a));

  const highConf   = candidates.filter(c => c.confidence === 'high').length;
  const worsening  = candidates.filter(c => detectTrendWorsening(c.mndwi_growth_chart).worsening);
  const totalEmit  = candidates.reduce((a, c) => a + (c.emission_points?.length ?? 0), 0);
  const topCand    = candidates[0];
  const coordStr   = corridorCoords.slice(0, 3).map(([ln, lt]) => `${lt.toFixed(4)}°ش، ${ln.toFixed(4)}°ش`).join(' ← ');

  const trendNote = topCand?.mndwi_growth_chart
    ? (() => {
        const vals = Object.values(topCand.mndwi_growth_chart);
        const first = vals[0]; const last = vals[vals.length - 1];
        const delta = last - first;
        return delta < -0.03
          ? `أعلى منطقة أولوية (${topCand.label_ar}) تُظهر تراجعاً في MNDWI بمقدار ${Math.abs(delta).toFixed(2)} وحدة — ما يشير إلى تزايد مستمر في الرطوبة الشاذة.`
          : `أعلى منطقة أولوية (${topCand.label_ar}) تُظهر استقراراً نسبياً (${first.toFixed(2)} → ${last.toFixed(2)}).`;
      })()
    : '';

  const candidatesSections = candidates.map((c, i) => candidateHtml(c, i)).join('\n');

  const mapSection = mapSnapshotDataUrl
    ? `<div class="map-snapshot"><img src="${mapSnapshotDataUrl}" alt="لقطة الخريطة" style="width:100%;border-radius:8px;border:1px solid #334155"/></div>`
    : `<div class="map-placeholder">⚠ لقطة الخريطة غير متاحة — يرجى تفعيل بروتوكول HTTPS أو إذن Canvas</div>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>تقرير ذكاء التسريبات — ${corridorName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo',sans-serif;background:#fff;color:#0f172a;direction:rtl;text-align:right;font-size:12px;line-height:1.6}
  h1{font-size:22px;font-weight:900;color:#0f172a}
  h2{font-size:15px;font-weight:700;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-bottom:14px}
  .page{max-width:860px;margin:0 auto;padding:28px 32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:3px solid #0ea5e9}
  .header-left h1{margin-bottom:4px}
  .header-meta{font-size:10px;color:#64748b;line-height:1.8}
  .logo-area{text-align:left;font-size:10px;color:#94a3b8}
  .logo-area strong{display:block;font-size:13px;color:#0ea5e9;font-weight:700}
  .warning-banner{background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:11px;color:#991b1b;font-weight:600}
  .exec-summary{background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin-bottom:20px}
  .exec-summary p{color:#0c4a6e;font-size:12px;line-height:1.9}
  .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
  .stat-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center}
  .stat-val{font-size:22px;font-weight:900;color:#0ea5e9}
  .stat-val.red{color:#ef4444}.stat-val.orange{color:#f97316}.stat-val.green{color:#10b981}
  .stat-label{font-size:10px;color:#64748b;margin-top:2px}
  .section{margin-bottom:24px}
  .map-placeholder{background:#f1f5f9;border:1px dashed #94a3b8;border-radius:8px;padding:20px;text-align:center;color:#64748b;font-size:11px}
  .candidate-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:16px;page-break-inside:avoid}
  .candidate-header{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
  .cand-num{width:24px;height:24px;background:#0ea5e9;color:#fff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
  .cand-label{font-size:13px;font-weight:700;color:#0f172a;flex:1}
  .badge{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600}
  .score-badge{font-size:10px;color:#64748b;background:#e2e8f0;border-radius:20px;padding:2px 8px}
  .meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}
  .meta-item{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px}
  .meta-key{display:block;font-size:9px;color:#94a3b8;margin-bottom:1px}
  .meta-item span:last-child{font-size:11px;font-weight:600;color:#1e293b}
  .chart-section{margin-top:10px}
  .section-sub{font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px;letter-spacing:0.5px}
  .data-table{width:100%;border-collapse:collapse;font-size:10px}
  .data-table th{background:#f1f5f9;padding:5px 8px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0}
  .data-table td{padding:5px 8px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:middle}
  .intel-box{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;margin-top:10px}
  .intel-text{font-size:11px;color:#78350f;line-height:1.9}
  .rec-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;margin-top:10px}
  .rec-label{font-size:10px;font-weight:700;color:#166534;margin-bottom:4px}
  .rec-text{font-size:11px;color:#15803d;line-height:1.8;font-weight:600}
  .honest-note{font-size:10px;color:#d97706;margin-top:4px}
  .footer{border-top:2px solid #e2e8f0;padding-top:12px;margin-top:28px;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
  @media print{
    body{font-size:11px}.page{padding:16px 20px}
    .candidate-card,.section{page-break-inside:avoid}
    @page{margin:15mm;size:A4}
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-left">
      <h1>تقرير ذكاء التسريبات</h1>
      <div class="header-meta">
        <div>الممر: <strong>${corridorName}</strong></div>
        <div>رقم الوظيفة: <code>${jobId}</code></div>
        <div>النافذة الزمنية: ${yearFrom} — ${yearTo} &nbsp;·&nbsp; عرض الحزام: ${bufferMeters} م</div>
        <div>الإحداثيات: ${coordStr}</div>
        <div>تاريخ التقرير: ${generatedAt}</div>
      </div>
    </div>
    <div class="logo-area">
      <strong>🛰 نظام كشف التسريبات</strong>
      MNT-S13 · Sentinel-2 COG<br/>sub-patch-optical precision
    </div>
  </div>

  ${worsening.length > 0 ? `<div class="warning-banner">⚠ تنبيه: ${worsening.length} من ${candidates.length} منطقة تُظهر اتجاهاً زمنياً متفاقماً — يُوصى بالفحص الميداني خلال 7 أيام.</div>` : ''}

  <div class="exec-summary">
    <h2 style="border:none;margin-bottom:6px;font-size:13px">الملخص التنفيذي</h2>
    <p>رصد النظام <strong>${candidates.length} منطقة مرشّحة</strong> على امتداد ممر <strong>${corridorName}</strong> خلال ${yearFrom}–${yearTo}.
    ${trendNote}
    ${highConf > 0 ? `<strong>${highConf} منطقة</strong> بثقة عالية تستدعي التحقق الفوري.` : ''}
    ${totalEmit > 0 ? `رُصد إجمالاً <strong>${totalEmit} نقطة انبعاث</strong>.` : ''}
    التحليل مبني على Sentinel-2 COG (10 م/بكسل). <strong>المناطق أدناه مرتبة حسب الأولوية الهندسية</strong> (تفاقم الاتجاه + شدة الشذوذ).</p>
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-val">${candidates.length}</div><div class="stat-label">مناطق مرشّحة</div></div>
    <div class="stat-card"><div class="stat-val red">${worsening.length}</div><div class="stat-label">اتجاه متفاقم</div></div>
    <div class="stat-card"><div class="stat-val orange">${totalEmit}</div><div class="stat-label">نقاط انبعاث</div></div>
    <div class="stat-card"><div class="stat-val ${highConf > 0 ? 'red' : 'green'}">${highConf}</div><div class="stat-label">ثقة عالية</div></div>
  </div>

  <div class="section"><h2>لقطة الخريطة</h2>${mapSection}</div>

  ${riskMatrixHtml(candidates)}
  ${fieldCoordinatesHtml(candidates)}
  ${actionPlanHtml(candidates, generatedAt)}

  <div class="section">
    <h2>تفصيل المناطق المرشّحة (${candidates.length}) — مرتبة حسب الأولوية</h2>
    ${candidatesSections}
  </div>

  <div class="footer">
    <span>نظام إدارة أصول المياه · وحدة الصيانة الوقائية MNT-S13</span>
    <span>تم الإنشاء تلقائياً — ${generatedAt}</span>
  </div>
</div>
<script>
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => window.print());
  } else { setTimeout(() => window.print(), 1200); }
</script>
</body></html>`;
}
// ─────────────────────────────────────────────────────────────────────────────
// EXECUTIVE REPORT — Simple Arabic PDF for general managers / non-specialists
// No technical terms. Plain language. Traffic-light risk system.
// ─────────────────────────────────────────────────────────────────────────────

function riskLevel(candidates: ReportCandidate[]): { level: 'high' | 'medium' | 'low'; label: string; color: string; bg: string } {
  const wCount = candidates.filter(c => detectTrendWorsening(c.mndwi_growth_chart).worsening).length;
  const hCount = candidates.filter(c => c.confidence === 'high').length;
  if (wCount > 0 || hCount > 0) return { level: 'high', label: 'مرتفع — يستدعي إجراءاً فورياً', color: '#dc2626', bg: '#fef2f2' };
  if (candidates.length > 1)     return { level: 'medium', label: 'متوسط — مراقبة وفحص مجدول',   color: '#d97706', bg: '#fffbeb' };
  return                                { level: 'low',    label: 'منخفض — مراقبة دورية',         color: '#16a34a', bg: '#f0fdf4' };
}

function simpleZoneDescription(z: ReportCandidate, idx: number): string {
  const { worsening } = detectTrendWorsening(z.mndwi_growth_chart);
  const pos = Math.round(z.frac_along_corridor * 100);
  const anom = z.desert_anomaly_score != null ? Math.round(z.desert_anomaly_score * 100) : 0;
  const urgency = worsening ? 'يُوصى بالفحص خلال 7 أيام' : idx === 0 ? 'يُوصى بالفحص خلال 30 يوماً' : 'مراقبة خلال 60 يوماً';
  const urgencyColor = worsening ? '#dc2626' : idx === 0 ? '#d97706' : '#16a34a';
  const ep0 = z.emission_points?.[0];
  const coordStr = ep0 ? `${ep0.lat.toFixed(4)}°N، ${ep0.lon.toFixed(4)}°E` : `عند ${pos}٪ من الممر`;
  const trendTxt = worsening
    ? '⚠ الرطوبة تزداد عاماً بعد عام — مؤشر على تسرب تراكمي'
    : 'الرطوبة ثابتة — قد تكون ظاهرة طبيعية أو تسرب قديم مستقر';

  return `
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-right:4px solid ${urgencyColor};border-radius:8px;padding:14px 16px;margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
      <div style="width:28px;height:28px;background:${urgencyColor};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${idx + 1}</div>
      <div style="font-size:14px;font-weight:700;color:#0f172a;flex:1">المنطقة ${idx + 1} — الموقع: ${coordStr}</div>
      <div style="background:${urgencyColor}22;color:${urgencyColor};font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid ${urgencyColor}44">${urgency}</div>
    </div>
    <div style="font-size:12px;color:#374151;line-height:1.9">
      <div>📍 <strong>الموقع على الممر:</strong> ${pos}٪ من البداية</div>
      <div>📊 <strong>مستوى الشذوذ:</strong> ${anom}٪ عن الحالة الطبيعية للمنطقة الصحراوية</div>
      <div>📅 <strong>الفترة المرصودة:</strong> من ${z.first_seen} إلى ${z.last_seen}</div>
      <div>📈 <strong>الاتجاه:</strong> ${trendTxt}</div>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-top:10px">
      <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:4px">✅ الإجراء المطلوب</div>
      <div style="font-size:12px;color:#15803d;font-weight:600">${z.recommended_action}</div>
    </div>
  </div>`;
}

function buildExecutiveHtml(input: ReportInput): string {
  const {
    jobId, corridorName, yearFrom, yearTo, bufferMeters,
    candidates: rawCandidates, mapSnapshotDataUrl, corridorCoords,
    generatedAt = new Date().toLocaleString('ar-LY'),
  } = input;

  const candidates = [...rawCandidates].sort((a, b) => riskPriority(b) - riskPriority(a));
  const risk = riskLevel(candidates);
  const worsening = candidates.filter(c => detectTrendWorsening(c.mndwi_growth_chart).worsening);
  const totalYears = yearTo - yearFrom + 1;
  const coordStr = corridorCoords.slice(0, 2).map(([ln, lt]) => `${lt.toFixed(3)}°N`).join(' ← ');

  const zonesSections = candidates.map((c, i) => simpleZoneDescription(c, i)).join('');

  const actionRows = candidates.map((z, i) => {
    const { worsening: w } = detectTrendWorsening(z.mndwi_growth_chart);
    const deadline = w ? '7 أيام' : i === 0 ? '30 يوماً' : '60 يوماً';
    const ep0 = z.emission_points?.[0];
    const coord = ep0 ? `${ep0.lat.toFixed(4)}°N, ${ep0.lon.toFixed(4)}°E` : `${Math.round(z.frac_along_corridor * 100)}٪ من الممر`;
    return `<tr>
      <td style="text-align:center;font-weight:700;color:${w ? '#dc2626' : i === 0 ? '#d97706' : '#16a34a'}">${deadline}</td>
      <td>المنطقة ${i + 1} — ${coord}</td>
      <td>فحص ميداني: قياس الضغط وفحص الوصلات</td>
      <td style="text-align:center">فريق الصيانة</td>
    </tr>`;
  }).join('');

  const mapSection = mapSnapshotDataUrl
    ? `<img src="${mapSnapshotDataUrl}" alt="خريطة الممر" style="width:100%;border-radius:8px;border:1px solid #d1d5db;max-height:280px;object-fit:cover"/>`
    : `<div style="background:#f3f4f6;border:1px dashed #9ca3af;border-radius:8px;padding:24px;text-align:center;color:#6b7280;font-size:12px">خريطة الممر غير متاحة في هذا التقرير</div>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<title>تقرير تنفيذي — ${corridorName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo',sans-serif;background:#fff;color:#111827;direction:rtl;text-align:right;font-size:13px;line-height:1.7}
  .page{max-width:820px;margin:0 auto;padding:32px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:3px solid #1d4ed8;margin-bottom:22px}
  .title{font-size:24px;font-weight:900;color:#1d4ed8}
  .subtitle{font-size:14px;color:#374151;margin-top:4px;font-weight:600}
  .meta{font-size:11px;color:#6b7280;line-height:2;margin-top:8px}
  .badge-system{font-size:11px;color:#6b7280;text-align:left}
  .badge-system strong{display:block;color:#1d4ed8;font-size:13px}
  .risk-banner{border-radius:10px;padding:16px 20px;margin-bottom:22px;border:2px solid}
  .risk-banner h2{font-size:18px;font-weight:900;margin-bottom:4px}
  .risk-banner p{font-size:13px;font-weight:500}
  .section-title{font-size:16px;font-weight:800;color:#111827;border-right:4px solid #1d4ed8;padding-right:10px;margin:22px 0 12px}
  .summary-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-bottom:20px}
  .summary-box p{font-size:13px;color:#1e3a8a;line-height:2}
  .summary-box strong{color:#1d4ed8}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}
  .stat{text-align:center;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px}
  .stat-n{font-size:32px;font-weight:900;color:#1d4ed8}
  .stat-n.red{color:#dc2626}.stat-n.orange{color:#d97706}
  .stat-t{font-size:11px;color:#6b7280;margin-top:2px}
  table.actions{width:100%;border-collapse:collapse;font-size:12px}
  table.actions th{background:#1d4ed8;color:#fff;padding:8px 12px;font-weight:700}
  table.actions td{padding:8px 12px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  .disclaimer{background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px;margin-top:20px}
  .disclaimer h3{font-size:13px;font-weight:700;color:#713f12;margin-bottom:6px}
  .disclaimer p{font-size:12px;color:#854d0e;line-height:1.9}
  .footer{border-top:2px solid #e5e7eb;padding-top:12px;margin-top:28px;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{body{font-size:12px}.page{padding:18px 22px}@page{margin:12mm;size:A4}}
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div>
      <div class="title">تقرير تنفيذي — رصد خط الأنابيب</div>
      <div class="subtitle">الممر: ${corridorName}</div>
      <div class="meta">
        التاريخ: ${generatedAt}<br/>
        الفترة الزمنية للرصد: ${yearFrom} — ${yearTo} (${totalYears} سنوات)<br/>
        رقم المهمة: ${jobId}
      </div>
    </div>
    <div class="badge-system">
      <strong>🛰 نظام المراقبة الفضائية</strong>
      وحدة الصيانة الوقائية<br/>
      MNT-S13 · Sentinel-2
    </div>
  </div>

  <div class="risk-banner" style="background:${risk.bg};border-color:${risk.color};color:${risk.color}">
    <h2>🚦 مستوى الخطر: ${risk.label}</h2>
    <p>بناءً على ${totalYears} سنوات من بيانات الأقمار الصناعية على امتداد ممر ${corridorName}</p>
  </div>

  <div class="summary-box">
    <p>
      رصد النظام خلال الفترة <strong>${yearFrom}–${yearTo}</strong> 
      <strong>${candidates.length} منطقة</strong> تُظهر رطوبة غير اعتيادية على امتداد ممر <strong>${corridorName}</strong>.
      ${worsening.length > 0 ? `<strong>${worsening.length} منطقة</strong> منها تُظهر تزايداً مستمراً في الرطوبة عبر السنوات — وهو مؤشر يستدعي الفحص الميداني.` : 'الرطوبة المرصودة ثابتة نسبياً عبر السنوات.'}
      <br/>
      <strong>المصدر:</strong> بيانات Sentinel-2 الحقيقية (وكالة الفضاء الأوروبية) — بدون محاكاة أو افتراضات.
    </p>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-n">${candidates.length}</div><div class="stat-t">مناطق مشتبه بها</div></div>
    <div class="stat"><div class="stat-n ${worsening.length > 0 ? 'red' : ''}">${worsening.length}</div><div class="stat-t">بتصاعد مستمر</div></div>
    <div class="stat"><div class="stat-n orange">${totalYears}</div><div class="stat-t">سنوات مراقبة</div></div>
  </div>

  <div class="section-title">📍 خريطة الممر</div>
  ${mapSection}

  <div class="section-title">🔍 ماذا وجدنا؟</div>
  <p style="color:#374151;font-size:12px;margin-bottom:14px">
    الأقمار الصناعية رصدت تغيّرات في مؤشر الرطوبة الأرضية على امتداد الممر.
    المناطق أدناه مرتبة حسب الأولوية — الأعلى خطراً أولاً:
  </p>
  ${zonesSections}

  <div class="section-title">📋 الإجراءات المطلوبة</div>
  <table class="actions">
    <thead><tr><th>الأولوية / الجدول الزمني</th><th>الموقع</th><th>الإجراء</th><th>الجهة المسؤولة</th></tr></thead>
    <tbody>${actionRows}</tbody>
  </table>

  <div class="disclaimer">
    <h3>⚠ تحفظات هامة</h3>
    <p>
      • هذه مناطق مشتبه بها — لا يُعدّ هذا التقرير تأكيداً لوجود تسرب.<br/>
      • دقة الأقمار الصناعية المستخدمة: 10 أمتار للبكسل الواحد — المواقع تقديرية لا دقيقة.<br/>
      • يجب التحقق الميداني من أي منطقة قبل اتخاذ قرار تشغيلي أو مالي.<br/>
      • للحصول على دقة أعلى (0.5م): يتوفر اشتراك بصور مدفوعة (Maxar / Planet).
    </p>
  </div>

  <div class="footer">
    <span>نظام إدارة أصول المياه · وحدة الصيانة الوقائية MNT-S13</span>
    <span>تقرير تنفيذي — ${generatedAt}</span>
  </div>
</div>
<script>
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => window.print());
  } else { setTimeout(() => window.print(), 1200); }
</script>
</body></html>`;
}

export function generateExecutiveLeakReport(input: ReportInput): void {
  const html = buildExecutiveHtml(input);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank', 'width=860,height=700,scrollbars=yes');
  if (!win) {
    const a = document.createElement('a');
    a.href     = url;
    a.download = `executive-report-${input.jobId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ─── public API ──────────────────────────────────────────────────────────────

export function generateLeakReport(input: ReportInput): void {
  const html = buildHtml(input);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank', 'width=900,height=750,scrollbars=yes');
  if (!win) {
    const a = document.createElement('a');
    a.href     = url;
    a.download = `leak-report-${input.jobId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

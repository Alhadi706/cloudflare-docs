'use client';
// ─── PDFReportGenerator — Phase S11.2 ────────────────────────────────────────
// Decision-grade Arabic PDF report.
// Includes executive summary, environmental interpretation, risk assessment,
// optional temporal comparison, optional forecast section.

import React from 'react';
import { FileDown } from 'lucide-react';
import type { AreaReport } from '@/lib/areaReportAPI';

interface Props {
  report:              AreaReport;
  areaName?:           string | null;
  temporalNarrative?:  string | null;
  temporalCompare?:    import('@/lib/s12API').TemporalCompareResult | null;
  simulationNarrative?: string | null;
  simulationYear?:     number | null;
  yearFrom?:           number | null;
  yearTo?:             number | null;
}

// ─── Executive summary generator ─────────────────────────────────────────────

function buildExecutiveSummary(report: AreaReport, areaName?: string | null): string {
  const e    = report.spatial_estimates;
  const env  = report.environment_summary;
  const risk = report.risk_signals;

  const urgentRecs = report.recommendations.filter(r => r.priority === 'high');
  const zoneLabel  = e.zone_ar;
  const areaLabel  = e.area_hectares >= 100
    ? `${e.area_km2.toFixed(1)} كم²`
    : `${e.area_hectares.toFixed(1)} هكتار`;

  let exec = `تقع المنطقة المُحللة ضمن ${zoneLabel}، وتبلغ مساحتها ${areaLabel}. `;
  exec += `تضم ما يقارب ${e.buildings_count.toLocaleString('ar-LY')} مبنى بسكان مُقدَّرين بـ ${e.population_est.toLocaleString('ar-LY')} نسمة. `;

  // Environmental snapshot
  if (env.heat_level && env.heat_level !== 'غير متاح') {
    exec += `مستوى الحرارة السطحية: ${env.heat_level}. `;
  }
  if (env.vegetation_status && env.vegetation_status !== 'غير متاح') {
    exec += `الغطاء النباتي: ${env.vegetation_status}. `;
  }

  // Risk summary
  const highRisks: string[] = [];
  if (risk.heat_stress && !['منخفض', 'غير محدد'].includes(risk.heat_stress as string))
    highRisks.push(`إجهاد حراري ${risk.heat_stress}`);
  if (risk.flood_risk && risk.flood_risk !== 'منخفض')
    highRisks.push(`خطر فيضانات ${risk.flood_risk}`);
  if (highRisks.length > 0) exec += `إشارات المخاطر تشمل: ${highRisks.join(' و')}. `;

  // Urgent recommendations
  if (urgentRecs.length > 0) {
    exec += `يُوصى باتخاذ ${urgentRecs.length} إجراء عاجل شرحه في التوصيات أدناه.`;
  } else {
    exec += `لا توصيات عاجلة. المنطقة ضمن المعدلات المقبولة.`;
  }
  return exec;
}

// ─── Priority badge ───────────────────────────────────────────────────────────

function priorityBadge(priority: string): string {
  if (priority === 'high')   return '<span style="color:#dc2626;font-weight:bold;">● عاجل</span>';
  if (priority === 'medium') return '<span style="color:#d97706;font-weight:bold;">● متوسط</span>';
  return '<span style="color:#2563eb;font-weight:bold;">● للعلم</span>';
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PDFReportGenerator({
  report, areaName,
  temporalNarrative, temporalCompare,
  simulationNarrative,
  simulationYear, yearFrom, yearTo,
}: Props) {

  const generateHTML = (): string => {
    const est  = report.spatial_estimates;
    const env  = report.environment_summary;
    const risk = report.risk_signals;
    const date = new Date(report.computed_at).toLocaleDateString('ar-LY', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const executiveSummary = buildExecutiveSummary(report, areaName);

    const recs = report.recommendations.map(r =>
      `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;">${priorityBadge(r.priority)}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;">${r.text}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:11px;">${r.department}</td>
      </tr>`
    ).join('');

    const temporalSection = (temporalNarrative && yearFrom && yearTo) ? `
  <div class="section">
    <p class="section-title">المقارنة الزمنية: ${yearFrom} – ${yearTo}</p>
    ${temporalCompare ? (() => {
      const f = temporalCompare.from_snapshot;
      const t = temporalCompare.to_snapshot;
      const metrics = [
        { label: 'المباني', from: f.buildings_count, to: t.buildings_count },
        { label: 'الأشجار', from: f.trees_count, to: t.trees_count },
        { label: 'السكان', from: f.population_est, to: t.population_est },
        { label: 'الطرق (كم)', from: f.road_km_paved, to: t.road_km_paved },
        { label: 'الغطاء الأخضر (%)', from: f.vegetation_pct, to: t.vegetation_pct, isPercent: true },
      ];
      const fmtV = (n: number, isP?: boolean) => isP ? `${n.toFixed(0)}%` : n >= 1000 ? `${(n/1000).toFixed(0)}ك` : Math.round(n).toString();
      const rows = metrics.map(m => {
        const max = Math.max(m.from, m.to, 1);
        const pct = ((m.to - m.from) / Math.max(1, Math.abs(m.from))) * 100;
        const pctStr = `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`;
        const pctColor = pct > 0 ? '#f97316' : pct < 0 ? '#ef4444' : '#6b7280';
        return `<tr>
          <td style="padding:5px 8px;font-size:11px;color:#6b7280;">${m.label}</td>
          <td style="padding:5px 8px;font-size:11px;">
            <div style="height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${(m.from/max*100).toFixed(0)}%;background:#93c5fd;border-radius:4px;"></div>
            </div>
            <span style="font-size:10px;color:#9ca3af;">${fmtV(m.from, (m as any).isPercent)}</span>
          </td>
          <td style="padding:5px 8px;font-size:11px;">
            <div style="height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${(m.to/max*100).toFixed(0)}%;background:#f97316;border-radius:4px;"></div>
            </div>
            <span style="font-size:10px;font-weight:bold;color:#111827;">${fmtV(m.to, (m as any).isPercent)}</span>
          </td>
          <td style="padding:5px 8px;font-size:11px;font-weight:bold;color:${pctColor};text-align:center;">${pctStr}</td>
        </tr>`;
      }).join('');
      return `<table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
        <thead><tr>
          <th style="text-align:right;padding:5px 8px;font-size:11px;color:#374151;border-bottom:1px solid #e5e7eb;">المؤشر</th>
          <th style="text-align:right;padding:5px 8px;font-size:11px;color:#3b82f6;border-bottom:1px solid #e5e7eb;">${yearFrom}</th>
          <th style="text-align:right;padding:5px 8px;font-size:11px;color:#f97316;border-bottom:1px solid #e5e7eb;">${yearTo}</th>
          <th style="text-align:center;padding:5px 8px;font-size:11px;color:#374151;border-bottom:1px solid #e5e7eb;">التغير</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    })() : ''}
    <div class="narrative-box" style="border-color:#bfdbfe;background:#f0f4ff;">
      ${temporalNarrative.replace(/\n/g, '<br/>')}
    </div>
  </div>` : '';

    const simulationSection = (simulationNarrative && simulationYear) ? `
  <div class="section">
    <p class="section-title">التوقع المستقبلي حتى ${simulationYear}</p>
    <div class="warning-badge">⚠️ هذا القسم يعرض توقعات تخطيطية — وليست بيانات فعلية. يُستخدم كأداة تخطيط ودعم القرار.</div>
    <div class="narrative-box" style="border-color:#fde68a;background:#fffbeb;">
      ${simulationNarrative.replace(/\n/g, '<br/>')}
    </div>
  </div>` : '';

    const dataSourceNote = env.satellite_enriched
      ? 'بيانات أقمار صناعية + نماذج تقدير هندسي'
      : 'نماذج تقدير جغرافي إقليمي (غياب بيانات قمر صناعي مباشر للمنطقة)';

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>تقرير إداري — ${areaName ?? est.zone_ar}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Arial', 'Segoe UI', Tahoma, sans-serif;
    font-size: 13px;
    line-height: 1.75;
    color: #1a1a2e;
    background: white;
    direction: rtl;
  }
  .page { max-width: 820px; margin: 0 auto; padding: 40px 48px; }

  /* Header */
  .header { border-bottom: 3px solid #1e40af; padding-bottom: 18px; margin-bottom: 24px; }
  .org-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .org-name { font-size: 11px; color: #6b7280; }
  .report-id { font-size: 10px; color: #9ca3af; }
  h1 { font-size: 20px; font-weight: bold; color: #1e3a8a; margin-bottom: 3px; }
  .subtitle { font-size: 13px; color: #374151; margin-bottom: 2px; }
  .date { font-size: 11px; color: #9ca3af; }

  /* Sections */
  .section { margin-bottom: 24px; }
  .section-title {
    font-size: 13px; font-weight: bold; color: #1e40af;
    border-right: 4px solid #3b82f6; padding-right: 10px;
    margin-bottom: 12px;
  }

  /* Executive summary */
  .exec-box {
    background: #f0fdf4; border: 1px solid #86efac;
    border-radius: 8px; padding: 14px 16px;
    font-size: 13px; line-height: 1.8;
  }

  /* Narrative boxes */
  .narrative-box {
    border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 12px 14px; font-size: 12px; line-height: 1.8;
    white-space: pre-line;
  }

  /* Stats grid */
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .stat-card {
    background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 8px; padding: 12px; text-align: center;
  }
  .stat-value { font-size: 18px; font-weight: bold; color: #1e3a8a; }
  .stat-label { font-size: 10px; color: #6b7280; margin-top: 2px; }

  /* Env / risk rows */
  .data-row {
    display: flex; justify-content: space-between;
    padding: 7px 4px; border-bottom: 1px solid #f3f4f6; align-items: center;
  }
  .row-label { color: #6b7280; font-size: 12px; }
  .row-val   { font-weight: 600; color: #111827; font-size: 12px; }

  /* Recs table */
  .recs-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .recs-table th {
    background: #eff6ff; color: #1e40af;
    padding: 8px 10px; text-align: right; font-size: 11px;
    border-bottom: 2px solid #bfdbfe;
  }

  /* Warning badge */
  .warning-badge {
    background: #fffbeb; border: 1px solid #fde68a;
    border-radius: 6px; padding: 8px 12px;
    font-size: 11px; color: #92400e;
    margin-bottom: 10px;
  }

  /* Footer */
  .disclaimer {
    margin-top: 24px; padding: 10px 14px;
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 6px; font-size: 11px; color: #6b7280;
  }
  .footer {
    margin-top: 20px; border-top: 1px solid #e5e7eb;
    padding-top: 10px; display: flex;
    justify-content: space-between; font-size: 10px; color: #9ca3af;
  }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .page { padding: 20px; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="org-row">
      <p class="org-name">البلدية — نظام الاستخبار الفضائي والمعلومات الجغرافية</p>
      <p class="report-id">المرجع: ${report.report_id.substring(0,8).toUpperCase()}</p>
    </div>
    <h1>تقرير تحليل المنطقة الجغرافية</h1>
    <p class="subtitle">${areaName ? `${areaName} — ` : ''}${est.zone_ar} · ${est.area_hectares >= 100 ? est.area_km2.toFixed(1) + ' كم²' : est.area_hectares.toFixed(1) + ' هكتار'}</p>
    <p class="date">تاريخ الإصدار: ${date} &nbsp;|&nbsp; مصدر البيانات: ${dataSourceNote}</p>
  </div>

  <!-- 1. Executive Summary -->
  <div class="section">
    <p class="section-title">الملخص التنفيذي</p>
    <div class="exec-box">${executiveSummary}</div>
  </div>

  <!-- 2. Full Narrative -->
  <div class="section">
    <p class="section-title">وصف المنطقة التفصيلي</p>
    <div class="narrative-box">${report.human_summary}</div>
  </div>

  <!-- 3. Key Measurements -->
  <div class="section">
    <p class="section-title">المؤشرات الكمية الرئيسية</p>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${est.buildings_count.toLocaleString('ar-LY')}</div>
        <div class="stat-label">عدد المباني (تقدير)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${est.population_est.toLocaleString('ar-LY')}</div>
        <div class="stat-label">السكان (تقدير)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${est.trees_count.toLocaleString('ar-LY')}</div>
        <div class="stat-label">أشجار مُقدَّرة</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${est.road_km_paved.toFixed(1)} كم</div>
        <div class="stat-label">طرق معبّدة</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${est.road_km_unpaved.toFixed(1)} كم</div>
        <div class="stat-label">طرق غير معبّدة</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${est.gov_facilities}</div>
        <div class="stat-label">مرافق حكومية</div>
      </div>
    </div>
  </div>

  <!-- 4. Environmental Analysis -->
  <div class="section">
    <p class="section-title">التحليل البيئي</p>
    <div class="data-row">
      <span class="row-label">الغطاء النباتي</span>
      <span class="row-val">${env.vegetation_status}${env.vegetation_pct != null ? ` (${env.vegetation_pct.toFixed(0)}% من المساحة)` : ''}</span>
    </div>
    <div class="data-row">
      <span class="row-label">درجة الحرارة السطحية</span>
      <span class="row-val">${env.heat_level}${env.temp_mean_c != null ? ` — ${env.temp_mean_c.toFixed(0)}°م` : ''}</span>
    </div>
    <div class="data-row">
      <span class="row-label">حالة التربة والرطوبة</span>
      <span class="row-val">${env.soil_moisture}</span>
    </div>
    <div class="data-row">
      <span class="row-label">مسطحات مائية مرصودة</span>
      <span class="row-val">${env.surface_water ? 'موجودة' : 'لا توجد'}</span>
    </div>
    <div class="data-row">
      <span class="row-label">دقة البيانات البيئية</span>
      <span class="row-val">${env.satellite_enriched ? 'مستخرجة من أقمار صناعية' : 'تقدير إقليمي (لا توجد صور مباشرة)'}</span>
    </div>
  </div>

  <!-- 5. Risk Assessment -->
  <div class="section">
    <p class="section-title">تقييم المخاطر</p>
    <div class="data-row">
      <span class="row-label">خطر الفيضانات</span>
      <span class="row-val">${risk.flood_risk}</span>
    </div>
    <div class="data-row">
      <span class="row-label">خطر الحرائق</span>
      <span class="row-val">${risk.fire_risk}</span>
    </div>
    <div class="data-row">
      <span class="row-label">الإجهاد الحراري</span>
      <span class="row-val">${risk.heat_stress}</span>
    </div>
  </div>

  ${temporalSection}
  ${simulationSection}

  <!-- 6. Recommendations -->
  ${report.recommendations.length > 0 ? `
  <div class="section">
    <p class="section-title">التوصيات</p>
    <table class="recs-table">
      <thead>
        <tr>
          <th style="width:80px;">الأولوية</th>
          <th>الإجراء الموصى</th>
          <th style="width:160px;">الجهة المسؤولة</th>
        </tr>
      </thead>
      <tbody>${recs}</tbody>
    </table>
  </div>` : ''}

  <!-- Disclaimer -->
  <div class="disclaimer">
    <strong>ملاحظة رسمية:</strong> هذا التقرير مبني على تقديرات مستخرجة من نماذج هندسية وبيانات الأقمار الاصطناعية المُعايَرة
    لمنطقة طرابلس وليبيا. الأرقام تقديرية وتُستخدم للتخطيط والمقارنة — وليست أرقاماً رسمية.
    الأرقام الرسمية تصدر من مصلحة الإحصاء والتعداد وهيئة المساحة والمواصفات.
    درجة الثقة في هذا التقرير: <strong>${report.meta.confidence}</strong>.
  </div>

  <div class="footer">
    <span>نظام الاستخبار الفضائي — D-Me.ly</span>
    <span>طُبع في: ${date} &nbsp;|&nbsp; المرجع: ${report.report_id.substring(0,8).toUpperCase()}</span>
  </div>
</div>
</body>
</html>`;
  };

  const handlePrint = () => {
    const html = generateHTML();
    const win  = window.open('', '_blank', 'width=900,height=720');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  return (
    <button
      onClick={handlePrint}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/30 text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 text-xs font-semibold transition-colors"
      title="تصدير تقرير PDF إداري"
    >
      <FileDown size={13} className="text-blue-400" />
      تصدير PDF
    </button>
  );
}



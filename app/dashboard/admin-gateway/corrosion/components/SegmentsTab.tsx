'use client';
import { Activity, Layers, AlertTriangle, Shield, FileDown, Map, FileText, Sheet } from 'lucide-react';
import { CpAnalysis } from '../types';
import { CP_STATUS_CONFIG, OVERALL_STATUS_CONFIG, SEG_ACTION, SEG_RISK_LEVEL, CP_RISK_EXPLANATIONS } from '../constants';

function segCfg(s: string) {
  return CP_STATUS_CONFIG[s as keyof typeof CP_STATUS_CONFIG] ?? CP_STATUS_CONFIG.UNKNOWN;
}

const CLASS_AR: Record<string, string> = {
  PROTECTED: 'محمية',
  MARGINAL: 'هامشية',
  NOT_PROTECTED: 'غير محمية',
  UNKNOWN: 'غير محدد',
};

export function SegmentsTab({
  analysis, viewMode, onGoToAnalysis,
}: {
  analysis: CpAnalysis | null;
  analysisLoading: boolean;
  viewMode: 'specialist' | 'manager';
  onGoToAnalysis: () => void;
}) {
  if (!analysis) {
    return (
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-12 text-center">
        <Layers className="w-12 h-12 mx-auto mb-3 text-slate-700" />
        <p className="text-slate-400 mb-1">لا توجد مقاطع محلَّلة بعد</p>
        <p className="text-xs text-slate-600 mb-4">افتح تبويب «تحليل المسح» واختر خطًا وجلسة مسح أولاً</p>
        <button onClick={onGoToAnalysis}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300 text-sm font-medium">
          <Activity className="w-4 h-4" /> الانتقال لتحليل المسح
        </button>
      </div>
    );
  }

  const segs = analysis.fixed_segments;
  const notProtected = segs.filter(s => s.classification === 'NOT_PROTECTED');
  const marginal     = segs.filter(s => s.classification === 'MARGINAL');
  const protected_   = segs.filter(s => s.classification === 'PROTECTED');
  const hasGps       = segs.some(s => s.gps_linestring && s.gps_linestring.length >= 2);
  const sessionDate  = analysis.session.survey_date ?? analysis.session.created_at?.slice(0, 10) ?? '—';
  const pipelineId   = analysis.session.pipeline_id ?? 'غير محدد';
  const sessionId    = analysis.session.session_id.slice(0, 8).toUpperCase();

  // ── 1. GeoJSON export (real GPS if available, else chainage-based fallback) ──
  function exportGeoJSON() {
    const features = segs.map(seg => {
      const hasRealGps = seg.gps_linestring && seg.gps_linestring.length >= 2;
      const geometry = hasRealGps
        ? { type: 'LineString', coordinates: seg.gps_linestring }
        : { type: 'LineString', coordinates: [[seg.start_distance, 0], [seg.end_distance, 0]] };
      return {
        type: 'Feature',
        properties: {
          seg_id:             seg.seg_id,
          pipeline_id:        pipelineId,
          survey_date:        sessionDate,
          classification:     seg.classification,
          classification_ar:  CLASS_AR[seg.classification] ?? seg.classification,
          avg_potential_mv:   seg.avg_potential,
          avg_shift_mv:       seg.avg_shift,
          severity_score:     seg.severity_score,
          point_count:        seg.point_count,
          protected_pts:      seg.protected_pts ?? null,
          marginal_pts:       seg.marginal_pts ?? null,
          not_protected_pts:  seg.not_protected_pts ?? null,
          risk_explanation:   seg.risk_explanation,
          action_required:    SEG_ACTION[seg.classification] ?? '—',
          start_distance_m:   seg.start_distance,
          end_distance_m:     seg.end_distance,
          gps_has_coords:     hasRealGps,
          centroid_lon:       seg.gps_centroid?.[0] ?? null,
          centroid_lat:       seg.gps_centroid?.[1] ?? null,
          nace_standard:      'NACE SP0169',
        },
        geometry,
      };
    });
    const geojson = {
      type: 'FeatureCollection',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features,
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cp_segments_${pipelineId}_${sessionId}.geojson`;
    a.click();
  }

  // ── 2. CSV export ──
  function exportCSV() {
    const headers = [
      'seg_id', 'start_distance_m', 'end_distance_m', 'point_count',
      'avg_potential_mv', 'avg_shift_mv', 'classification', 'classification_ar',
      'severity_score', 'protected_pts', 'marginal_pts', 'not_protected_pts',
      'action_required', 'risk_explanation',
      'centroid_lat', 'centroid_lon', 'gps_has_coords',
    ];
    const rows = segs.map(seg => [
      seg.seg_id,
      seg.start_distance,
      seg.end_distance,
      seg.point_count,
      seg.avg_potential ?? '',
      seg.avg_shift ?? '',
      seg.classification,
      CLASS_AR[seg.classification] ?? seg.classification,
      seg.severity_score,
      seg.protected_pts ?? '',
      seg.marginal_pts ?? '',
      seg.not_protected_pts ?? '',
      `"${(SEG_ACTION[seg.classification] ?? '').replace(/"/g, '""')}"`,
      `"${seg.risk_explanation.replace(/"/g, '""')}"`,
      seg.gps_centroid?.[1] ?? '',
      seg.gps_centroid?.[0] ?? '',
      seg.gps_linestring ? 'true' : 'false',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cp_segments_${pipelineId}_${sessionId}.csv`;
    a.click();
  }

  // ── 3. HTML printable report ──
  function exportHTMLReport() {
    const protPct = analysis.stats.protected_pct.toFixed(1);
    const margPct = analysis.stats.marginal_pct.toFixed(1);
    const notPct  = analysis.stats.not_protected_pct.toFixed(1);
    const overallAr = { GOOD: '✅ جيد', WARNING: '⚠️ تحذير', CRITICAL: '🔴 حرج' }[analysis.overall_status] ?? analysis.overall_status;

    const segRows = segs.map(seg => {
      const riskColor = seg.classification === 'NOT_PROTECTED' ? '#dc2626' : seg.classification === 'MARGINAL' ? '#d97706' : '#059669';
      const bars = Array.from({ length: 10 }).map((_, j) =>
        `<span style="display:inline-block;width:6px;height:12px;margin:0 1px;background:${j < seg.severity_score ? riskColor : '#374151'};border-radius:2px;"></span>`
      ).join('');
      return `
        <tr style="border-bottom:1px solid #e5e7eb;${seg.classification === 'NOT_PROTECTED' ? 'background:#fef2f2;' : seg.classification === 'MARGINAL' ? 'background:#fffbeb;' : ''}">
          <td style="padding:6px 10px;font-family:monospace;font-size:12px;">${seg.start_distance}–${seg.end_distance} م</td>
          <td style="padding:6px 10px;text-align:center;">${seg.point_count}</td>
          <td style="padding:6px 10px;font-family:monospace;text-align:center;">${seg.avg_potential != null ? seg.avg_potential.toFixed(0) + ' mV' : '—'}</td>
          <td style="padding:6px 10px;text-align:center;">${seg.avg_shift != null ? seg.avg_shift.toFixed(1) : '—'}</td>
          <td style="padding:6px 10px;font-weight:bold;color:${riskColor};">${CLASS_AR[seg.classification] ?? seg.classification}</td>
          <td style="padding:6px 10px;">${bars}</td>
          <td style="padding:6px 10px;font-size:11px;color:#374151;">${SEG_ACTION[seg.classification] ?? '—'}</td>
          <td style="padding:6px 10px;font-size:10px;color:#6b7280;">${seg.gps_centroid ? `${seg.gps_centroid[1].toFixed(5)}, ${seg.gps_centroid[0].toFixed(5)}` : '—'}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>تقرير مسح الحماية الكاثودية — ${pipelineId}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color:#111; background:#fff; padding:32px; font-size:14px; direction:rtl; }
    .header { border-bottom:3px solid #1e3a5f; padding-bottom:16px; margin-bottom:24px; }
    .header h1 { font-size:20px; color:#1e3a5f; margin-bottom:4px; }
    .header p  { font-size:12px; color:#6b7280; }
    .meta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
    .meta-card { border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; }
    .meta-card .label { font-size:11px; color:#6b7280; margin-bottom:4px; }
    .meta-card .value { font-size:16px; font-weight:bold; color:#111; }
    .stat-bar { display:flex; height:16px; border-radius:6px; overflow:hidden; margin:8px 0; }
    .stat-bar .prot { background:#059669; }
    .stat-bar .marg { background:#d97706; }
    .stat-bar .notp { background:#dc2626; }
    table { width:100%; border-collapse:collapse; font-size:12px; }
    thead tr { background:#1e3a5f; color:#fff; }
    thead th { padding:8px 10px; text-align:right; font-weight:600; }
    tbody tr:hover { background:#f9fafb; }
    .summary-box { border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin-bottom:24px; }
    .recommendation { background:#eff6ff; border:1px solid #93c5fd; border-radius:8px; padding:16px; margin-bottom:24px; }
    .recommendation .label { font-size:12px; color:#1d4ed8; font-weight:600; margin-bottom:6px; }
    .footer { margin-top:32px; border-top:1px solid #e5e7eb; padding-top:12px; font-size:11px; color:#9ca3af; text-align:center; }
    @media print { body { padding:16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>تقرير مسح الحماية الكاثودية — CP Survey Engineering Report</h1>
    <p>المعيار: NACE SP0169 | نظام التحليل: Digital Sovereignty Platform</p>
  </div>

  <div class="meta-grid">
    <div class="meta-card">
      <div class="label">معرّف الخط</div>
      <div class="value" style="font-size:13px">${pipelineId}</div>
    </div>
    <div class="meta-card">
      <div class="label">تاريخ المسح</div>
      <div class="value">${sessionDate}</div>
    </div>
    <div class="meta-card">
      <div class="label">معرّف الجلسة</div>
      <div class="value" style="font-size:13px;font-family:monospace">${analysis.session.session_id.slice(0, 8)}…</div>
    </div>
    <div class="meta-card">
      <div class="label">إجمالي المقاطع</div>
      <div class="value">${segs.length} مقطع × ${analysis.segment_size_used} م</div>
    </div>
    <div class="meta-card">
      <div class="label">إجمالي نقاط القياس</div>
      <div class="value">${analysis.stats.total_points.toLocaleString('ar')}</div>
    </div>
    <div class="meta-card">
      <div class="label">الحالة العامة</div>
      <div class="value">${overallAr}</div>
    </div>
  </div>

  <div class="summary-box">
    <strong style="display:block;margin-bottom:10px;">توزيع حالات الحماية</strong>
    <div class="stat-bar">
      <div class="prot" style="flex:${protected_.length}"></div>
      <div class="marg" style="flex:${marginal.length}"></div>
      <div class="notp" style="flex:${notProtected.length}"></div>
    </div>
    <div style="display:flex;gap:20px;margin-top:8px;font-size:12px;">
      <span><span style="color:#059669;font-weight:bold">■</span> محمية: ${protected_.length} (${protPct}%)</span>
      <span><span style="color:#d97706;font-weight:bold">■</span> هامشية: ${marginal.length} (${margPct}%)</span>
      <span><span style="color:#dc2626;font-weight:bold">■</span> غير محمية: ${notProtected.length} (${notPct}%)</span>
    </div>
    ${analysis.stats.worst_segment ? `<p style="margin-top:10px;font-size:12px;color:#dc2626;">⚠ أسوأ منطقة متتالية بلا حماية: ${analysis.stats.worst_segment.start}م → ${analysis.stats.worst_segment.end}م (${analysis.stats.worst_segment.length} نقطة)</p>` : ''}
    ${analysis.stats.max_negative_potential != null ? `<p style="margin-top:4px;font-size:12px;color:#374151;">أقصى جهد سالب: ${analysis.stats.max_negative_potential} mV</p>` : ''}
    <p style="margin-top:4px;font-size:11px;color:#6b7280;">البيانات الجغرافية: ${hasGps ? '✓ إحداثيات GPS حقيقية متاحة' : '✗ لا توجد إحداثيات GPS (القيم مبنية على المسافة فقط)'}</p>
  </div>

  <div class="recommendation">
    <div class="label">التوصية الهندسية</div>
    <div>${analysis.recommendation}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>مقطع الخط</th>
        <th>نقاط</th>
        <th>متوسط الجهد</th>
        <th>الإزاحة</th>
        <th>حالة الحماية</th>
        <th>درجة الخطورة</th>
        <th>الإجراء المطلوب</th>
        <th>الإحداثيات (خط/عرض)</th>
      </tr>
    </thead>
    <tbody>${segRows}</tbody>
  </table>

  <div class="footer">
    تقرير مولَّد تلقائياً — ${new Date().toLocaleString('ar-LY')} | NACE SP0169 | Digital Sovereignty Platform
  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (viewMode === 'manager') {
    const cfg = OVERALL_STATUS_CONFIG[analysis.overall_status] ?? OVERALL_STATUS_CONFIG.CRITICAL;
    return (
      <div className="space-y-4">
        <div className={`rounded-2xl border p-6 ${cfg.bg}`}>
          <div className="flex items-start gap-4">
            <span className="text-4xl">{cfg.icon}</span>
            <div>
              <p className="text-xs text-slate-400 mb-1">ملخص المقاطع — {analysis.session.pipeline_id ?? 'خط غير محدد'}</p>
              <h2 className={`text-2xl font-bold mb-2 ${cfg.text}`}>{cfg.label} — {segs.length} مقطع × {analysis.segment_size_used} م</h2>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div className="bg-red-900/30 rounded-xl p-3 text-center border border-red-500/30">
                  <p className="text-2xl font-bold text-red-300">{notProtected.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">غير محمية — NACE &gt;−700</p>
                </div>
                <div className="bg-amber-900/30 rounded-xl p-3 text-center border border-amber-500/30">
                  <p className="text-2xl font-bold text-amber-300">{marginal.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">هامشية — NACE −700↔−850</p>
                </div>
                <div className="bg-emerald-900/30 rounded-xl p-3 text-center border border-emerald-500/30">
                  <p className="text-2xl font-bold text-emerald-300">{protected_.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">محمية — NACE ≤−850</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {notProtected.length > 0 && (
          <div className="bg-red-900/20 rounded-2xl border border-red-500/30 p-5">
            <h3 className="font-bold text-red-200 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              المقاطع غير المحمية {'—'} NACE {'>'} −700 mV ({notProtected.length} مقطع)
            </h3>
            <div className="space-y-2">
              {notProtected.slice(0, 5).map((seg) => (
                <div key={seg.seg_id} className="flex items-center justify-between bg-red-900/20 rounded-xl px-4 py-3 border border-red-500/20">
                  <div>
                    <p className="text-sm font-bold text-red-200 font-mono">{seg.start_distance} – {seg.end_distance} م</p>
                    <p className="text-xs text-red-400 mt-0.5">متوسط الجهد: {seg.avg_potential != null ? `${seg.avg_potential.toFixed(0)} mV` : '—'}</p>
                  </div>
                  <p className="text-xs text-slate-300">{SEG_ACTION[seg.classification]}</p>
                </div>
              ))}
              {notProtected.length > 5 && <p className="text-xs text-red-400 text-center">+ {notProtected.length - 5} مقطع آخر</p>}
            </div>
          </div>
        )}

        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white mb-1">التوصية الهندسية</p>
              <p className="text-sm text-slate-300 mb-3">{analysis.recommendation}</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={exportHTMLReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 text-xs text-purple-300 transition-colors">
                  <FileText className="w-3.5 h-3.5" /> تقرير هندسي
                </button>
                <button onClick={exportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/30 text-xs text-emerald-300 transition-colors">
                  <Sheet className="w-3.5 h-3.5" /> تصدير CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <h3 className="text-base font-semibold text-white">توزيع حالات الحماية — NACE SP0169</h3>
            <p className="text-xs text-slate-500 mt-0.5">{segs.length} مقطع × {analysis.segment_size_used} م</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={exportGeoJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900/20 hover:bg-blue-900/40 border border-blue-500/30 text-xs text-blue-300 transition-colors"
              title={hasGps ? 'GeoJSON بإحداثيات GPS حقيقية' : 'GeoJSON (لا توجد بيانات GPS — سيُستخدم المسافة كإحداثي)'}>
              <Map className="w-3.5 h-3.5" />
              GeoJSON {hasGps ? '✓ GPS' : '⚠ بدون GPS'}
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/30 text-xs text-emerald-300 transition-colors">
              <Sheet className="w-3.5 h-3.5" /> تصدير CSV
            </button>
            <button onClick={exportHTMLReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-900/20 hover:bg-purple-900/40 border border-purple-500/30 text-xs text-purple-300 transition-colors">
              <FileText className="w-3.5 h-3.5" /> تقرير هندسي
            </button>
            <button onClick={onGoToAnalysis}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-xs text-slate-300 transition-colors">
              <Activity className="w-3.5 h-3.5" /> العودة للتحليل
            </button>
          </div>
        </div>
        <div className="flex h-8 rounded-lg overflow-hidden gap-px">
          {protected_.length > 0 && <div style={{ flex: protected_.length }} className="bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">{protected_.length > 2 ? protected_.length : ''}</div>}
          {marginal.length > 0    && <div style={{ flex: marginal.length }}    className="bg-amber-500  flex items-center justify-center text-xs font-bold text-white">{marginal.length > 2 ? marginal.length : ''}</div>}
          {notProtected.length > 0 && <div style={{ flex: notProtected.length }} className="bg-red-600  flex items-center justify-center text-xs font-bold text-white">{notProtected.length > 2 ? notProtected.length : ''}</div>}
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-base font-semibold text-white">جدول المقاطع الهندسي التفصيلي</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/60 text-right">
                {['مقطع الخط','نقاط','الجهد الطبيعي','الإزاحة','حالة الحماية','مستوى الخطر','درجة الخطورة','التوصية'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs text-slate-400 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {segs.map((seg) => {
                const cfg   = segCfg(seg.classification);
                const risk  = SEG_RISK_LEVEL[seg.classification] ?? SEG_RISK_LEVEL.UNKNOWN;
                const action = SEG_ACTION[seg.classification] ?? '—';
                return (
                  <tr key={seg.seg_id}
                    className={`hover:bg-slate-800/20 ${seg.classification === 'NOT_PROTECTED' ? 'bg-red-900/10' : seg.classification === 'MARGINAL' ? 'bg-amber-900/5' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300 font-semibold">{seg.start_distance} – {seg.end_distance} م</td>
                    <td className="px-4 py-3 text-slate-400 text-center">{seg.point_count}</td>
                    <td className="px-4 py-3 text-slate-200 font-mono">{seg.avg_potential != null ? seg.avg_potential.toFixed(0) : '—'}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono">{seg.avg_shift != null ? seg.avg_shift.toFixed(1) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${cfg.color}`}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.dot }} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${risk.bg} ${risk.color}`}>{risk.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 10 }).map((_, j) => (
                          <div key={j} className={`w-1.5 h-3 rounded-sm ${j < seg.severity_score ? (seg.classification === 'NOT_PROTECTED' ? 'bg-red-500' : seg.classification === 'MARGINAL' ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-700'}`} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-52">{action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {analysis.stats.worst_segment && (
        <div className="bg-red-900/20 rounded-2xl border border-red-500/30 p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-red-200 mb-1">أسوأ منطقة بلا حماية متتالية</h4>
            <p className="text-sm text-red-300">
              موقع <strong>{analysis.stats.worst_segment.start}</strong> م → <strong>{analysis.stats.worst_segment.end}</strong> م — <strong>{analysis.stats.worst_segment.length}</strong> نقطة متتالية بدون حماية
            </p>
            <p className="text-xs text-red-400 mt-1.5">{CP_RISK_EXPLANATIONS.NOT_PROTECTED}</p>
          </div>
        </div>
      )}
    </div>
  );
}

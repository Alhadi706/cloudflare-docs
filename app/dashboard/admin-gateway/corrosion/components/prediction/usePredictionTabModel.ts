import { useCallback, useEffect, useMemo, useState } from 'react';
import { AutoForecastPipeline, CpPredictedSegment } from '../../types';
import { useGisEngine } from '@/store/gisEngine';
import { buildAlerts, escapeHtml, healthScore, parseSegmentRange } from './predictionUtils';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7860';

type CpPipelineRow = {
  pipeline_id?: string | null;
  session_count?: number;
  sessions?: Array<{
    session_id: string;
    file_name: string;
    survey_date: string | null;
    total_points: number;
    start_distance: number | null;
    end_distance: number | null;
  }>;
};

function normalizePipelineId(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/^__UNASSIGNED__:/, '').trim().toLowerCase();
}

export function usePredictionTabModel() {
  const setCenter = useGisEngine((s) => s.setCenter);
  const setZoom = useGisEngine((s) => s.setZoom);
  const setWorkspace = useGisEngine((s) => s.setWorkspace);
  const setLayerVisible = useGisEngine((s) => s.setLayerVisible);
  const svyCpOverlay = useGisEngine((s) => s.svyCpOverlay);

  const [loading, setLoading] = useState(false);
  const [forecasts, setForecasts] = useState<AutoForecastPipeline[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [creatingWos, setCreatingWos] = useState<string | null>(null);
  const [woMessage, setWoMessage] = useState<string | null>(null);
  const [mapFocusMessage, setMapFocusMessage] = useState<string | null>(null);
  const [locatingSegId, setLocatingSegId] = useState<string | null>(null);

  const loadForecasts = useCallback(async () => {
    setLoading(true);
    try {
      const [forecastResp, cpResp] = await Promise.all([
        fetch(`${API}/api/v1/corrosion/cp-auto-forecasts?page=1&page_size=50&include_sessions=true&include_segments=true`),
        fetch(`${API}/api/v1/corrosion/cp-pipelines?page=1&page_size=120&include_sessions=true`),
      ]);

      const forecastRows: AutoForecastPipeline[] = forecastResp.ok
        ? ((await forecastResp.json())?.pipelines ?? [])
        : [];

      const cpRows: CpPipelineRow[] = cpResp.ok
        ? ((await cpResp.json())?.pipelines ?? [])
        : [];

      const forecastById = new Map<string, AutoForecastPipeline>();
      for (const row of forecastRows) {
        forecastById.set(row.pipeline_id, row);
        const normalized = normalizePipelineId(row.pipeline_id);
        if (normalized) forecastById.set(normalized, row);
      }

      const mergedFromCp: AutoForecastPipeline[] = cpRows.map((cp) => {
        const pipelineId = cp.pipeline_id ?? '__UNASSIGNED__';
        const linkedForecast =
          forecastById.get(pipelineId) ??
          forecastById.get(normalizePipelineId(pipelineId)) ??
          null;

        const cpSessions = Array.isArray(cp.sessions) ? cp.sessions : [];

        return {
          pipeline_id: pipelineId,
          session_count: cp.session_count ?? cpSessions.length,
          oldest_survey: cpSessions.length ? cpSessions[0]?.survey_date ?? null : null,
          latest_survey: cpSessions.length ? cpSessions[cpSessions.length - 1]?.survey_date ?? null : null,
          total_points: cpSessions.reduce((sum, s) => sum + (s.total_points ?? 0), 0),
          start_distance: cpSessions.length ? (cpSessions[0]?.start_distance ?? null) : null,
          end_distance: cpSessions.length ? (cpSessions[cpSessions.length - 1]?.end_distance ?? null) : null,
          sessions: cpSessions,
          forecast: linkedForecast?.forecast ?? null,
          accuracy: linkedForecast?.accuracy ?? null,
          ready_for_forecast: (cp.session_count ?? cpSessions.length) >= 2,
        };
      });

      const cpKeys = new Set(mergedFromCp.map((x) => normalizePipelineId(x.pipeline_id)));
      const forecastOnly = forecastRows.filter((fRow) => !cpKeys.has(normalizePipelineId(fRow.pipeline_id)));

      const merged = [...mergedFromCp, ...forecastOnly];

      setForecasts(merged);
      if (!selected) {
        const firstWithForecast = merged.find((p) => p.forecast);
        if (firstWithForecast) setSelected(firstWithForecast.pipeline_id);
        else if (merged.length) setSelected(merged[0].pipeline_id);
      }
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    loadForecasts();
  }, [loadForecasts]);

  const triggerForecast = useCallback(async (pid: string) => {
    setTriggering(pid);
    setTriggerMessage(null);
    try {
      const candidates = Array.from(
        new Set(
          [
            pid,
            normalizePipelineId(pid),
            normalizePipelineId(pid) ? `__UNASSIGNED__:${normalizePipelineId(pid)}` : null,
          ].filter((x): x is string => Boolean(x))
        )
      );

      let success = false;
      let lastErrorMessage = 'تعذر تشغيل التنبؤ لهذا الخط';

      for (const candidate of candidates) {
        const r = await fetch(`${API}/api/v1/corrosion/cp-ml-predict/${encodeURIComponent(candidate)}`, { method: 'POST' });
        let data: any = null;
        try {
          data = await r.json();
        } catch {
          data = null;
        }

        if (r.ok && !data?.error) {
          success = true;
          setTriggerMessage('تم تشغيل التنبؤ بنجاح');
          break;
        }

        if (data?.error === 'insufficient_sessions') {
          const found = typeof data?.sessions_found === 'number' ? data.sessions_found : 0;
          lastErrorMessage = `تعذر التنبؤ: يلزم مسحان على الأقل (المتاح حالياً: ${found})`;
          continue;
        }

        lastErrorMessage = data?.message ?? data?.detail ?? `فشل تشغيل التنبؤ (${r.status})`;
      }

      if (!success) {
        setTriggerMessage(lastErrorMessage);
      }

      await loadForecasts();
    } finally {
      setTriggering(null);
    }
  }, [loadForecasts]);

  const activePipeline = forecasts.find((p) => p.pipeline_id === selected) ?? null;
  const f = activePipeline?.forecast ?? null;
  const a = activePipeline?.accuracy ?? null;
  const score = f?.segments ? healthScore(f.segments) : null;
  const alerts = f?.segments ? buildAlerts(f.segments, f.overall_trend_mv_per_year, score ?? 0) : [];

  const withForecasts = forecasts.filter((p) => p.forecast).length;
  const withValidation = forecasts.filter((p) => p.accuracy && p.accuracy.validations_count > 0).length;
  const avgAccuracy = (() => {
    const vals = forecasts.filter((p) => p.accuracy && p.accuracy.cumulative_accuracy > 0).map((p) => p.accuracy!.cumulative_accuracy);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  })();

  const hotspotsForReport = useMemo(() => {
    if (!f?.segments?.length) return [] as CpPredictedSegment[];
    return [...f.segments]
      .filter((s) => s.predicted_class !== 'PROTECTED')
      .sort((aSeg, bSeg) => {
        const scoreA = aSeg.predicted_class === 'NOT_PROTECTED' ? 2 : 1;
        const scoreB = bSeg.predicted_class === 'NOT_PROTECTED' ? 2 : 1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return bSeg.predicted_avg_mv - aSeg.predicted_avg_mv;
      })
      .slice(0, 5);
  }, [f?.segments]);

  const focusSegmentOnMap = useCallback((seg: CpPredictedSegment) => {
    setMapFocusMessage(null);
    setLocatingSegId(seg.seg_id);

    const overlayPoints = svyCpOverlay?.features ?? [];
    if (!overlayPoints.length) {
      setMapFocusMessage('لا توجد نقاط GIS منشورة حالياً. افتح/ارفع ملف SVY يحتوي GPS ثم أعد المحاولة.');
      setLocatingSegId(null);
      return;
    }

    const { start, end } = parseSegmentRange(seg.seg_id);
    const mid = (start + end) / 2;
    const byRange = overlayPoints.filter((pt) => Number(pt.chainage_m) >= start && Number(pt.chainage_m) <= end);
    const candidates = byRange.length ? byRange : overlayPoints;

    const best = [...candidates]
      .filter((pt) => Number.isFinite(pt.gps_lat) && Number.isFinite(pt.gps_lon))
      .sort((x, y) => Math.abs(Number(x.chainage_m) - mid) - Math.abs(Number(y.chainage_m) - mid))[0];

    if (!best) {
      setMapFocusMessage('تعذر تحديد إحداثيات هذا المقطع.');
      setLocatingSegId(null);
      return;
    }

    setWorkspace('engineering');
    setLayerVisible('corridors', true);
    setCenter([Number(best.gps_lon), Number(best.gps_lat)]);
    setZoom(16);
    setMapFocusMessage(`تم الانتقال إلى ${seg.seg_id} عند (${Number(best.gps_lat).toFixed(5)}, ${Number(best.gps_lon).toFixed(5)})`);
    window.dispatchEvent(new CustomEvent('corrosion:prediction-focus', {
      detail: { seg_id: seg.seg_id, chainage_m: best.chainage_m, lat: best.gps_lat, lon: best.gps_lon },
    }));
    setTimeout(() => setLocatingSegId(null), 900);
  }, [setCenter, setLayerVisible, setWorkspace, setZoom, svyCpOverlay?.features]);

  const buildReportHtml = useCallback(() => {
    if (!activePipeline || !f) return '';

    const hc = f.at_risk_segments > f.segments_count * 0.5 ? '#dc2626'
             : f.at_risk_segments > 0 ? '#d97706' : '#059669';

    const hotRows = hotspotsForReport.map((s, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td class="mono">${escapeHtml(s.seg_id)}</td>
        <td><span class="b-${s.predicted_class === 'NOT_PROTECTED' ? 'r' : 'a'}">${s.predicted_class === 'NOT_PROTECTED' ? 'غير محمي' : 'هامشي'}</span></td>
        <td class="mono">${s.predicted_avg_mv !== 0 ? `${s.predicted_avg_mv} mV` : '—'}</td>
        <td>${Math.round((s.confidence ?? 0) * 100)}%</td>
      </tr>`).join('');

    const allRows = f.segments.map(s =>
      `<tr>
        <td class="mono">${escapeHtml(s.seg_id)}</td>
        <td><span class="b-${s.predicted_class === 'NOT_PROTECTED' ? 'r' : s.predicted_class === 'MARGINAL' ? 'a' : 'g'}">${s.predicted_class === 'NOT_PROTECTED' ? 'غير محمي' : s.predicted_class === 'MARGINAL' ? 'هامشي' : 'محمي'}</span></td>
        <td class="mono">${s.predicted_avg_mv !== 0 ? `${s.predicted_avg_mv} mV` : '—'}</td>
        <td>${Math.round((s.confidence ?? 0) * 100)}%</td>
      </tr>`).join('');

    const sessionRows = activePipeline.sessions.map((s, i) =>
      `<tr><td>${i + 1}</td><td>${escapeHtml(s.file_name)}</td><td>${s.survey_date ?? '—'}</td><td>${s.total_points.toLocaleString()}</td></tr>`
    ).join('');

    const alertsHtml = alerts.length
      ? `<ul style="list-style:none">${alerts.map(al => `<li class="alert-item">⚠ ${escapeHtml(al)}</li>`).join('')}</ul>`
      : '<p style="color:#64748b;padding:8px 0">لا توجد تنبيهات حرجة حالياً</p>';

    const protectedCount  = f.segments.filter(s => s.predicted_class === 'PROTECTED').length;
    const marginalCount   = f.segments.filter(s => s.predicted_class === 'MARGINAL').length;
    const unprotectedCount = f.segments.filter(s => s.predicted_class === 'NOT_PROTECTED').length;
    const protPct  = f.segments_count > 0 ? Math.round(protectedCount  / f.segments_count * 100) : 0;
    const margPct  = f.segments_count > 0 ? Math.round(marginalCount   / f.segments_count * 100) : 0;
    const unprPct  = f.segments_count > 0 ? Math.round(unprotectedCount / f.segments_count * 100) : 0;

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><title>تقرير التنبؤ — ${escapeHtml(activePipeline.pipeline_id)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:11px;color:#1e293b;background:#fff;padding:18mm;line-height:1.5}
  h1{font-size:18px;font-weight:900;color:${hc}}
  h2{font-size:13px;font-weight:700;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid #e2e8f0;color:#0f172a}
  .meta{font-size:10px;color:#64748b;margin-top:4px}
  .krow{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
  .kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;text-align:center;flex:1;min-width:80px}
  .kv{font-size:18px;font-weight:800}
  .kl{font-size:9px;color:#64748b;margin-top:2px}
  .bar{height:14px;border-radius:7px;overflow:hidden;display:flex;margin:8px 0}
  .bl{display:flex;gap:14px;font-size:9px;color:#64748b;margin-top:3px}
  table{width:100%;border-collapse:collapse;margin:8px 0;font-size:10px}
  th{background:#f1f5f9;text-align:right;padding:5px 7px;font-size:9.5px;font-weight:600;border:1px solid #e2e8f0;color:#475569}
  td{padding:4px 7px;border:1px solid #e2e8f0;vertical-align:top}
  tr:nth-child(even) td{background:#f8fafc}
  .mono{font-family:'Courier New',monospace}
  .b-r{background:#fee2e2;color:#b91c1c;border-radius:3px;padding:1px 5px;font-weight:700;font-size:9px}
  .b-a{background:#fff7ed;color:#c2410c;border-radius:3px;padding:1px 5px;font-weight:700;font-size:9px}
  .b-g{background:#d1fae5;color:#065f46;border-radius:3px;padding:1px 5px;font-weight:700;font-size:9px}
  .alert-item{background:#fef2f2;border-right:3px solid #ef4444;padding:6px 10px;margin:4px 0;border-radius:0 4px 4px 0;font-size:10px;color:#7f1d1d}
  .footer{margin-top:20px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
  @media print{body{padding:12mm}@page{margin:12mm}}
</style></head>
<body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid ${hc};margin-bottom:16px">
  <div><h1>تقرير تنبؤ التآكل</h1><p class="meta">نظام التنبؤ الذكي · NACE SP0169</p></div>
  <div style="text-align:left">
    <p class="meta">الخط: <strong>${escapeHtml(activePipeline.pipeline_id)}</strong></p>
    <p class="meta">تاريخ الإنشاء: ${new Date().toLocaleString('ar-LY')}</p>
  </div>
</div>

<div class="krow">
  <div class="kpi"><div class="kv">${f.segments_count}</div><div class="kl">مقاطع تحليلية</div></div>
  <div class="kpi"><div class="kv" style="color:#ef4444">${f.at_risk_segments}</div><div class="kl">مقاطع في خطر</div></div>
  <div class="kpi"><div class="kv" style="color:${f.overall_trend_mv_per_year !== null && f.overall_trend_mv_per_year > 0 ? '#ef4444' : '#10b981'}">${f.overall_trend_mv_per_year !== null ? `${f.overall_trend_mv_per_year > 0 ? '+' : ''}${f.overall_trend_mv_per_year.toFixed(1)}` : '—'}</div><div class="kl">اتجاه الجهد (mV/سنة)</div></div>
  <div class="kpi"><div class="kv" style="color:#8b5cf6">${a ? `${a.cumulative_accuracy.toFixed(1)}%` : '—'}</div><div class="kl">دقة النموذج</div></div>
</div>

<h2>توزيع تصنيف المقاطع</h2>
<div class="bar">
  <div style="width:${protPct}%;background:#10b981"></div>
  <div style="width:${margPct}%;background:#f59e0b"></div>
  <div style="width:${Math.max(unprPct, protPct + margPct + unprPct < 100 ? 100 - protPct - margPct : unprPct)}%;background:#ef4444;flex:${unprPct > 0 || protPct + margPct < 100 ? '1 0 0' : 'none'}"></div>
</div>
<div class="bl">
  <span>■ محمية ${protPct}% (${protectedCount} مقطع)</span>
  <span>■ هامشية ${margPct}% (${marginalCount} مقطع)</span>
  <span>■ غير محمية ${unprPct}% (${unprotectedCount} مقطع)</span>
</div>

<h2>تنبيهات النظام الذكي</h2>
${alertsHtml}

<h2>أعلى 5 نقاط خطورة</h2>
${hotspotsForReport.length > 0
  ? `<table><thead><tr><th>#</th><th>المقطع</th><th>التصنيف</th><th>الجهد المتنبأ</th><th>الثقة</th></tr></thead><tbody>${hotRows}</tbody></table>`
  : '<p style="color:#064e3b;background:#d1fae5;padding:8px 12px;border-radius:6px">✓ جميع المقاطع محمية — لا توجد نقاط خطرة</p>'}

<h2>جميع مقاطع الخط (${f.segments.length} مقطع)</h2>
<table><thead><tr><th>المقطع</th><th>التصنيف</th><th>الجهد المتنبأ (mV)</th><th>الثقة</th></tr></thead>
<tbody>${allRows}</tbody></table>

<h2>جلسات المسح المُدخلة في التنبؤ</h2>
${activePipeline.sessions.length > 0
  ? `<table><thead><tr><th>#</th><th>اسم الملف</th><th>تاريخ المسح</th><th>نقاط القياس</th></tr></thead><tbody>${sessionRows}</tbody></table>`
  : '<p style="color:#64748b">لا توجد جلسات مسح مرتبطة</p>'}

<div class="footer">
  <span>الخط: ${escapeHtml(activePipeline.pipeline_id)}</span>
  <span>NACE SP0169 / ISO 15589-1</span>
  <span>تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-LY')}</span>
</div>
</body></html>`;
  }, [a, activePipeline, alerts, f, hotspotsForReport]);

  const downloadReport = useCallback(() => {
    const html = buildReportHtml();
    if (!html || !activePipeline) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const aEl = document.createElement('a');
    aEl.href = URL.createObjectURL(blob);
    aEl.download = `prediction-report-${activePipeline.pipeline_id}-${new Date().toISOString().slice(0, 10)}.html`;
    aEl.click();
    URL.revokeObjectURL(aEl.href);
  }, [activePipeline, buildReportHtml]);

  const printReport = useCallback(() => {
    const html = buildReportHtml();
    if (!html) return;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }, [buildReportHtml]);

  const createForecastWorkOrders = useCallback(async (policy: 'quarterly' | 'annual') => {
    if (!activePipeline) return;
    setWoMessage(null);
    setCreatingWos(policy);
    try {
      const r = await fetch(`${API}/api/v1/corrosion/cp-forecast-work-orders/${encodeURIComponent(activePipeline.pipeline_id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodic_policy: policy,
          create_emergency: true,
          create_predictive: true,
          max_segment_orders: 3,
          predictive_lead_days: 30,
          created_by: 'corrosion_prediction_tab',
        }),
      });
      const d = await r.json();
      if (!r.ok || d?.success === false) {
        setWoMessage(`فشل إنشاء أوامر العمل: ${d?.detail ?? d?.message ?? 'خطأ غير معروف'}`);
        return;
      }
      setWoMessage(`تم إنشاء ${d.created_count ?? 0} أمر عمل، وتخطي ${d.skipped_count ?? 0} أمر مكرر.`);
    } catch (err: any) {
      setWoMessage(`تعذر إنشاء أوامر العمل: ${err?.message ?? 'خطأ اتصال'}`);
    } finally {
      setCreatingWos(null);
    }
  }, [activePipeline]);

  return {
    loading,
    forecasts,
    selected,
    setSelected,
    triggering,
    triggerMessage,
    creatingWos,
    woMessage,
    mapFocusMessage,
    locatingSegId,
    activePipeline,
    f,
    a,
    score,
    alerts,
    withForecasts,
    withValidation,
    avgAccuracy,
    loadForecasts,
    triggerForecast,
    focusSegmentOnMap,
    downloadReport,
    printReport,
    createForecastWorkOrders,
  };
}

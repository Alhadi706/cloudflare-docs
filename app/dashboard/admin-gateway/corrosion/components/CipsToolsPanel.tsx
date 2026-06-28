'use client';

/**
 * CipsToolsPanel — CIPS/DCVG Survey File Tools
 *
 * Provides:
 *  1. Upload KMZ pipeline centerline for coordinate interpolation
 *  2. Analyse a new TXT file (preview CIPS columns + sample)
 *  3. Re-parse existing TXT sessions with the CIPS parser
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Download, FileText, Loader2, Map, RefreshCw, Upload,
  Zap, Info
} from 'lucide-react';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'x-staff-api-key': 'haoAJhwAboEQTsgXex1q4T-vQ7q3d6YOLjpNHqszA9A',
  };
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

interface CipsSampleRow {
  distance_m: number | null;
  absolute_chainage_m: number | null;
  chan1_v: number | null;
  chan1_mv: number | null;
  chan2_v: number | null;
  code: string;
  time: string;
}

interface CipsPreview {
  filename: string;
  is_cips: boolean;
  total_rows: number;
  raw_headers: string[];
  header_row_detected_at: number;
  metadata: Record<string, string>;
  suggested_start_chainage_m: number;
  sample_rows: CipsSampleRow[];
  warnings: string[];
  message_ar: string;
}

interface RouteGeometry {
  pipeline_id: string;
  total_length_m: number | null;
  start_chainage_m: number | null;
  notes: string | null;
  updated_at: string | null;
}

interface TxtSession {
  session_id: string;
  file_name: string;
  survey_date: string | null;
  total_points: number;
  start_distance: number | null;
  end_distance: number | null;
}

interface GpsSession {
  session_id: string;
  file_name: string;
  survey_date: string | null;
  total_points: number;
}

interface Props {
  selectedPipeline: string | null;
  pipelines: { pipeline_id: string; display_name?: string }[];
  onSelectPipeline: (pid: string) => void;
  /** TXT sessions for the selected pipeline */
  txtSessions?: TxtSession[];
  /** GPS/SVY sessions that can supply route geometry */
  gpsSessions?: GpsSession[];
  onSessionReparsed?: () => void;
}

export default function CipsToolsPanel({
  selectedPipeline,
  pipelines,
  onSelectPipeline,
  txtSessions = [],
  gpsSessions = [],
  onSessionReparsed,
}: Props) {
  // ── Section expand/collapse ──────────────────────────────────────────────
  const [expandGeom, setExpandGeom] = useState(true);
  const [expandPreview, setExpandPreview] = useState(true);
  const [expandReparse, setExpandReparse] = useState(true);

  // ── Route Geometry ───────────────────────────────────────────────────────
  const [routeGeom, setRouteGeom] = useState<RouteGeometry | null>(null);
  const [geomLoading, setGeomLoading] = useState(false);
  const [geomUploading, setGeomUploading] = useState(false);
  const [geomMsg, setGeomMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [startChainageInput, setStartChainageInput] = useState('0');
  const kmzInputRef = useRef<HTMLInputElement>(null);

  // ── GPS → Route Geometry ────────────────────────────────────────────────
  const [gpsFromSessionId, setGpsFromSessionId] = useState<string | null>(null);
  const [gpsFromMsg, setGpsFromMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleBuildFromGps = async (sessionId: string) => {
    if (!selectedPipeline) return;
    setGpsFromSessionId(sessionId);
    setGpsFromMsg(null);
    try {
      const url = `/api/v1/corrosion/cp-route-geometry-from-session/${encodeURIComponent(selectedPipeline)}`
        + `?source_session_id=${encodeURIComponent(sessionId)}&start_chainage_m=${encodeURIComponent(startChainageInput || '0')}`;
      const r = await fetch(url, { method: 'POST', headers: getHeaders() });
      const json = await r.json();
      if (!r.ok) throw new Error(json.detail || `HTTP ${r.status}`);
      setGpsFromMsg({ ok: true, text: json.message || 'تم بناء المسار بنجاح' });
      await fetchRouteGeom(selectedPipeline);
    } catch (e: unknown) {
      setGpsFromMsg({ ok: false, text: e instanceof Error ? e.message : 'خطأ غير معروف' });
    } finally {
      setGpsFromSessionId(null);
    }
  };

  const fetchRouteGeom = useCallback(async (pid: string) => {
    setGeomLoading(true);
    try {
      const r = await fetch(`/api/v1/corrosion/cp-route-geometry/${encodeURIComponent(pid)}`, { headers: getHeaders() });
      if (r.status === 404) { setRouteGeom(null); return; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRouteGeom(await r.json());
    } catch { setRouteGeom(null); }
    finally { setGeomLoading(false); }
  }, []);

  React.useEffect(() => {
    if (selectedPipeline) fetchRouteGeom(selectedPipeline);
    else setRouteGeom(null);
  }, [selectedPipeline, fetchRouteGeom]);

  const handleKmzUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPipeline) return;
    setGeomUploading(true);
    setGeomMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = `/api/v1/corrosion/cp-route-geometry/${encodeURIComponent(selectedPipeline)}`
        + `?start_chainage_m=${encodeURIComponent(startChainageInput || '0')}`;
      const r = await fetch(url, { method: 'POST', headers: getHeaders(), body: fd });
      const json = await r.json();
      if (!r.ok) throw new Error(json.detail || `HTTP ${r.status}`);
      setGeomMsg({ ok: true, text: json.message || 'تم الحفظ بنجاح' });
      await fetchRouteGeom(selectedPipeline);
    } catch (e: unknown) {
      setGeomMsg({ ok: false, text: e instanceof Error ? e.message : 'خطأ غير معروف' });
    } finally {
      setGeomUploading(false);
      if (kmzInputRef.current) kmzInputRef.current.value = '';
    }
  };

  // ── CIPS Preview ─────────────────────────────────────────────────────────
  const [preview, setPreview] = useState<CipsPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewMsg, setPreviewMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const txtPreviewRef = useRef<HTMLInputElement>(null);

  const handlePreviewUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewLoading(true);
    setPreviewMsg(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      let url = '/api/v1/corrosion/cp-analyse-cips';
      if (selectedPipeline) url += `?pipeline_id=${encodeURIComponent(selectedPipeline)}&start_chainage_m=${encodeURIComponent(startChainageInput || '0')}`;
      const r = await fetch(url, { method: 'POST', headers: getHeaders(), body: fd });
      const json = await r.json();
      if (!r.ok) throw new Error(json.detail || `HTTP ${r.status}`);
      setPreview(json);
    } catch (e: unknown) {
      setPreviewMsg({ ok: false, text: e instanceof Error ? e.message : 'فشل التحليل' });
    } finally {
      setPreviewLoading(false);
      if (txtPreviewRef.current) txtPreviewRef.current.value = '';
    }
  };

  // ── Re-parse ─────────────────────────────────────────────────────────────
  const [reparsingId, setReparsingId] = useState<string | null>(null);
  const [reparseResults, setReparseResults] = useState<Record<string, { ok: boolean; text: string }>>({});

  const handleReparse = async (sessionId: string, startChainage?: number) => {
    setReparsingId(sessionId);
    try {
      let url = `/api/v1/corrosion/cp-reparse-txt/${sessionId}`;
      if (startChainage != null) url += `?start_chainage_m=${startChainage}`;
      else if (startChainageInput) url += `?start_chainage_m=${encodeURIComponent(startChainageInput)}`;
      const r = await fetch(url, { method: 'POST', headers: getHeaders() });
      const json = await r.json();
      if (!r.ok) {
        const detail = json.detail;
        const msg = typeof detail === 'object' ? (detail.message || JSON.stringify(detail)) : (detail || `HTTP ${r.status}`);
        setReparseResults((prev) => ({ ...prev, [sessionId]: { ok: false, text: msg } }));
      } else {
        setReparseResults((prev) => ({
          ...prev,
          [sessionId]: { ok: true, text: `✓ ${json.inserted} نقطة — ${json.message}` },
        }));
        onSessionReparsed?.();
      }
    } catch (e: unknown) {
      setReparseResults((prev) => ({
        ...prev,
        [sessionId]: { ok: false, text: e instanceof Error ? e.message : 'خطأ' },
      }));
    } finally {
      setReparsingId(null);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  const pipelineSelector = (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm text-slate-400">الخط:</span>
      <select
        value={selectedPipeline || ''}
        onChange={(e) => onSelectPipeline(e.target.value)}
        className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm"
      >
        <option value="" disabled>اختر خطًا...</option>
        {pipelines.map((p) => (
          <option key={p.pipeline_id} value={p.pipeline_id}>
            {p.display_name ?? p.pipeline_id}
          </option>
        ))}
      </select>
      {selectedPipeline && (
        <span className="font-mono text-xs text-slate-500">{selectedPipeline}</span>
      )}
    </div>
  );

  return (
    <div className="space-y-5 pb-10" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
          <Zap className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">أدوات CIPS / DCVG</h2>
          <p className="text-xs text-slate-400">
            معالجة ملفات مسح الحماية الكاثودية بتنسيق WinCAPS (Tab-Separated + Distance + Chan1(V))
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex gap-2 p-3 bg-blue-900/20 border border-blue-500/20 rounded-xl text-xs text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          <strong>بروتوكول التحليل:</strong> الملفات tab-separated، skiprows=5، عمود <code className="bg-blue-900/30 px-1 rounded">Distance</code> = موقع الأنبوب،
          عمود <code className="bg-blue-900/30 px-1 rounded">Chan1(V)</code> = قراءة الجهد (فولت)،
          عمود <code className="bg-blue-900/30 px-1 rounded">Code</code> = المعالم الهندسية.
          الإحداثيات تُستنتج من هندسة الخط عبر PostGIS ST_LineInterpolatePoint.
        </div>
      </div>

      {pipelineSelector}

      {/* ══ SECTION 1: Route Geometry ═══════════════════════════════════════ */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center gap-2 p-4 text-sm font-semibold text-slate-200 hover:bg-slate-700/30 transition-all"
          onClick={() => setExpandGeom((v) => !v)}
        >
          <Map className="w-4 h-4 text-cyan-400" />
          هندسة مسار الخط (KMZ Centerline)
          {expandGeom ? <ChevronUp className="w-4 h-4 mr-auto text-slate-500" /> : <ChevronDown className="w-4 h-4 mr-auto text-slate-500" />}
        </button>

        {expandGeom && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
            <p className="text-xs text-slate-400">
              ارفع ملف KMZ/KML لمسار الخط لربط قراءات الـ CIPS بإحداثيات جغرافية حقيقية عبر PostGIS.
              بعد الرفع، تُستخدم هذه الهندسة تلقائيًا عند إعادة التحليل.
            </p>

            {routeGeom ? (
              <div className="flex items-center gap-3 p-3 bg-green-900/20 border border-green-500/20 rounded-lg text-xs text-green-300">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <div>
                  <div className="font-semibold">هندسة مخزَّنة</div>
                  <div className="text-green-400/70 mt-0.5">
                    الطول: {routeGeom.total_length_m ? `${Math.round(routeGeom.total_length_m).toLocaleString()} م` : '—'} |
                    بداية الكيلومتراج: {routeGeom.start_chainage_m ?? 0} م |
                    آخر تحديث: {routeGeom.updated_at ? new Date(routeGeom.updated_at).toLocaleDateString('ar') : '—'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg text-xs text-slate-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-yellow-400" />
                لا توجد هندسة مخزَّنة — الإحداثيات ستكون فارغة حتى يُرفع ملف KMZ.
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">كيلومتراج نقطة البداية (م)</label>
                <input
                  type="number"
                  value={startChainageInput}
                  onChange={(e) => setStartChainageInput(e.target.value)}
                  placeholder="مثال: 84850"
                  className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-3 py-1.5 text-sm w-40"
                />
              </div>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm cursor-pointer transition-all border
                ${geomUploading
                  ? 'bg-slate-700/50 border-slate-600 text-slate-500 cursor-not-allowed'
                  : 'bg-cyan-600/20 hover:bg-cyan-600/30 border-cyan-500/40 text-cyan-300'}`}>
                {geomUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                رفع KMZ / KML
                <input
                  ref={kmzInputRef}
                  type="file"
                  accept=".kmz,.kml"
                  className="hidden"
                  disabled={!selectedPipeline || geomUploading}
                  onChange={handleKmzUpload}
                />
              </label>
              {geomLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>

            {geomMsg && (
              <div className={`flex items-center gap-2 p-2 rounded text-xs ${geomMsg.ok ? 'bg-green-900/20 text-green-300' : 'bg-red-900/20 text-red-300'}`}>
                {geomMsg.ok ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {geomMsg.text}
              </div>
            )}

            {/* ── GPS Sessions (SVY) ───────────────────────────────────── */}
            {gpsSessions.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Map className="w-3 h-3 text-emerald-400" />
                  أو استخرج المسار من ملف GPS مخزَّن (SVY)
                </div>
                {gpsSessions.map((gs) => {
                  const isBusy = gpsFromSessionId === gs.session_id;
                  return (
                    <div key={gs.session_id} className="flex items-center gap-3 p-3 bg-slate-900/40 border border-emerald-700/30 rounded-xl">
                      <Map className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200 truncate">{gs.file_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">
                          {gs.survey_date || 'تاريخ غير محدد'} | {gs.total_points} نقطة GPS
                        </div>
                      </div>
                      <button
                        onClick={() => handleBuildFromGps(gs.session_id)}
                        disabled={isBusy || !selectedPipeline}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/30 text-emerald-300 disabled:opacity-40"
                      >
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Map className="w-3 h-3" />}
                        استخدم كمسار جغرافي
                      </button>
                    </div>
                  );
                })}
                {gpsFromMsg && (
                  <div className={`flex items-center gap-2 p-2 rounded text-xs ${gpsFromMsg.ok ? 'bg-green-900/20 text-green-300' : 'bg-red-900/20 text-red-300'}`}>
                    {gpsFromMsg.ok ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {gpsFromMsg.text}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ SECTION 2: Preview TXT File ═══════════════════════════════════ */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center gap-2 p-4 text-sm font-semibold text-slate-200 hover:bg-slate-700/30 transition-all"
          onClick={() => setExpandPreview((v) => !v)}
        >
          <FileText className="w-4 h-4 text-purple-400" />
          تحليل ملف CIPS/DCVG جديد (معاينة)
          {expandPreview ? <ChevronUp className="w-4 h-4 mr-auto text-slate-500" /> : <ChevronDown className="w-4 h-4 mr-auto text-slate-500" />}
        </button>

        {expandPreview && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
            <p className="text-xs text-slate-400">
              اختر ملف TXT لمعاينة الأعمدة المكتشفة، البيانات الوصفية، وعينة من البيانات قبل الحفظ.
            </p>

            <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm cursor-pointer transition-all border
              ${previewLoading
                ? 'bg-slate-700/50 border-slate-600 text-slate-500 cursor-not-allowed'
                : 'bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/40 text-purple-300'}`}>
              {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              اختر ملف TXT للمعاينة
              <input
                ref={txtPreviewRef}
                type="file"
                accept=".txt,.data,.int,.fil"
                className="hidden"
                disabled={previewLoading}
                onChange={handlePreviewUpload}
              />
            </label>

            {previewMsg && (
              <div className="flex items-center gap-2 p-2 rounded text-xs bg-red-900/20 text-red-300">
                <AlertTriangle className="w-3 h-3" /> {previewMsg.text}
              </div>
            )}

            {preview && (
              <div className="space-y-3">
                {/* Status */}
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${preview.is_cips ? 'bg-green-900/20 border border-green-500/20 text-green-300' : 'bg-yellow-900/20 border border-yellow-500/20 text-yellow-300'}`}>
                  {preview.is_cips ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span className="font-semibold">{preview.message_ar}</span>
                  <span className="mr-auto text-xs opacity-70">{preview.filename}</span>
                </div>

                {/* Metadata */}
                {Object.keys(preview.metadata).length > 0 && (
                  <div className="bg-slate-900/40 rounded-lg p-3">
                    <div className="text-xs font-semibold text-slate-300 mb-2">البيانات الوصفية (Header)</div>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(preview.metadata).slice(0, 10).map(([k, v]) => (
                        <div key={k} className="text-xs text-slate-400">
                          <span className="text-slate-300">{k}:</span> {v}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detected columns */}
                <div className="flex flex-wrap gap-2">
                  {preview.raw_headers.map((h, i) => (
                    <span key={i} className={`text-xs px-2 py-1 rounded-full font-mono ${
                      h.toLowerCase().includes('distance') || h.toLowerCase().includes('dist')
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : h.toLowerCase().includes('chan1') || h.toLowerCase().includes('v)')
                          ? 'bg-green-500/20 text-green-300'
                          : h.toLowerCase() === 'code'
                            ? 'bg-orange-500/20 text-orange-300'
                            : 'bg-slate-700 text-slate-300'
                    }`}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Suggested start chainage */}
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="text-slate-400">الكيلومتراج المقترح لنقطة البداية:</span>
                  <span className="font-mono text-cyan-300 font-semibold">{preview.suggested_start_chainage_m.toLocaleString()} م</span>
                </div>

                {/* Sample rows table */}
                {preview.sample_rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-700/50">
                          <th className="px-2 py-1 text-right text-slate-300 border border-slate-700">مسافة الملف (م)</th>
                          <th className="px-2 py-1 text-right text-slate-300 border border-slate-700">كيلومتراج مطلق (م)</th>
                          <th className="px-2 py-1 text-right text-slate-300 border border-slate-700">Chan1 (V)</th>
                          <th className="px-2 py-1 text-right text-slate-300 border border-slate-700">Chan1 (mV)</th>
                          <th className="px-2 py-1 text-right text-slate-300 border border-slate-700">Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sample_rows.map((row, i) => {
                          const mv = row.chan1_mv;
                          const rowColor = mv === null ? '' : mv <= -850 ? 'text-green-400' : mv <= -700 ? 'text-yellow-400' : 'text-red-400';
                          return (
                            <tr key={i} className="hover:bg-slate-700/30">
                              <td className="px-2 py-0.5 border border-slate-700/50 text-slate-300 font-mono">{row.distance_m ?? '—'}</td>
                              <td className="px-2 py-0.5 border border-slate-700/50 text-slate-300 font-mono">{row.absolute_chainage_m?.toFixed(1) ?? '—'}</td>
                              <td className={`px-2 py-0.5 border border-slate-700/50 font-mono ${rowColor}`}>{row.chan1_v ?? '—'}</td>
                              <td className={`px-2 py-0.5 border border-slate-700/50 font-mono font-semibold ${rowColor}`}>{row.chan1_mv ?? '—'}</td>
                              <td className="px-2 py-0.5 border border-slate-700/50 text-orange-300 font-mono">{row.code || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="text-xs text-slate-500 mt-1">عرض أول {preview.sample_rows.length} سجل من {preview.total_rows} إجمالًا</div>
                  </div>
                )}

                {/* Warnings */}
                {preview.warnings.length > 0 && (
                  <div className="space-y-1">
                    {preview.warnings.map((w, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-yellow-300 bg-yellow-900/10 px-2 py-1 rounded">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ SECTION 3: Re-parse TXT Sessions ═════════════════════════════ */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
        <button
          className="w-full flex items-center gap-2 p-4 text-sm font-semibold text-slate-200 hover:bg-slate-700/30 transition-all"
          onClick={() => setExpandReparse((v) => !v)}
        >
          <RefreshCw className="w-4 h-4 text-orange-400" />
          إعادة تحليل جلسات TXT الموجودة
          {txtSessions.length > 0 && (
            <span className="mr-1 px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-xs">{txtSessions.length}</span>
          )}
          {expandReparse ? <ChevronUp className="w-4 h-4 mr-auto text-slate-500" /> : <ChevronDown className="w-4 h-4 mr-auto text-slate-500" />}
        </button>

        {expandReparse && (
          <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-3">
            <div className="flex items-start gap-2 p-3 bg-amber-900/20 border border-amber-500/20 rounded-lg text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>ملاحظة:</strong> إعادة التحليل تتطلب وجود محتوى الملف المخزَّن (raw_file_bytes).
                الجلسات المرفوعة <em>قبل</em> التحديث لا تحتوي على هذا المحتوى — يجب رفعها مجددًا
                من زر "رفع ملف" في تبويب الجلسات، ثم ستظهر هنا جاهزة للإعادة.
              </div>
            </div>

            {txtSessions.length === 0 ? (
              <div className="text-center text-sm text-slate-500 py-6">
                لا توجد جلسات TXT لهذا الخط
              </div>
            ) : (
              <div className="space-y-2">
                {txtSessions.map((session) => {
                  const result = reparseResults[session.session_id];
                  const isReparsing = reparsingId === session.session_id;
                  return (
                    <div
                      key={session.session_id}
                      className="flex items-center gap-3 p-3 bg-slate-900/40 border border-slate-700/50 rounded-xl"
                    >
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-200 truncate">{session.file_name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono">
                          {session.survey_date || 'تاريخ غير محدد'} |
                          {session.total_points} نقطة |
                          {session.start_distance != null ? ` من ${session.start_distance}م` : ' بدون كيلومتراج'}
                        </div>
                        {result && (
                          <div className={`text-xs mt-1 ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                            {result.text}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleReparse(session.session_id)}
                        disabled={isReparsing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/30 text-orange-300 disabled:opacity-40"
                      >
                        {isReparsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        إعادة التحليل
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

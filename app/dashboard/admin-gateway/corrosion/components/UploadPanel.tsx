'use client';
// SVY_BUILD=2026.04 ← cache-busting version marker
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, RefreshCw, CheckCircle, XCircle,
  Activity, TrendingDown, Calendar, FileText, AlertTriangle, Sparkles, Shield, Map,
} from 'lucide-react';
import { StatBox } from './SmallHelpers';
import { API } from '../constants';
import { SvyMapPanel, detectSpatialMode } from './SvyMapPanel';
import { SvyAnalysisPanel } from './SvyAnalysisPanel';
import { useGisEngine } from '@/store/gisEngine';

type UploadMeta = {
  pipelineId: string;
  surveyDate: string;
  detectedYear: string | null;
  routeKey: string;
  inferredPipeline: boolean;
  inferredSurveyDate: boolean;
};

function slugifyRoutePart(value: string): string {
  return value
    .replace(/\+/g, '_plus_')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function inferUploadMeta(fileName: string, manualPipeline: string, manualSurveyDate: string): UploadMeta {
  const rawName = fileName.replace(/\.[^.]+$/, '').trim();
  const lower = rawName.toLowerCase();

  const yearMatch = lower.match(/(?:^|[^\d])(19\d{2}|20\d{2})(?:[^\d]|$)(?!.*(?:19\d{2}|20\d{2}))/);
  const detectedYear = yearMatch?.[1] ?? null;

  const chainageMatch = rawName.match(/(\d{1,4})\s*(?:\+|\s)\s*(\d{2,4})/);
  const chainageKey = chainageMatch ? `${Number(chainageMatch[1])}+${Number(chainageMatch[2])}` : '';

  let routeStem = rawName;
  if (detectedYear) {
    routeStem = routeStem.replace(new RegExp(`(^|[^\\d])${detectedYear}([^\\d]|$)`, 'i'), ' ');
  }
  routeStem = routeStem
    .replace(/\b(?:mh|survey|on\s*off|on-off|onoff|cp|cips|dcvg)\b/gi, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const routeKey = chainageKey || routeStem || rawName;
  const inferredPipeline = manualPipeline.trim().length === 0;
  const inferredSurveyDate = manualSurveyDate.trim().length === 0 && Boolean(detectedYear);

  const pipelineId = inferredPipeline
    ? `CP_ROUTE_${slugifyRoutePart(routeKey)}`
    : manualPipeline.trim();

  const surveyDate = manualSurveyDate.trim() || (detectedYear ? `${detectedYear}-01-01` : '');

  return {
    pipelineId,
    surveyDate,
    detectedYear,
    routeKey,
    inferredPipeline,
    inferredSurveyDate,
  };
}

export function UploadPanel({ onSuccess }: { onSuccess: () => void }) {
  type PanelState = 'idle' | 'previewing' | 'cp_preview' | 'svy_result' | 'uploading' | 'mapping' | 'success' | 'error';
  const router = useRouter();
  const setSvyCpOverlay = useGisEngine(s => s.setSvyCpOverlay);
  const [state, setState] = useState<PanelState>('idle');
  const [result, setResult] = useState<any>(null);
  const [svyData, setSvyData] = useState<any>(null);
  const [svyFileName, setSvyFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cpPreview, setCpPreview] = useState<any>(null);
  const [mappingData, setMappingData] = useState<any>(null);
  const [userMapping, setUserMapping] = useState<Record<string, string>>({});
  const [pipelineInput, setPipelineInput] = useState('');
  const [surveyDateInput, setSurveyDateInput] = useState('');
  const [cpSystemInstalled, setCpSystemInstalled] = useState<'YES' | 'NO' | ''>('');
  const [cpInstallationYear, setCpInstallationYear] = useState('');
  const [savedSvySessionId, setSavedSvySessionId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const autoMetaPreview = pendingFile
    ? inferUploadMeta(pendingFile.name, pipelineInput, surveyDateInput)
    : null;

  const REQUIRED_LABELS: Record<string, string> = {
    asset_id: 'معرّف الأصل',
    degradation_type_code: 'نوع التدهور',
    measurement_value: 'القيمة',
    measurement_timestamp: 'التاريخ',
  };

  const doPreview = async (file: File) => {
    setState('previewing');
    setResult(null);
    setSvyData(null);
    setSavedSvySessionId(null);
    const form = new FormData();
    form.append('file', file);
    const inferred = inferUploadMeta(file.name, pipelineInput, surveyDateInput);
    if (inferred.pipelineId) form.append('pipeline_id', inferred.pipelineId);
    if (inferred.surveyDate) form.append('survey_date', inferred.surveyDate);

    // SVY files go directly to the upload endpoint (backend handles detection)
    const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (fileExt === 'svy') {
      setSvyFileName(file.name);
      setState('uploading');
      try {
        if (cpSystemInstalled) form.append('cp_system_installed', cpSystemInstalled);
        if (cpSystemInstalled === 'YES' && cpInstallationYear) form.append('cp_installation_year', cpInstallationYear);
        const r = await fetch(`${API}/upload`, { method: 'POST', body: form });
        const data = await r.json();
        if (r.ok && data.status === 'svy_parsed') {
          setSvyData(data);
          setState('svy_result');
          setPendingFile(file);
        } else if (!r.ok) {
          console.warn('[UploadPanel] SVY upload error status=' + r.status, data.detail ?? data);
          setState('error');
          setResult(data.detail ?? data);
        } else {
          setState('success');
          setResult(data);
          onSuccess();
        }
      } catch (e: any) {
        setState('error');
        setResult({ message: e.message });
      }
      return;
    }

    try {
      const r = await fetch(`${API}/cp-preview`, { method: 'POST', body: form });
      const data = await r.json();
      if (data.is_cp_survey) {
        setCpPreview(data);
        setPendingFile(file);
        setState('cp_preview');
      } else {
        await doUpload(file);
      }
    } catch {
      await doUpload(file);
    }
  };

  const confirmCpImport = async () => {
    if (!pendingFile) return;
    setState('uploading');
    const form = new FormData();
    form.append('file', pendingFile);
    form.append('force_cp', 'true');
    const inferred = inferUploadMeta(pendingFile.name, pipelineInput, surveyDateInput);
    if (inferred.pipelineId) form.append('pipeline_id', inferred.pipelineId);
    const surveyDate = inferred.surveyDate || cpPreview?.survey_date;
    if (surveyDate) form.append('survey_date', surveyDate);
    if (cpSystemInstalled) form.append('cp_system_installed', cpSystemInstalled);
    if (cpSystemInstalled === 'YES' && cpInstallationYear) form.append('cp_installation_year', cpInstallationYear);
    try {
      const r = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await r.json();
      if (r.ok) {
        setState('success');
        setResult(data);
        setPendingFile(null);
        setCpPreview(null);
        setSurveyDateInput('');
        onSuccess();
      } else {
        setState('error');
        setResult(data.detail ?? data);
      }
    } catch (e: any) {
      setState('error');
      setResult({ message: e.message });
    }
  };

  const doUpload = async (file: File, mapping?: Record<string, string>) => {
    setState('uploading');
    setResult(null);
    const form = new FormData();
    form.append('file', file);
    const inferred = inferUploadMeta(file.name, pipelineInput, surveyDateInput);
    if (inferred.pipelineId) form.append('pipeline_id', inferred.pipelineId);
    if (inferred.surveyDate) form.append('survey_date', inferred.surveyDate);
    if (cpSystemInstalled) form.append('cp_system_installed', cpSystemInstalled);
    if (cpSystemInstalled === 'YES' && cpInstallationYear) form.append('cp_installation_year', cpInstallationYear);
    if (mapping && Object.keys(mapping).length > 0) {
      form.append('user_mapping', JSON.stringify(mapping));
    }
    try {
      const r = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await r.json();
      if (r.ok) {
        setState('success');
        setResult(data);
        setPendingFile(null);
        setMappingData(null);
        setUserMapping({});
        onSuccess();
      } else if (r.status === 409 || data?.detail?.status === 'duplicate_session') {
        setState('error');
        setResult({ status: 'duplicate_session', message: 'جلسة مسح مكررة — هذا الملف محمّل مسبقاً في قاعدة البيانات' });
      } else if (r.status === 422 && data?.detail?.status === 'mapping_required') {
        setState('mapping');
        setMappingData(data.detail);
        setPendingFile(file);
        setUserMapping(data.detail.auto_mapped ?? {});
      } else if (r.status === 422 && (data?.detail?.status === 'unsupported_format' || data?.detail?.status?.startsWith('svy'))) {
        setState('error');
        setResult(data.detail);
      } else {
        setState('error');
        setResult(data.detail ?? data);
      }
    } catch (e: any) {
      setState('error');
      setResult({ message: e.message });
    }
  };

  const doBatchUpload = async (files: File[]) => {
    setState('uploading');
    setResult(null);
    setBatchProgress({ done: 0, total: files.length });

    const details: Array<{
      filename: string;
      status: 'success' | 'error';
      message: string;
      has_gps?: boolean;
      geo_bound?: boolean;
      file_format?: string;
    }> = [];
    let okCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const form = new FormData();
        form.append('file', file);
        const inferred = inferUploadMeta(file.name, pipelineInput, surveyDateInput);
        if (inferred.pipelineId) form.append('pipeline_id', inferred.pipelineId);
        if (inferred.surveyDate) form.append('survey_date', inferred.surveyDate);

        // For batch mode, save SVY directly as CP session.
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        if (ext === 'svy') form.append('save_as_session', 'true');

        const r = await fetch(`${API}/upload`, { method: 'POST', body: form });
        const data = await r.json().catch(() => ({}));

        if (r.ok) {
          okCount += 1;
          const hasGps = Boolean(data?.has_gps);
          const geoBound = Boolean(data?.geo_source_session_id);
          const geoTag = hasGps
            ? ' · GPS✓'
            : geoBound
            ? ' · مرتبطة جغرافياً'
            : '';
          details.push({
            filename: file.name,
            status: 'success',
            has_gps: hasGps,
            geo_bound: geoBound,
            file_format: ext.toUpperCase(),
            message: data?.status === 'cp_survey_inserted'
              ? `تم حفظ الجلسة (${inferred.pipelineId}${inferred.detectedYear ? ` · ${inferred.detectedYear}` : ''}${geoTag})`
              : `تمت المعالجة (${inferred.pipelineId}${inferred.detectedYear ? ` · ${inferred.detectedYear}` : ''}${geoTag})`,
          });
        } else if (r.status === 409 || data?.detail?.status === 'duplicate_session') {
          failCount += 1;
          details.push({
            filename: file.name,
            status: 'error',
            message: 'جلسة مسح مكررة — هذا الملف محمّل مسبقاً',
          });
        } else {
          failCount += 1;
          details.push({
            filename: file.name,
            status: 'error',
            message: data?.detail?.message ?? data?.message ?? data?.detail ?? 'فشل المعالجة',
          });
        }
      } catch (e: any) {
        failCount += 1;
        details.push({ filename: file.name, status: 'error', message: e.message ?? 'خطأ غير متوقع' });
      }
      setBatchProgress({ done: i + 1, total: files.length });
    }

    setBatchProgress(null);
    setState('success');
    setResult({
      batch: true,
      total_files: files.length,
      success_files: okCount,
      failed_files: failCount,
      details,
      status: failCount > 0 ? 'partial' : 'success',
    });
    onSuccess();
  };

  const saveSvyAsSession = async () => {
    if (!pendingFile) return;
    setState('uploading');
    setResult(null);

    const form = new FormData();
    form.append('file', pendingFile);
    form.append('save_as_session', 'true');
    const inferred = inferUploadMeta(pendingFile.name, pipelineInput, surveyDateInput);
    if (inferred.pipelineId) form.append('pipeline_id', inferred.pipelineId);
    if (inferred.surveyDate) form.append('survey_date', inferred.surveyDate);

    try {
      const r = await fetch(`${API}/upload`, { method: 'POST', body: form });
      const data = await r.json();
      if (r.ok && data.status === 'cp_survey_inserted') {
        setState('svy_result');
        setResult(data);
        setSavedSvySessionId(data.session_id ?? null);

        // ── Publish SVY features to main GIS map immediately ─────────────────
        // Primary source: normalized all_rows (when available)
        // Fallback source: gis_points FeatureCollection payload from parser
        const allRows: any[] = svyData?.all_rows ?? [];
        let gisFeatures = allRows
          .filter((r: any) => r.gps_lat != null && r.gps_lon != null)
          .map((r: any) => {
            const off = Number(r.off_mv);
            const status: 'PROTECTED' | 'MARGINAL' | 'UNPROTECTED' =
              off <= -850 ? 'PROTECTED' : off <= -700 ? 'MARGINAL' : 'UNPROTECTED';
            return {
              chainage_m: Number(r.chainage_m ?? 0),
              on_mv: Number(r.on_mv ?? 0),
              off_mv: off,
              gps_lat: Number(r.gps_lat),
              gps_lon: Number(r.gps_lon),
              is_off_below_850mv: Boolean(r.is_off_below_850mv),
              protection_status: status,
            };
          });

        if (gisFeatures.length === 0 && Array.isArray(svyData?.gis_points)) {
          gisFeatures = svyData.gis_points
            .map((f: any) => {
              const props = f?.properties ?? {};
              const coords = f?.geometry?.coordinates;
              const lon = Array.isArray(coords) ? Number(coords[0]) : NaN;
              const lat = Array.isArray(coords) ? Number(coords[1]) : NaN;
              const off = Number(props.off_mv ?? props.off ?? props.off_potential_mv ?? NaN);
              const on = Number(props.on_mv ?? props.on ?? props.on_potential_mv ?? 0);
              if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(off)) return null;
              const status: 'PROTECTED' | 'MARGINAL' | 'UNPROTECTED' =
                off <= -850 ? 'PROTECTED' : off <= -700 ? 'MARGINAL' : 'UNPROTECTED';
              return {
                chainage_m: Number(props.chainage_m ?? props.distance_m ?? 0),
                on_mv: on,
                off_mv: off,
                gps_lat: lat,
                gps_lon: lon,
                is_off_below_850mv: off <= -850,
                protection_status: status,
              };
            })
            .filter(Boolean);
        }

        if (gisFeatures.length > 0) {
          setSvyCpOverlay({
            sessionId: data.session_id ?? null,
            filename: svyData?.filename ?? '',
            pipelineId: inferred.pipelineId || null,
            surveyDate: inferred.surveyDate || null,
            features: gisFeatures,
          });
        }

        // Save a GIS snapshot immediately after successful session save.
        if (svyData?.gis_points?.length > 0) {
          const geojson = {
            type: 'FeatureCollection',
            source: 'svy_upload_snapshot',
            session_id: data.session_id ?? null,
            pipeline_id: inferred.pipelineId || null,
            survey_date: inferred.surveyDate || null,
            features: svyData.gis_points,
          };
          const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${(svyData.filename ?? 'svy_session').replace(/\.svy$/i, '')}_${data.session_id ?? 'saved'}.geojson`;
          a.click();
        }

        setPendingFile(null);
        onSuccess();
      } else {
        setState('error');
        setResult(data.detail ?? data);
      }
    } catch (e: any) {
      setState('error');
      setResult({ message: e.message });
    }
  };

  const handleFiles = (files: File[]) => {
    if (!files.length) return;
    if (files.length === 1) {
      doPreview(files[0]);
      return;
    }
    doBatchUpload(files);
  };

  const confirmMapping = () => {
    if (!pendingFile) return;
    const missing = Object.keys(REQUIRED_LABELS).filter(k => !userMapping[k]);
    if (missing.length > 0) return;
    doUpload(pendingFile, userMapping);
  };

  const isActive = state === 'uploading' || state === 'previewing';
  const showDropZone = state !== 'mapping' && state !== 'cp_preview' && state !== 'svy_result';

  return (
    <div className="space-y-4">

      {/* ── SVY FRONTEND ACCEPT ACTIVE — proof banner (only in new build) ── */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
        <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-xs font-bold text-emerald-300 tracking-wide">SVY FRONTEND ACCEPT ACTIVE</span>
        <span className="text-xs text-emerald-400/60 ml-1">v2026.04 · يقبل .svy مباشرةً بدون حظر</span>
        {svyFileName && (
          <span className="mr-auto text-xs font-mono bg-emerald-900/50 border border-emerald-500/40 px-2 py-0.5 rounded text-emerald-300">
            ✓ {svyFileName}
          </span>
        )}
      </div>

      {/* Session metadata inputs */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">بيانات جلسة المسح — اختياري</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">معرف الخط (Pipeline ID)</label>
            <input
              type="text"
              value={pipelineInput}
              onChange={e => setPipelineInput(e.target.value)}
              placeholder="مثال: CENTRAL-01"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
              disabled={isActive}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">تاريخ المسح (يتجاوز الكشف التلقائي)</label>
            <input
              type="date"
              value={surveyDateInput}
              onChange={e => setSurveyDateInput(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
              disabled={isActive}
            />
          </div>
          {/* CP System Status */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">هل يوجد نظام حماية كاثودية مثبّت؟</label>
            <select
              value={cpSystemInstalled}
              onChange={e => { setCpSystemInstalled(e.target.value as 'YES' | 'NO' | ''); if (e.target.value !== 'YES') setCpInstallationYear(''); }}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
              disabled={isActive}
            >
              <option value="">— غير محدد</option>
              <option value="YES">✓ محمي — يوجد نظام CP</option>
              <option value="NO">✗ غير محمي — لا يوجد نظام CP</option>
            </select>
          </div>
          {cpSystemInstalled === 'YES' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">سنة تركيب نظام CP (اختياري)</label>
              <input
                type="number"
                value={cpInstallationYear}
                onChange={e => setCpInstallationYear(e.target.value)}
                placeholder="مثال: 2010"
                min={1950}
                max={2100}
                className="w-full bg-slate-800 border border-green-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-green-500 transition-colors"
                disabled={isActive}
              />
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">هذه البيانات اختيارية — يكتشف النظام تاريخ المسح تلقائياً من بيانات الملف</p>
        <p className="text-xs text-cyan-400/90 mt-1">
          عند ترك الحقول فارغة: يتم توليد معرف مسار موحّد تلقائياً من اسم الملف، واستخراج السنة (مثل 2003/2010/2024) وربط الملفات التاريخية لنفس المسار.
        </p>
        {autoMetaPreview && (
          <div className="mt-3 rounded-xl border border-cyan-500/30 bg-cyan-900/10 px-3 py-2 text-xs text-cyan-200">
            <span className="font-semibold">اقتراح الربط للملف الحالي:</span>{' '}
            المسار = <span className="font-mono">{autoMetaPreview.pipelineId}</span>
            {autoMetaPreview.detectedYear ? (
              <>
                {' '}| السنة = <span className="font-mono">{autoMetaPreview.detectedYear}</span>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Drop zone */}
      {state !== 'mapping' && state !== 'cp_preview' && state !== 'svy_result' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            const dropped = Array.from(e.dataTransfer.files ?? []);
            if (dropped.length) handleFiles(dropped);
          }}
          onClick={() => !isActive && fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-orange-400 bg-orange-500/10'
              : 'border-slate-700 bg-slate-900/50 hover:border-orange-500/50 hover:bg-orange-500/5'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".csv,.xls,.xlsx,.svy,.txt,.data,.int,.fil"
            className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) handleFiles(files);
            }}
          />
          {isActive ? (
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-12 h-12 text-orange-400 animate-spin" />
              <p className="text-lg text-slate-300">
                {state === 'previewing' ? 'جاري تحليل نوع الملف…' : 'جاري إدخال البيانات…'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-12 h-12 text-slate-600" />
              <p className="text-lg font-semibold text-slate-300">اسحب الملف هنا أو انقر للتصفح</p>
              <p className="text-sm text-slate-500">يدعم رفع ملف واحد أو عدة ملفات دفعة واحدة — CSV / XLS / XLSX / SVY / TXT / DATA / INT / FIL</p>
            </div>
          )}
        </div>
      )}

      {batchProgress && (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-4 text-sm text-slate-300">
          جاري معالجة الدفعة: {batchProgress.done} / {batchProgress.total}
        </div>
      )}

      {/* CP Survey Auto-Detection Panel */}
      {state === 'cp_preview' && cpPreview && (
        <div className="bg-gradient-to-br from-blue-950/40 to-slate-900/60 border border-blue-500/40 rounded-2xl p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 shrink-0">
              <Activity className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-blue-200">تم التعرف على ملف مسح CP</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-900/40 border border-emerald-500/40 text-emerald-300">
                  ثقة {Math.round(cpPreview.confidence * 100)}%
                </span>
              </div>
              <p className="text-sm text-blue-300/70">{cpPreview.filename}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'نقاط المسح', value: cpPreview.total_points, icon: <Activity className="w-4 h-4 text-blue-400" /> },
              { label: 'نطاق المسافة', value: cpPreview.start_distance != null ? `${cpPreview.start_distance} → ${cpPreview.end_distance} م` : '—', icon: <TrendingDown className="w-4 h-4 text-orange-400" /> },
              { label: 'تاريخ المسح', value: cpPreview.survey_date ?? '—', icon: <Calendar className="w-4 h-4 text-emerald-400" /> },
              { label: 'صف الرأسية', value: cpPreview.detected_header_row != null ? `صف ${cpPreview.detected_header_row + 1}` : '—', icon: <FileText className="w-4 h-4 text-slate-400" /> },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/60 rounded-xl border border-slate-700 p-3">
                <div className="flex items-center gap-1.5 mb-1">{s.icon}<p className="text-xs text-slate-500">{s.label}</p></div>
                <p className="text-sm font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">السلاسل المكتشفة تلقائياً:</p>
            <div className="flex flex-wrap gap-2">
              {cpPreview.detected_fields.map((f: string) => {
                const FIELD_AR: Record<string,string> = {
                  distance: 'المسافة', natural_potential: 'الجهد الطبيعي',
                  as_found: 'As-Found', as_left: 'As-Left', shift: 'الإزاحة',
                  on_potential: 'ON', off_potential: 'OFF', instant_off: 'Inst-Off',
                  pipe_to_soil: 'Pipe-to-Soil', time: 'الوقت', status: 'الحالة', code: 'الكود'
                };
                return (
                  <span key={f} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-900/40 border border-blue-500/40 text-blue-300">
                    <CheckCircle className="w-3 h-3" />
                    {FIELD_AR[f] ?? f}
                  </span>
                );
              })}
            </div>
          </div>

          {cpPreview.sample_points?.filter((p: any) => p.distance != null).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">معاينة أول {cpPreview.sample_points.length} نقاط:</p>
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800/60 text-slate-400">
                      <th className="px-3 py-2 text-right">المسافة (م)</th>
                      <th className="px-3 py-2 text-right">الجهد الطبيعي (mV)</th>
                      <th className="px-3 py-2 text-right">As-Found (mV)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cpPreview.sample_points.map((p: any, i: number) => (
                      <tr key={i} className="border-t border-slate-800/50">
                        <td className="px-3 py-1.5 text-slate-300 font-mono">{p.distance ?? '—'}</td>
                        <td className="px-3 py-1.5 text-blue-300 font-mono">{p.natural_potential ?? '—'}</td>
                        <td className="px-3 py-1.5 text-orange-300 font-mono">{p.as_found ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={confirmCpImport}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-5 py-3 text-sm transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              تأكيد الاستيراد التلقائي
            </button>
            <button
              onClick={() => { setState('idle'); setCpPreview(null); setPendingFile(null); }}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl px-4 py-3 text-sm transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={() => { if (pendingFile) doUpload(pendingFile); setCpPreview(null); }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-xl px-4 py-3 text-sm transition-colors border border-slate-700"
            >
              ربط يدوي
            </button>
          </div>
        </div>
      )}

      {/* Column mapping fallback */}
      {state === 'mapping' && mappingData && (
        <div className="bg-amber-900/20 border border-amber-500/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3 mb-1">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h3 className="text-base font-bold text-amber-300">يلزم ربط الأعمدة يدوياً</h3>
              <p className="text-xs text-amber-400/70">لم يتعرف النظام تلقائياً على بعض الأعمدة — حدد التطابق من القائمة</p>
            </div>
          </div>

          {Object.keys(mappingData.auto_mapped ?? {}).length > 0 && (
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-xl px-3 py-2 text-xs">
              <p className="text-emerald-400 font-semibold mb-1">تم ربطها تلقائياً:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(mappingData.auto_mapped).map(([can, actual]) => (
                  <span key={can} className="bg-emerald-900/40 border border-emerald-700/40 rounded px-2 py-0.5 text-emerald-300">
                    {REQUIRED_LABELS[can] ?? can} → <span className="font-mono">{String(actual)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.keys(REQUIRED_LABELS).map(canonical => {
              const alreadyMapped = !!mappingData.auto_mapped?.[canonical];
              return (
                <div key={canonical} className={`rounded-xl border p-3 ${alreadyMapped ? 'border-emerald-700/30 opacity-50' : 'border-amber-600/40 bg-slate-900/40'}`}>
                  <label className="block text-xs font-semibold mb-1 text-slate-300">
                    {REQUIRED_LABELS[canonical]}
                    {!alreadyMapped && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {alreadyMapped ? (
                    <p className="text-xs font-mono text-emerald-400">{mappingData.auto_mapped[canonical]} ✓</p>
                  ) : (
                    <select
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-orange-500"
                      value={userMapping[canonical] ?? ''}
                      onChange={e => setUserMapping(prev => ({ ...prev, [canonical]: e.target.value }))}
                    >
                      <option value="">— اختر عمود —</option>
                      {mappingData.detected_columns.map((col: string) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={confirmMapping}
              disabled={Object.keys(REQUIRED_LABELS).some(k => !userMapping[k] && !mappingData.auto_mapped?.[k])}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors"
            >
              تأكيد الربط وإعادة الرفع
            </button>
            <button
              onClick={() => { setState('idle'); setMappingData(null); setPendingFile(null); setUserMapping({}); }}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl px-4 py-2.5 text-sm transition-colors"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* SVY File Result Panel */}
      {state === 'svy_result' && svyData && (
        <div className="space-y-4">
          {/* SVY BACKEND ROUTE ACTIVE proof badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-900/20 border border-emerald-500/30">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-emerald-300 tracking-wide">SVY BACKEND ROUTE ACTIVE</span>
            <span className="text-xs text-emerald-400/60 ml-1">— الباكند حلّل الملف وأعاد نتيجة منظّمة</span>
          </div>
          {/* Header */}
          <div className="bg-blue-950/40 border border-blue-500/40 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 shrink-0">
                <FileText className="w-7 h-7 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-lg font-bold text-blue-200">ملف مساحي — SVY</h3>
                  {svyData.gis_usable ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-900/40 border border-emerald-500/40 text-emerald-300">
                      ✓ يحتوي إحداثيات GIS
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-900/40 border border-amber-500/40 text-amber-300">
                      بدون إحداثيات مكتشفة
                    </span>
                  )}
                </div>
                <p className="text-sm text-blue-300/80">{svyData.message_ar}</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-400">
                  <span>📄 {svyData.filename}</span>
                  <span>·</span>
                  <span>{svyData.row_count} صف</span>
                  <span>·</span>
                  <span>{svyData.raw_headers?.length ?? 0} عمود</span>
                  {svyData.delimiter && <><span>·</span><span>فاصل: {svyData.delimiter}</span></>}
                </div>
              </div>
            </div>
          </div>

          {/* GIS summary */}
          {svyData.gis_usable && (
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-emerald-300">معلومات الإحداثيات المكتشفة — GIS</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700">
                  <p className="text-xl font-bold text-white">{svyData.gis_points?.length ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-0.5">نقطة جيوديسية</p>
                </div>
                <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700">
                  <p className="text-xl font-bold text-emerald-400">{svyData.coord_fields?.x ?? '—'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">عمود X / Easting</p>
                </div>
                <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700">
                  <p className="text-xl font-bold text-cyan-400">{svyData.coord_fields?.y ?? '—'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">عمود Y / Northing</p>
                </div>
                <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-700">
                  <p className="text-sm font-semibold text-slate-300 truncate" title={svyData.crs_guess ?? ''}>{svyData.crs_guess ?? 'غير محدد'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">نظام الإحداثيات</p>
                </div>
              </div>
              {svyData.crs_guess === 'unknown — please confirm CRS' && (
                <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-500/30 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300">
                    لم يتمكن النظام من تحديد نظام الإحداثيات تلقائياً — يُرجى تأكيد CRS (مثال: WGS84 / UTM Zone 33N) قبل الاستخدام في GIS.
                  </p>
                </div>
              )}
              {/* Export GeoJSON */}
              <button
                onClick={() => {
                  const geojson = {
                    type: 'FeatureCollection',
                    crs_note: svyData.crs_guess ?? 'unknown',
                    features: svyData.gis_points,
                  };
                  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `${svyData.filename?.replace('.svy', '') ?? 'svy_export'}.geojson`;
                  a.click();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-900/30 hover:bg-blue-900/50 border border-blue-500/40 text-sm text-blue-300 transition-colors"
              >
                <Sparkles className="w-4 h-4" /> تصدير كـ GeoJSON
              </button>
            </div>
          )}

          {/* Detected columns */}
          {svyData.raw_headers?.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
              <h4 className="text-sm font-bold text-slate-300 mb-3">الأعمدة المكتشفة</h4>
              <div className="flex flex-wrap gap-2">
                {svyData.raw_headers.map((h: string) => {
                  const semanticKey = Object.entries(svyData.coord_fields ?? {}).find(([, v]) => v === h)?.[0];
                  return (
                    <span key={h} className={`px-2.5 py-1 rounded-lg text-xs font-mono border ${
                      semanticKey
                        ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      {h}{semanticKey ? ` (${semanticKey})` : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sample rows */}
          {svyData.sample_rows?.length > 0 && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800">
                <h4 className="text-sm font-bold text-slate-300">عينة من البيانات (أول {svyData.sample_rows.length} صفوف)</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800/60">
                      {svyData.raw_headers?.slice(0, 8).map((h: string) => (
                        <th key={h} className="px-3 py-2 text-slate-400 font-semibold text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {svyData.sample_rows.slice(0, 8).map((row: Record<string, string>, i: number) => (
                      <tr key={i} className="hover:bg-slate-800/20">
                        {svyData.raw_headers?.slice(0, 8).map((h: string) => (
                          <td key={h} className="px-3 py-2 text-slate-300 font-mono">{row[h] ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recommended next action */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4 flex items-start gap-3">
            <Activity className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-slate-200 mb-0.5">الخطوة التالية</p>
              <p className="text-sm text-slate-400">{svyData.recommended_next}</p>
            </div>
          </div>

          {savedSvySessionId && (
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-4">
              <p className="text-sm font-semibold text-emerald-300">تم حفظ جلسة SVY بنجاح</p>
              <p className="text-xs text-emerald-400/80 mt-1 font-mono">session_id: {savedSvySessionId}</p>
              <p className="text-xs text-emerald-400/70 mt-1">تم حفظ ملف الخريطة GeoJSON تلقائياً مع عملية الحفظ.</p>
              <button
                onClick={() => router.push('/dashboard/gis-sovereignty/engineering-workspace')}
                className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/40 text-sm text-blue-300 transition-colors"
              >
                <Map className="w-4 h-4" /> عرض على الخريطة الرئيسية
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={saveSvyAsSession}
              disabled={!pendingFile || isActive || !!savedSvySessionId}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/40 text-sm text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" /> {savedSvySessionId ? 'تم حفظ الجلسة' : 'حفظ كجلسة مسح CP'}
            </button>
            <button
              onClick={() => { setState('idle'); setSvyData(null); setResult(null); setPendingFile(null); setSavedSvySessionId(null); }}
              className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-colors"
            >
              إلغاء والرجوع للرفع
            </button>
          </div>

          {/* ── NACE SP0169 Analysis Panel (chart + linked map + anomalies) ── */}
          {svyData?.all_rows?.length > 0 ? (
            <SvyAnalysisPanel svyData={svyData} />
          ) : (
            <SvyMapPanel
              svyData={svyData}
              spatialMode={detectSpatialMode(svyData)}
            />
          )}

          <button
            onClick={() => { setState('idle'); setSvyData(null); setResult(null); setSavedSvySessionId(null); }}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm transition-colors"
          >
            رفع ملف آخر
          </button>
        </div>
      )}

      {/* Success card */}
      {state === 'success' && result && (
        <div className={`border rounded-2xl p-5 ${result.status === 'cp_survey_inserted' ? 'bg-blue-900/20 border-blue-500/40' : 'bg-emerald-900/20 border-emerald-500/40'}`}>
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className={`w-6 h-6 shrink-0 ${result.status === 'cp_survey_inserted' ? 'text-blue-400' : 'text-emerald-400'}`} />
            <h3 className={`text-base font-bold ${result.status === 'cp_survey_inserted' ? 'text-blue-200' : 'text-emerald-300'}`}>
              {result.batch
                ? 'تمت معالجة الدفعة'
                : result.status === 'cp_survey_inserted'
                ? 'تم استيراد مسح CP بنجاح'
                : 'تم الرفع بنجاح'}
            </h3>
          </div>

          {result.cleaning_report?.was_cleaned && (
            <div className="flex items-start gap-2 mb-3 bg-blue-900/20 border border-blue-500/30 rounded-xl px-3 py-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-300">
                <span className="font-semibold">تم تنظيف الملف تلقائياً — </span>
                تم اكتشاف رأس الجدول في السطر {(result.cleaning_report.detected_header_row ?? 0) + 1}
                {result.cleaning_report.rows_cleaned != null && <span> · {result.cleaning_report.rows_cleaned} صف مقبول</span>}
              </p>
            </div>
          )}

          {!result.batch ? (
            <div className="grid grid-cols-3 gap-3 mb-3">
              <StatBox label="إجمالي السطور" value={result.total_rows ?? 0} color="text-white" />
              <StatBox label="نقاط مُدخلة" value={result.inserted ?? 0} color="text-emerald-400" />
              <StatBox label="تم تخطيه" value={result.skipped ?? 0} color="text-amber-400" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 mb-1">
                <StatBox label="ملفات الدفعة" value={result.total_files ?? 0} color="text-white" />
                <StatBox label="نجح" value={result.success_files ?? 0} color="text-emerald-400" />
                <StatBox label="فشل" value={result.failed_files ?? 0} color="text-red-400" />
              </div>
              <div className="max-h-52 overflow-auto rounded-xl border border-slate-700/60 bg-slate-900/40">
                {(result.details ?? []).map((item: any, idx: number) => (
                  <div key={`${item.filename}-${idx}`} className="px-3 py-2 text-xs border-b border-slate-800/60 last:border-b-0 flex items-center gap-2 flex-wrap">
                    <span className={item.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>{item.status === 'success' ? '✓' : '✗'}</span>
                    {item.file_format && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 font-mono text-[10px]">{item.file_format}</span>
                    )}
                    {item.has_gps && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-semibold">GPS</span>
                    )}
                    {item.geo_bound && !item.has_gps && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 text-[10px]">مرتبطة جغرافياً</span>
                    )}
                    <span className="text-slate-200 truncate max-w-[180px]">{item.filename}</span>
                    <span className="text-slate-500">— {item.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setState('idle'); setResult(null); }}
            className="mt-3 text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
          >
            رفع ملف آخر
          </button>
        </div>
      )}

      {/* Error card */}
      {state === 'error' && result && (
        <div className={`border rounded-2xl p-5 ${
          result.status?.startsWith('svy') ? 'bg-amber-900/20 border-amber-500/40' : 'bg-red-900/20 border-red-500/40'
        }`}>
          {result.status?.startsWith('svy') && (
            <div className="flex items-center gap-2 mb-3 px-2 py-1 rounded-lg bg-emerald-900/20 border border-emerald-500/20 w-fit">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300">SVY BACKEND ROUTE ACTIVE</span>
              <span className="text-xs text-emerald-400/60">— الباكند استقبل الملف</span>
            </div>
          )}
          <div className="flex items-start gap-3">
            {result.status?.startsWith('svy') ? (
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <h3 className={`text-base font-bold mb-1 ${
                result.status?.startsWith('svy') ? 'text-amber-300' : 'text-red-300'
              }`}>
                {result.status === 'svy_binary_detected'
                  ? 'ملف SVY ثنائي — غير قابل للقراءة المباشرة'
                  : result.status === 'svy_unknown'
                  ? 'ملف SVY غير معروف التنسيق'
                  : result.status === 'duplicate_session'
                  ? 'جلسة مسح مكررة'
                  : result.status === 'unsupported_format'
                  ? 'صيغة الملف غير مدعومة'
                  : 'فشل الرفع'}
              </h3>
              <p className={`text-sm mb-2 ${
                result.status?.startsWith('svy') ? 'text-amber-400/80' : 'text-red-400/80'
              }`}>
                {result.message_ar ?? result.message ?? result.detail ?? JSON.stringify(result)}
              </p>
              {result.status?.startsWith('svy') && (
                <>
                  {result.action_ar && (
                    <p className="text-xs text-slate-300 mb-2">{result.action_ar}</p>
                  )}
                  {result.recommended_export_formats && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs text-slate-400">صيغ التصدير الموصى بها:</span>
                      {result.recommended_export_formats.map((f: string) => (
                        <span key={f} className="px-2 py-0.5 rounded-lg text-xs font-mono bg-slate-800 border border-slate-700 text-slate-300">{f}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
              <button
                onClick={() => { setState('idle'); setResult(null); setSvyFileName(null); }}
                className="mt-3 text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
              >
                رفع ملف آخر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Format guide */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-5">
        <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-400" />
          تنسيق ملف مسح الحماية الكاثودية
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'الحد الآمن NACE', value: '−850 mV', desc: 'NACE SP0169 — حماية كاثودية كاملة', color: 'text-emerald-400', bg: 'bg-emerald-900/20 border-emerald-500/20' },
            { label: 'الصيغ المقبولة', value: 'XLS · XLSX · CSV · SVY · TXT · DATA · INT · FIL', desc: '.txt/.data/.int/.fil غير منظم مدعوم عبر Regex + دعم SVY/GIS', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-500/20' },
            { label: 'الكشف التلقائي', value: 'ذكاء اصطناعي + Regex', desc: 'يتعرف تلقائياً على صفوف العنوان وأعمدة SVY وأنماط C065A/€ من النص الخام', color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-500/20' },
          ].map(item => (
            <div key={item.label} className={`rounded-xl border p-3 ${item.bg}`}>
              <p className={`text-sm font-bold ${item.color}`}>{item.label}: {item.value}</p>
              <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';
/**
 * LinearAssetImporter — LRS Batch Import UI
 * ════════════════════════════════════════════════════════════════
 * Appears in the Engineering Workspace as a panel/modal.
 * Workflow (3 steps, minimal clicks):
 *   1. Select the pipeline (principal asset / polyline from GIS)
 *   2. Upload CSV with equipment_code, name, type, distance_from_prev
 *   3. Click "وضع الأصول على الخريطة" → done
 *
 * The component calls:
 *   POST /api/v1/workspace/linear-assets/batch-place
 *   with { csvText, lineCoords, principalAssetId, principalAssetName }
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, FileText, MapPin, CheckCircle2, AlertTriangle,
  Loader2, ChevronDown, X, Info, ArrowLeft, Download,
} from 'lucide-react';

interface PrincipalAsset {
  id: string;
  name?: string;
  asset_name?: string;
  classification?: string | null;
  gis?: { coordinates?: { lon: number; lat: number } | null };
}

interface ImportResult {
  stats: {
    total: number;
    placed: number;
    failed: number;
    db_added: number;
    db_updated: number;
    gis_links_created: number;
    warnings: string[];
  };
  anchors_extracted: number;
  anchor_interval_m: number;
  preview: Array<{
    equipment_code: string;
    name: string;
    station_m: number;
    lat: number | null;
    lng: number | null;
    placed: boolean;
  }>;
}

function getTenantHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  const tenantCode = localStorage.getItem('tenant_code') || localStorage.getItem('active_tenant_code') || '';
  const tenantId = localStorage.getItem('tenant_id') || '';
  return {
    'Content-Type': 'application/json',
    ...(tenantCode ? { 'x-tenant-code': tenantCode } : {}),
    ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
  };
}

// Sample CSV template for download
const CSV_TEMPLATE = `equipment_code,name,type,distance_from_prev,invert_level,notes
V-001,صمام هواء 1,air_valve,0,52.3,على مفرق خط النهر
V-002,صمام هواء 2,air_valve,600,51.8,
V-003,صمام غسيل 1,washout,800,51.2,
P-001,محطة ضخ A,pump_station,1200,50.5,
V-004,صمام تحكم 1,control_valve,350,50.1,
`;

interface Props {
  principalAssets: PrincipalAsset[];
  /** GeoJSON features from Engineering Workspace layers */
  onImportComplete?: (result: ImportResult) => void;
  onClose?: () => void;
}

export default function LinearAssetImporter({ principalAssets, onImportComplete, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [csvText, setCsvText]     = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [anchorInterval, setAnchorInterval] = useState(500);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<ImportResult | null>(null);
  const [error, setError]         = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedAsset = principalAssets.find(a => a.id === selectedAssetId);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setCsvText((ev.target?.result as string) || '');
    reader.readAsText(file, 'utf-8');
  }, []);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'linear-assets-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!csvText || !selectedAssetId) { setError('اختر الخط وارفع الملف أولاً'); return; }

    setLoading(true); setError('');
    try {
      // We need the polyline coords from the principal asset's GIS data.
      // For now we pass [] and let the server use anchor points from the asset's geometry.
      // The engineering workspace can pass lineCoords from the selected layer.
      const res = await fetch('/api/v1/workspace/linear-assets/batch-place', {
        method: 'POST',
        headers: getTenantHeaders(),
        body: JSON.stringify({
          csvText,
          lineCoords: [], // Will be populated in Step 1 when line geometry is available
          principalAssetId: selectedAssetId,
          principalAssetName: selectedAsset?.name || selectedAsset?.asset_name || selectedAssetId,
          anchorIntervalMeters: anchorInterval,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'فشل الاستيراد');
      setResult(data as ImportResult);
      setStep(3);
      onImportComplete?.(data as ImportResult);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#080d1a] text-slate-100" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">استيراد أصول خطية (LRS)</p>
            <p className="text-[11px] text-slate-500">وضع 32,000 أصل على الخريطة من CSV</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-0 px-4 py-3 border-b border-slate-800/50 shrink-0">
        {[
          { n: 1, label: 'اختر الخط' },
          { n: 2, label: 'ارفع CSV' },
          { n: 3, label: 'النتيجة' },
        ].map(({ n, label }, i) => (
          <React.Fragment key={n}>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg ${
              step === n ? 'bg-cyan-500/15 text-cyan-300' :
              step > n ? 'text-emerald-400' : 'text-slate-600'
            }`}>
              <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                step > n ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' :
                step === n ? 'border-cyan-500/50 text-cyan-400' : 'border-slate-700 text-slate-600'
              }`}>
                {step > n ? '✓' : n}
              </span>
              {label}
            </div>
            {i < 2 && <div className="flex-1 h-px bg-slate-800 mx-1" />}
          </React.Fragment>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Step 1: Select pipeline */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-3">
              <p className="text-xs font-bold text-slate-300">الخط الهندسي (الأنبوب / المسار)</p>
              <p className="text-[11px] text-slate-500">
                اختر الأصل الهندسي الرئيسي الذي يمثل مسار الأنبوب (مرسوم في Engineering Workspace).
                سيُستخدم لاستخراج النقاط المرجعية تلقائياً.
              </p>

              {principalAssets.length === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-900/10 p-3 text-xs text-amber-300">
                  ⚠ لا توجد أصول هندسية — ارسم مسار الأنبوب في Engineering Workspace أولاً
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedAssetId}
                    onChange={e => setSelectedAssetId(e.target.value)}
                    className="w-full appearance-none bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2.5 pr-8 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">— اختر الأصل الهندسي —</option>
                    {principalAssets.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name || a.asset_name || a.id}
                        {a.classification ? ` · ${a.classification}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              )}

              {/* Anchor interval */}
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">
                  مسافة النقاط المرجعية: <strong className="text-slate-300">{anchorInterval}م</strong>
                </label>
                <input
                  type="range" min={100} max={2000} step={100}
                  value={anchorInterval}
                  onChange={e => setAnchorInterval(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>100م (دقة عالية)</span><span>2000م (أداء أفضل)</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!selectedAssetId}
              className="w-full py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-bold hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              التالي — رفع CSV ←
            </button>
          </div>
        )}

        {/* Step 2: Upload CSV */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Template download */}
            <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 p-3 flex items-start gap-3">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-slate-300 font-semibold">الأعمدة المطلوبة في CSV</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <code className="bg-slate-800 px-1 rounded text-cyan-300">equipment_code</code>,{' '}
                  <code className="bg-slate-800 px-1 rounded text-cyan-300">name</code>,{' '}
                  <code className="bg-slate-800 px-1 rounded text-cyan-300">type</code>,{' '}
                  <code className="bg-slate-800 px-1 rounded text-cyan-300">distance_from_prev</code> (بالمتر)
                </p>
                <button
                  onClick={downloadTemplate}
                  className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <Download className="w-3 h-3" /> تحميل نموذج CSV
                </button>
              </div>
            </div>

            {/* File drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                csvText
                  ? 'border-emerald-500/50 bg-emerald-900/10'
                  : 'border-slate-700 bg-slate-800/30 hover:border-cyan-500/40 hover:bg-cyan-900/5'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
              {csvText ? (
                <div className="space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-emerald-300">{csvFileName}</p>
                  <p className="text-[11px] text-slate-400">
                    {csvText.split('\n').filter(Boolean).length - 1} صف
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-400">اضغط لرفع ملف CSV</p>
                  <p className="text-[11px] text-slate-600">أو اسحب الملف هنا</p>
                </div>
              )}
            </div>

            {/* Selected pipeline summary */}
            {selectedAsset && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3 text-xs text-slate-300">
                <span className="text-cyan-400 font-semibold">الخط المختار:</span>{' '}
                {selectedAsset.name || selectedAsset.asset_name}
                {selectedAsset.classification ? ` — ${selectedAsset.classification}` : ''}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-900/20 border border-rose-500/30 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 text-slate-400 text-xs hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> رجوع
              </button>
              <button
                onClick={handleImport}
                disabled={!csvText || loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-bold hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الوضع على الخريطة...</>
                  : <><MapPin className="w-4 h-4" /> وضع الأصول على الخريطة</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && result && (
          <div className="space-y-4">
            {/* Success summary */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <p className="text-sm font-bold text-emerald-300">تم وضع الأصول على الخريطة</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'إجمالي الأصول',    val: result.stats.total,                color: 'text-slate-200' },
                  { label: 'تم تحديد موقعها',  val: result.stats.placed,               color: 'text-emerald-300' },
                  { label: 'أُضيف جديد',       val: result.stats.db_added,             color: 'text-cyan-300' },
                  { label: 'تم تحديثه',         val: result.stats.db_updated,           color: 'text-amber-300' },
                  { label: 'روابط GIS أُنشئت', val: result.stats.gis_links_created,    color: 'text-violet-300' },
                  { label: 'نقاط مرجعية',      val: result.anchors_extracted,          color: 'text-blue-300' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="rounded-lg bg-slate-800/60 px-3 py-2">
                    <p className="text-[10px] text-slate-500">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{val.toLocaleString('ar')}</p>
                  </div>
                ))}
              </div>

              {result.stats.failed > 0 && (
                <p className="text-[11px] text-amber-400">
                  ⚠ {result.stats.failed} أصل لم يتم تحديد موقعه (خارج نطاق الخط)
                </p>
              )}
            </div>

            {/* Warnings */}
            {result.stats.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-900/10 p-3 space-y-1">
                {result.stats.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-300">⚠ {w}</p>
                ))}
              </div>
            )}

            {/* Preview */}
            <div>
              <p className="text-[11px] text-slate-500 mb-2">عينة من الأصول المُوضوعة:</p>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead className="bg-slate-800/60">
                    <tr>
                      <th className="text-right px-3 py-2 text-slate-400 font-semibold">الرمز</th>
                      <th className="text-right px-3 py-2 text-slate-400 font-semibold">الاسم</th>
                      <th className="text-right px-3 py-2 text-slate-400 font-semibold">المحطة</th>
                      <th className="text-right px-3 py-2 text-slate-400 font-semibold">الوضع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.preview.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-slate-900/30' : ''}>
                        <td className="px-3 py-1.5 font-mono text-cyan-400">{row.equipment_code}</td>
                        <td className="px-3 py-1.5 text-slate-300 truncate max-w-[120px]">{row.name}</td>
                        <td className="px-3 py-1.5 text-slate-400">{(row.station_m / 1000).toFixed(2)} km</td>
                        <td className="px-3 py-1.5">
                          {row.placed
                            ? <span className="text-emerald-400">✓ {row.lat?.toFixed(4)}</span>
                            : <span className="text-amber-400">خارج الخط</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={() => { setStep(1); setResult(null); setCsvText(''); setCsvFileName(''); }}
              className="w-full py-2 rounded-xl border border-slate-700 text-slate-400 text-sm hover:bg-slate-800 transition-colors"
            >
              استيراد دفعة جديدة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

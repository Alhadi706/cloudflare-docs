'use client';
/**
 * WaterScannerPanel — ماسح الشذوذات المائية
 * نسخة محسّنة: مضمّنة (لا h-full)، قائمة أصول من DB، زر مسح الرسم
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Droplets, MapPin, Route, Search, RefreshCw, CheckCircle2,
  AlertTriangle, ChevronDown, ChevronRight, Database, X, Layers3,
} from 'lucide-react';

type ScanMode = 'polygon' | 'asset' | 'corridor';
type Severity = 'confirmed' | 'high' | 'medium' | 'low' | 'normal';

interface DBAsset {
  id: string;
  name: string;
  asset_type?: string;
  geom_type?: string;
  _geometry?: any; // raw GeoJSON geometry for direct use
}

interface ScanResult {
  ok: boolean;
  scan_name: string;
  mode: string;
  area_km2: number;
  overall_severity: Severity;
  overall_score: number;
  anomalies_count: number;
  anomalies: any[];
  interpretation: string;
  evidence: string[];
  raw_metrics: any;
  pixel_level: boolean;
  source: string;
  period: any;
  error?: string;
}

interface Props {
  drawnPolygon:   [number,number][] | null;
  onStartDraw:    () => void;
  onCancelDraw:   () => void;
  onClearDraw?:   () => void;
  isDrawing:      boolean;
  onResultReady?: (anomalies: any[]) => void;
  onFlyTo?:       (lon: number, lat: number) => void;
}

const SEV_CONFIG: Record<Severity, {color:string;bg:string;icon:string;label:string}> = {
  confirmed: { color:'text-red-300',    bg:'bg-red-500/15 border-red-500/30',     icon:'🔴', label:'تسرب مؤكد'      },
  high:      { color:'text-orange-300', bg:'bg-orange-500/15 border-orange-500/30',icon:'🟠', label:'احتمال عالٍ'   },
  medium:    { color:'text-amber-300',  bg:'bg-amber-500/15 border-amber-500/30',  icon:'🟡', label:'احتمال متوسط'  },
  low:       { color:'text-blue-300',   bg:'bg-blue-500/15 border-blue-500/30',    icon:'🔵', label:'احتمال منخفض'  },
  normal:    { color:'text-green-300',  bg:'bg-green-500/15 border-green-500/30',  icon:'✅', label:'لا شذوذ'       },
};

export default function WaterScannerPanel({
  drawnPolygon, onStartDraw, onCancelDraw, onClearDraw, isDrawing,
  onResultReady, onFlyTo,
}: Props) {
  const [collapsed,    setCollapsed]    = useState(false);
  const [scanMode,     setScanMode]     = useState<ScanMode>('polygon');
  const [selectedAsset,setSelectedAsset]= useState<DBAsset | null>(null);
  const [assetSearch,  setAssetSearch]  = useState('');
  const [assets,       setAssets]       = useState<DBAsset[]>([]);
  const [assetsLoading,setAssetsLoading]= useState(false);
  const [daysBack,     setDaysBack]     = useState(30);
  const [bufferM,      setBufferM]      = useState(500);
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<ScanResult | null>(null);
  const [showMetrics,  setShowMetrics]  = useState(false);

  // ── Load assets when switching to asset mode ────────────────────────────
  useEffect(() => {
    if (scanMode !== 'asset' || assets.length > 0) return;
    setAssetsLoading(true);
    const TENANT_ID = typeof window !== 'undefined'
      ? (window.localStorage.getItem('tenant_id') || 'aaaaaaaa-0000-4000-a000-000000000001')
      : 'aaaaaaaa-0000-4000-a000-000000000001';
    fetch(`/api/v1/satellite/registered-assets?limit=200&tenant_id=${TENANT_ID}`, {
      headers: { 'X-Tenant-ID': TENANT_ID },
    })
      .then(r => r.json())
      .then(d => {
        const list: DBAsset[] = (d.assets ?? []).map((a: any) => ({
          id:         a.id ?? '',
          name:       a.name ?? 'أصل',
          asset_type: a.asset_type ?? '',
          geom_type:  a.geom_type ?? a.geometry?.type ?? '',
          _geometry:  a.geometry ?? null,
        })).filter((a: DBAsset) => a.id);
        setAssets(list);
      })
      .catch(() => setAssets([]))
      .finally(() => setAssetsLoading(false));
  }, [scanMode, assets.length]);

  const filteredAssets = assets.filter(a =>
    !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
    (a.asset_type ?? '').toLowerCase().includes(assetSearch.toLowerCase())
  );

  const canScan =
    (scanMode === 'polygon'  && drawnPolygon && drawnPolygon.length >= 3) ||
    (scanMode === 'asset'    && selectedAsset !== null) ||
    (scanMode === 'corridor' && drawnPolygon && drawnPolygon.length >= 2);

  const runScan = useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const body: any = {
        mode:     scanMode === 'corridor' ? 'corridor' : scanMode,
        days_back: daysBack,
        buffer_m:  bufferM,
      };
      if (scanMode === 'polygon'  && drawnPolygon) body.polygon   = drawnPolygon;
      if (scanMode === 'corridor' && drawnPolygon) body.waypoints = drawnPolygon;
      if (scanMode === 'asset' && selectedAsset)   {
        body.asset_id = selectedAsset.id;
        body.name     = selectedAsset.name;
        // Pass geometry directly — avoids backend single-asset fetch (405)
        if (selectedAsset.geom_type) body.asset_geometry = selectedAsset._geometry;
      }

      const res  = await fetch('/api/v1/satellite/water-anomaly-scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: ScanResult = await res.json();
      setResult(data);

      if (onResultReady) {
        const sevColors: Record<Severity,string> = {
          confirmed:'#ef4444', high:'#f97316', medium:'#f59e0b', low:'#3b82f6', normal:'#22c55e',
        };
        onResultReady((data.anomalies ?? []).map(a => ({
          lon: a.lon, lat: a.lat,
          color:  sevColors[a.severity as Severity] ?? '#94a3b8',
          radius: a.severity === 'confirmed' ? 16 : a.severity === 'high' ? 12 : 10,
          label:  `💧 ${data.scan_name} — ${SEV_CONFIG[a.severity as Severity]?.label}`,
          tooltip: [`احتمال التسرب: ${SEV_CONFIG[a.severity as Severity]?.label} (${a.confidence_pct}%)`, ...(a.evidence ?? []).slice(0,3)].join('\n'),
          layerKey: 'water_scan',
        })));
      }
      if (onFlyTo && data.anomalies?.length > 0) onFlyTo(data.anomalies[0].lon, data.anomalies[0].lat);
    } catch (e: any) {
      setResult({ ok: false, error: e.message } as any);
    } finally {
      setLoading(false);
    }
  }, [scanMode, drawnPolygon, selectedAsset, daysBack, bufferM, onResultReady, onFlyTo]);

  const sev    = result?.overall_severity ?? 'normal';
  const sevCfg = SEV_CONFIG[sev];

  // ── Geom type badge ───────────────────────────────────────────────────
  const geomIcon = (t: string) =>
    t.includes('Line') ? '〰️' : t.includes('Polygon') ? '⬡' : t.includes('Point') ? '●' : '📍';

  return (
    <div className="border-t border-slate-800" dir="rtl">
      {/* ── Collapsible Header ──────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-l from-cyan-950/30 to-transparent hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Droplets size={13} className="text-cyan-400 shrink-0" />
          <span className="text-xs font-bold text-cyan-200">ماسح الشذوذات المائية</span>
          {result?.ok && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${sevCfg.bg} ${sevCfg.color}`}>
              {sevCfg.icon} {sevCfg.label}
            </span>
          )}
        </div>
        {collapsed
          ? <ChevronRight size={13} className="text-slate-500" />
          : <ChevronDown  size={13} className="text-slate-500" />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-3 bg-slate-900/30">
          <p className="text-[10px] text-slate-500">S2 NDWI + NDVI + NDMI + SAR — أي منطقة بليبيا</p>

          {/* ── Mode selector ─────────────────────────────────────── */}
          <div className="flex gap-1 bg-slate-800/60 rounded-lg p-0.5">
            {([
              { id:'polygon',  label:'🎨 ارسم' },
              { id:'asset',    label:'📦 أصل'  },
              { id:'corridor', label:'〰️ ممر'  },
            ] as const).map(m => (
              <button key={m.id} onClick={() => setScanMode(m.id)}
                className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                  scanMode===m.id ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* ── Polygon mode ──────────────────────────────────────── */}
          {scanMode === 'polygon' && (
            <>
              {!isDrawing && !drawnPolygon && (
                <button onClick={onStartDraw}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs flex items-center justify-center gap-2 font-medium">
                  <MapPin size={13} /> ارسم المنطقة على الخريطة
                </button>
              )}
              {isDrawing && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-xs text-cyan-300">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                    انقر على الخريطة — انقر مرتين للإنهاء
                  </div>
                  <button onClick={onCancelDraw}
                    className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs">إلغاء الرسم</button>
                </div>
              )}
              {drawnPolygon && !isDrawing && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span className="flex-1">منطقة جاهزة ({drawnPolygon.length} نقطة)</span>
                  <button
                    onClick={() => { onClearDraw?.(); setResult(null); }}
                    className="flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-rose-900/20 px-2 py-1 rounded border border-slate-700 hover:border-rose-700/40 transition-colors"
                    title="مسح المنطقة المرسومة"
                  >
                    <X size={9} />مسح
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Asset mode ────────────────────────────────────────── */}
          {scanMode === 'asset' && (
            <div className="space-y-2">
              {selectedAsset ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span className="flex-1 truncate">{selectedAsset.name}</span>
                  <button
                    onClick={() => setSelectedAsset(null)}
                    className="text-slate-400 hover:text-rose-400 p-0.5"
                    title="إلغاء الاختيار"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    value={assetSearch}
                    onChange={e => setAssetSearch(e.target.value)}
                    placeholder="ابحث عن أصل..."
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800/60">
                    {assetsLoading ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                        <RefreshCw size={12} className="animate-spin" />جاري التحميل...
                      </div>
                    ) : filteredAssets.length === 0 ? (
                      <p className="text-center text-xs text-slate-600 py-4">
                        {assets.length === 0 ? 'لا توجد أصول مسجلة' : 'لا نتائج'}
                      </p>
                    ) : filteredAssets.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAsset(a)}
                        className="w-full text-right flex items-center gap-2 px-3 py-2.5 hover:bg-cyan-900/20 border-b border-slate-700/30 last:border-0 transition-colors"
                      >
                        <span className="text-base leading-none shrink-0">{geomIcon(a.geom_type ?? '')}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-200 truncate font-medium">{a.name}</p>
                          {a.asset_type && <p className="text-[10px] text-slate-500">{a.asset_type}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Corridor mode ─────────────────────────────────────── */}
          {scanMode === 'corridor' && (
            <>
              {!drawnPolygon ? (
                <button onClick={onStartDraw}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs flex items-center justify-center gap-2 font-medium">
                  <Route size={13} /> ارسم المسار على الخريطة
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span className="flex-1">مسار مرسوم ({drawnPolygon.length} نقطة)</span>
                  <button
                    onClick={() => { onClearDraw?.(); setResult(null); }}
                    className="flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-rose-400 bg-slate-800/60 px-2 py-1 rounded border border-slate-700 transition-colors"
                  >
                    <X size={9} />مسح
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Shared controls ───────────────────────────────────── */}
          <div className={`grid gap-2 ${scanMode !== 'polygon' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">الفترة الزمنية</label>
              <select value={daysBack} onChange={e => setDaysBack(+e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500">
                <option value={14}>14 يوم</option>
                <option value={30}>30 يوم</option>
                <option value={60}>60 يوم</option>
                <option value={90}>90 يوم</option>
              </select>
            </div>
            {scanMode !== 'polygon' && (
              <div>
                <label className="block text-[10px] text-slate-500 mb-1">هامش Buffer</label>
                <select value={bufferM} onChange={e => setBufferM(+e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500">
                  <option value={200}>200 م</option>
                  <option value={500}>500 م</option>
                  <option value={1000}>1 كم</option>
                  <option value={2000}>2 كم</option>
                </select>
              </div>
            )}
          </div>

          <button onClick={runScan} disabled={!canScan || loading}
            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs flex items-center justify-center gap-2 font-semibold">
            {loading
              ? <><RefreshCw size={13} className="animate-spin" />جاري التحليل...</>
              : <><Search size={13} />بدء المسح</>}
          </button>

          {/* ── Result ────────────────────────────────────────────── */}
          {result?.ok && (
            <div className="space-y-2">
              <div className={`px-3 py-2.5 rounded-lg border ${sevCfg.bg}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-bold text-xs ${sevCfg.color}`}>{sevCfg.icon} {sevCfg.label}</span>
                  <span className="text-[10px] text-slate-500">{result.overall_score}/100</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{result.interpretation}</p>
                <p className="text-[10px] text-slate-500 mt-1">{result.area_km2} كم² | {result.period?.days_back} يوم</p>
              </div>
              {result.evidence.length > 0 && (
                <div className="bg-slate-800/40 rounded-lg p-2 space-y-1">
                  {result.evidence.map((e, i) => (
                    <p key={i} className="text-[11px] text-slate-300">{e}</p>
                  ))}
                </div>
              )}
              <button onClick={() => setShowMetrics(v => !v)}
                className="w-full flex items-center justify-between px-2 py-1.5 bg-slate-800/40 rounded text-[10px] text-slate-500 hover:text-slate-300">
                <span>القراءات الأولية ({result.pixel_level ? 'pixel 10م' : 'tile'})</span>
                {showMetrics ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
              {showMetrics && result.raw_metrics && (
                <div className="bg-slate-800/30 rounded p-2 text-[10px] space-y-1">
                  {[
                    { k:'ndwi',  l:'NDWI' }, { k:'ndvi', l:'NDVI' },
                    { k:'ndmi',  l:'NDMI' }, { k:'sar_vv', l:'SAR VV' },
                  ].map(({ k, l }) => {
                    const cur = result.raw_metrics.current?.[k];
                    if (cur == null) return null;
                    const dlt = result.raw_metrics.delta?.[k];
                    return (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-slate-500 w-16">{l}</span>
                        <span className="text-slate-300">{typeof cur === 'number' ? cur.toFixed(3) : cur}</span>
                        {dlt != null && (
                          <span className={typeof dlt === 'number' && dlt > 0 ? 'text-orange-400' : 'text-green-400'}>
                            {typeof dlt === 'number' && dlt > 0 ? '+' : ''}{typeof dlt === 'number' ? dlt.toFixed(3) : dlt}
                          </span>
                        )}
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              )}
            </div>
          )}

          {result && !result.ok && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
              ❌ {result.error || 'فشل التحليل'}
            </div>
          )}

          {/* ── Guide (collapsed when no result) ──────────────────── */}
          {!result && !loading && (
            <div className="text-[10px] text-slate-600 space-y-0.5 border-t border-slate-800/60 pt-2">
              <p className="text-slate-500 font-medium mb-1">ما يُكشف:</p>
              <p>💧 مياه حرة على السطح (NDWI)</p>
              <p>🌿 نباتات شاذة في الصحراء (NDVI)</p>
              <p>🫧 رطوبة تربة غير طبيعية (NDMI)</p>
              <p>📡 تغيير في الرادار (SAR)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';
/**
 * NetworkDesignPanel — تصميم شبكات المياه والصرف الصحي
 *
 * Features:
 *  • إضافة عقد (نقاط مياه/صرف) بالنقر على الخريطة أو إدخال يدوي
 *  • تعريف أنابيب بين العقد (قطر آلي أو يدوي)
 *  • حل هيدروليكي: Hardy-Cross (مياه) / تحليل الشجرة (صرف)
 *  • نتائج: ضغط كل عقدة / سرعة وانحدار كل أنبوب
 *  • تصدير GeoJSON كامل بخصائص هندسية
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Droplets, Waves, Plus, Trash2, Play, Download,
  AlertCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp, Link2,
  PenLine, Cpu,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type NetworkType = 'water' | 'sewer';
type NodeType    = 'source' | 'junction' | 'demand' | 'outfall';
type Material    = 'pvc' | 'hdpe' | 'steel' | 'ac';

interface NetNode {
  id:          string;
  lon:         number;
  lat:         number;
  type:        NodeType;
  label:       string;
  population?: number;
  demand_lph?: number;
  head_m?:     number;   // source pressure head
}

interface NetPipe {
  id:          string;
  from_node:   string;
  to_node:     string;
  diameter_mm: number;   // 0 = auto
  material:    Material;
}

interface HydroResult {
  network_type: string;
  results: {
    nodes: { id: string; head_m?: number; pressure_m?: number; pressure_bar?: number; invert_m?: number; depth_m?: number; elev_m: number; status: string }[];
    pipes: { id: string; flow_lps: number; velocity_ms: number; headloss_m?: number; headloss_per_km?: number; slope_pct?: number; diameter_mm: number; fill_pct?: number; status: string }[];
  };
  summary: {
    total_demand_lps?: number; total_demand_m3h?: number;
    total_flow_lps?: number; total_flow_m3h?: number;
    total_population?: number;
    min_pressure_m?: number; max_pressure_m?: number;
    min_slope_pct?: number; max_velocity_ms?: number;
    pipe_count: number; node_count: number;
    warnings: string[];
  };
  geojson: any;
}

// ── Auto-design result ───────────────────────────────────────────────────────

interface AutoNetworkResult {
  summary: { area_ha: number; total_population: number; water_demand_lps: number; sewer_flow_lps: number; nodes_count: number; pipes_count: number; grid_spacing_m: number };
  geojson: any;
  pipes: object[];
  nodes: object[];
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  networkPickMode:       'idle' | 'picking_node';
  networkPickedPoint:    [number, number] | null;
  onStartNetworkPick:    () => void;
  onNetworkPickConsumed: () => void;
  // Auto-design from polygon
  autoNetworkPolygon?:   [number, number][] | null;
  onStartAutoNetworkDraw?: () => void;
  onAutoNetworkResult?:  (geojson: any, summary: any) => void;
}

// ── Colour helpers ────────────────────────────────────────────────────────────

const NODE_TYPE_STYLE: Record<NodeType, string> = {
  source:   'bg-blue-700  text-blue-100  border-blue-500',
  junction: 'bg-slate-700 text-slate-200 border-slate-500',
  demand:   'bg-green-800 text-green-200 border-green-600',
  outfall:  'bg-rose-800  text-rose-200  border-rose-600',
};
const NODE_TYPE_AR: Record<NodeType, string> = {
  source:   'مصدر مياه',
  junction: 'وصلة',
  demand:   'نقطة طلب',
  outfall:  'مصب',
};
const STATUS_COLOR: Record<string, string> = {
  ok:            'text-green-400',
  low_pressure:  'text-rose-400',
  high_pressure: 'text-yellow-400',
  low_velocity:  'text-yellow-400',
  high_velocity: 'text-rose-400',
  low_slope:     'text-amber-400',
  shallow:       'text-blue-400',
  deep:          'text-orange-400',
  no_supply:     'text-slate-500',
};

let _nodeCounter = 1;
let _pipeCounter = 1;
function nextNodeId() { return `N${_nodeCounter++}`; }
function nextPipeId() { return `P${_pipeCounter++}`; }

// ── Component ─────────────────────────────────────────────────────────────────

export default function NetworkDesignPanel({
  networkPickMode, networkPickedPoint, onStartNetworkPick, onNetworkPickConsumed,
  autoNetworkPolygon, onStartAutoNetworkDraw, onAutoNetworkResult,
}: Props) {
  const [networkType, setNetworkType] = useState<NetworkType>('water');

  // ── Auto-design state ───────────────────────────────────────────────────────
  const [autoOpen,         setAutoOpen]         = useState(false);
  const [autoDensity,      setAutoDensity]       = useState('100');    // person/ha
  const [autoSpacing,      setAutoSpacing]       = useState('100');    // meters
  const [autoNetType,      setAutoNetType]       = useState<'water'|'sewer'|'both'>('sewer');
  const [autoRunning,      setAutoRunning]       = useState(false);
  const [autoError,        setAutoError]         = useState<string|null>(null);
  const [autoResult,       setAutoResult]        = useState<AutoNetworkResult|null>(null);
  const [autoPolygonReady, setAutoPolygonReady]  = useState(false);
  const capturedPolygonRef = useRef<[number,number][]|null>(null);

  // Detect when polygon is captured for auto-design
  React.useEffect(() => {
    if (autoNetworkPolygon && autoNetworkPolygon.length >= 3 && autoOpen) {
      capturedPolygonRef.current = autoNetworkPolygon;
      setAutoPolygonReady(true);
    }
  }, [autoNetworkPolygon, autoOpen]);

  const handleRunAutoDesign = useCallback(async () => {
    const polygon = capturedPolygonRef.current;
    if (!polygon || polygon.length < 3) { setAutoError('ارسم حدود التجمع أولاً'); return; }
    setAutoRunning(true);
    setAutoError(null);
    try {
      const res = await fetch('/api/gis/auto-network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polygon,
          density: Number(autoDensity) || 100,
          network_type: autoNetType,
          grid_spacing: Number(autoSpacing) || 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setAutoResult(data as AutoNetworkResult);
      onAutoNetworkResult?.(data.geojson, data.summary);
    } catch (e: any) {
      setAutoError(e?.message ?? 'فشل التصميم التلقائي');
    } finally {
      setAutoRunning(false);
    }
  }, [autoDensity, autoSpacing, autoNetType, onAutoNetworkResult]);

  const handleExportAutoGeojson = () => {
    if (!autoResult) return;
    const blob = new Blob([JSON.stringify(autoResult.geojson, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auto_network_${autoNetType}_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const [nodes, setNodes]   = useState<NetNode[]>([]);
  const [pipes, setPipes]   = useState<NetPipe[]>([]);
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState<string | null>(null);
  const [result, setResult]    = useState<HydroResult | null>(null);

  // Add node form state
  const [addNodeType,  setAddNodeType]  = useState<NodeType>('demand');
  const [addNodeLabel, setAddNodeLabel] = useState('');
  const [addNodePop,   setAddNodePop]   = useState('');
  const [addNodeHead,  setAddNodeHead]  = useState('30');
  const [pendingPlace, setPendingPlace] = useState(false);

  // Add pipe form state
  const [pipeFrom,   setPipeFrom]   = useState('');
  const [pipeTo,     setPipeTo]     = useState('');
  const [pipeDiam,   setPipeDiam]   = useState('0');
  const [pipeMat,    setPipeMat]    = useState<Material>('pvc');

  const [showResults, setShowResults] = useState(true);

  // ── Map click → node placement ─────────────────────────────────────────────
  const pendingNodeRef = useRef<{ type: NodeType; label: string; population?: number; head_m?: number } | null>(null);

  React.useEffect(() => {
    if (networkPickedPoint && pendingNodeRef.current) {
      const [lon, lat] = networkPickedPoint;
      const info = pendingNodeRef.current;
      const id = nextNodeId();
      setNodes(prev => [...prev, {
        id,
        lon, lat,
        type:       info.type,
        label:      info.label || id,
        population: info.population,
        head_m:     info.head_m,
      }]);
      pendingNodeRef.current = null;
      setPendingPlace(false);
      onNetworkPickConsumed();
    }
  }, [networkPickedPoint, onNetworkPickConsumed]);

  const handlePlaceOnMap = useCallback(() => {
    pendingNodeRef.current = {
      type:       addNodeType,
      label:      addNodeLabel || nextNodeId(),
      population: addNodePop ? Number(addNodePop) : undefined,
      head_m:     addNodeType === 'source' ? Number(addNodeHead) : undefined,
    };
    setPendingPlace(true);
    onStartNetworkPick();
  }, [addNodeType, addNodeLabel, addNodePop, addNodeHead, onStartNetworkPick]);

  const handleAddNodeManual = useCallback(() => {
    setError('أدخل الإحداثيات يدوياً أو انقر "ضع على الخريطة"');
  }, []);

  const handleAddPipe = useCallback(() => {
    if (!pipeFrom || !pipeTo || pipeFrom === pipeTo) {
      setError('اختر عقدتين مختلفتين للأنبوب'); return;
    }
    if (!nodes.find(n => n.id === pipeFrom) || !nodes.find(n => n.id === pipeTo)) {
      setError('عقدة غير موجودة'); return;
    }
    setError(null);
    setPipes(prev => [...prev, {
      id:          nextPipeId(),
      from_node:   pipeFrom,
      to_node:     pipeTo,
      diameter_mm: Number(pipeDiam),
      material:    pipeMat,
    }]);
    setPipeFrom(''); setPipeTo('');
  }, [pipeFrom, pipeTo, pipeDiam, pipeMat, nodes]);

  const handleRemoveNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setPipes(prev => prev.filter(p => p.from_node !== id && p.to_node !== id));
  };

  const handleRemovePipe = (id: string) => setPipes(prev => prev.filter(p => p.id !== id));

  // ── Run hydraulics ─────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (nodes.length < 2) { setError('أضف عقدتين على الأقل'); return; }
    if (!pipes.length)    { setError('أضف أنبوباً واحداً على الأقل'); return; }
    const hasSource = nodes.some(n =>
      networkType === 'water' ? n.type === 'source' : n.type === 'outfall'
    );
    if (!hasSource) {
      setError(networkType === 'water' ? 'أضف عقدة مصدر مياه واحدة' : 'أضف عقدة مصب واحدة');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/gis/network-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network_type: networkType,
          nodes: nodes.map(n => ({
            id:          n.id,
            lon:         n.lon,
            lat:         n.lat,
            type:        n.type,
            label:       n.label,
            population:  n.population,
            head_m:      n.head_m,
          })),
          pipes,
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      setResult(await res.json());
      setShowResults(true);
    } catch (e: any) {
      setError(e?.message ?? 'فشل الحساب الهيدروليكي');
    } finally {
      setLoading(false);
    }
  }, [nodes, pipes, networkType]);

  // ── Export GeoJSON ────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.geojson, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `network_${networkType}_${Date.now()}.geojson`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Result lookup helpers ────────────────────────────────────────────────
  const nodeRes = useCallback((id: string) => result?.results.nodes.find(n => n.id === id), [result]);
  const pipeRes = useCallback((id: string) => result?.results.pipes.find(p => p.id === id), [result]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto p-3 space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        {networkType === 'water'
          ? <Droplets size={14} className="text-blue-400 shrink-0" />
          : <Waves    size={14} className="text-green-400 shrink-0" />}
        <span className="text-[12px] font-bold text-slate-200">تصميم شبكات المياه والصرف</span>
      </div>

      {/* ── Auto-design accordion ────────────────────────────────────────── */}
      <div className="rounded-lg border border-cyan-600/40 bg-cyan-900/10 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-cyan-900/20 transition-colors"
          onClick={() => setAutoOpen(v => !v)}
        >
          <div className="flex items-center gap-2">
            <Cpu size={13} className="text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-300">تصميم تلقائي من مضلع</span>
          </div>
          {autoOpen ? <ChevronUp size={13} className="text-cyan-400" /> : <ChevronDown size={13} className="text-cyan-400" />}
        </button>

        {autoOpen && (
          <div className="px-3 pb-3 space-y-2.5">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              ارسم مضلعاً حول التجمع السكني وسيقوم النظام بتصميم شبكة{' '}
              {autoNetType === 'both' ? 'مياه وصرف صحي' : autoNetType === 'water' ? 'المياه' : 'الصرف الصحي'}{' '}
              تلقائياً مع الحسابات الهيدروليكية.
            </p>

            {/* Network type */}
            <div>
              <label className="text-[10px] text-slate-400 mb-1 block">نوع الشبكة</label>
              <div className="flex gap-1">
                {(['water','sewer','both'] as const).map(t => (
                  <button key={t}
                    onClick={() => setAutoNetType(t)}
                    className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                      autoNetType === t
                        ? 'bg-cyan-700/60 border-cyan-500 text-cyan-100'
                        : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {t === 'water' ? 'مياه' : t === 'sewer' ? 'صرف صحي' : 'كلاهما'}
                  </button>
                ))}
              </div>
            </div>

            {/* Density & spacing */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">الكثافة (نسمة/هكتار)</label>
                <input
                  type="number" min="10" max="1000" value={autoDensity}
                  onChange={e => setAutoDensity(e.target.value)}
                  className="w-full text-[11px] bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">التباعد (متر)</label>
                <input
                  type="number" min="30" max="500" step="10" value={autoSpacing}
                  onChange={e => setAutoSpacing(e.target.value)}
                  className="w-full text-[11px] bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200"
                />
              </div>
            </div>

            {/* Draw polygon button */}
            <button
              onClick={() => { onStartAutoNetworkDraw?.(); setAutoPolygonReady(false); capturedPolygonRef.current = null; }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-medium bg-cyan-700/30 border border-cyan-600/50 text-cyan-200 hover:bg-cyan-700/50 transition-colors"
            >
              <PenLine size={12} />
              ارسم حدود التجمع السكني
            </button>

            {/* Polygon status */}
            {autoPolygonReady && (
              <div className="flex items-center gap-2 text-[10px] text-green-300 bg-green-900/20 border border-green-700/40 rounded px-2 py-1.5">
                <CheckCircle2 size={11} />
                المنطقة محددة — يمكنك تشغيل التصميم
              </div>
            )}

            {/* Auto error */}
            {autoError && (
              <div className="flex items-center gap-2 text-[10px] text-rose-300 bg-rose-900/20 border border-rose-700/40 rounded px-2 py-1.5">
                <AlertCircle size={11} />{autoError}
              </div>
            )}

            {/* Run button */}
            <button
              onClick={handleRunAutoDesign}
              disabled={autoRunning}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-semibold bg-cyan-600/80 hover:bg-cyan-600 disabled:opacity-50 text-white transition-colors"
            >
              {autoRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {autoRunning ? 'جاري التصميم…' : 'تشغيل التصميم التلقائي'}
            </button>

            {/* Auto results summary */}
            {autoResult && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'المساحة', value: `${autoResult.summary.area_ha} هكتار` },
                    { label: 'السكان', value: autoResult.summary.total_population.toLocaleString() },
                    { label: 'طلب المياه', value: `${autoResult.summary.water_demand_lps} ل/ث` },
                    { label: 'الصرف', value: `${autoResult.summary.sewer_flow_lps} ل/ث` },
                    { label: 'عدد العقد', value: autoResult.summary.nodes_count },
                    { label: 'عدد الأنابيب', value: autoResult.summary.pipes_count },
                  ].map(k => (
                    <div key={k.label} className="bg-slate-800/60 rounded p-1.5">
                      <p className="text-[9px] text-slate-400">{k.label}</p>
                      <p className="text-[11px] font-bold text-cyan-300">{k.value}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExportAutoGeojson}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                >
                  <Download size={11} /> تصدير GeoJSON
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Network type */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5">
        <p className="text-xs text-slate-400 font-semibold mb-2">نوع الشبكة</p>
        <div className="grid grid-cols-2 gap-1">
          {([['water','شبكة مياه','text-blue-300','border-blue-600','bg-blue-900/30'],
             ['sewer','شبكة صرف','text-green-300','border-green-600','bg-green-900/30']] as const).map(
            ([val, label, tc, bc, bg]) => (
              <button key={val} onClick={() => { setNetworkType(val); setResult(null); setError(null); }}
                className={`py-2 rounded text-xs font-bold border transition-colors ${networkType === val ? `${tc} ${bc} ${bg}` : 'text-slate-400 border-slate-700/40 bg-slate-800/40 hover:border-slate-500'}`}>
                {label}
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Add node ────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-2">
        <p className="text-xs text-slate-400 font-semibold">إضافة عقدة</p>

        <div className="grid grid-cols-2 gap-1">
          {(networkType === 'water'
            ? [['source','مصدر مياه'],['junction','وصلة'],['demand','نقطة طلب']] as const
            : [['outfall','مصب'],['junction','وصلة'],['demand','نقطة توليد']] as const
          ).map(([val, label]) => (
            <button key={val} onClick={() => setAddNodeType(val as NodeType)}
              className={`py-1.5 rounded text-[10px] border transition-colors ${addNodeType === val ? NODE_TYPE_STYLE[val as NodeType] : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:border-slate-500'}`}>
              {label}
            </button>
          ))}
        </div>

        <input value={addNodeLabel} onChange={e => setAddNodeLabel(e.target.value)}
          placeholder="اسم العقدة (اختياري)"
          className="w-full rounded border border-slate-600 bg-slate-900/60 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500" />

        {(addNodeType === 'demand' || addNodeType === 'junction') && (
          <input value={addNodePop} onChange={e => setAddNodePop(e.target.value)}
            placeholder={networkType === 'water' ? 'عدد السكان (اختياري)' : 'السكان أو التدفق (لتر/ساعة)'}
            type="number" min="0"
            className="w-full rounded border border-slate-600 bg-slate-900/60 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500" />
        )}

        {addNodeType === 'source' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 whitespace-nowrap">ضغط المصدر (م)</span>
            <input value={addNodeHead} onChange={e => setAddNodeHead(e.target.value)}
              type="number" min="5" max="100"
              className="flex-1 rounded border border-slate-600 bg-slate-900/60 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
        )}

        <button
          onClick={handlePlaceOnMap}
          disabled={networkPickMode !== 'idle' && !pendingPlace}
          className={`w-full py-1.5 rounded text-xs font-semibold border transition-colors ${pendingPlace || networkPickMode === 'picking_node' ? 'bg-cyan-700 border-cyan-500 text-white animate-pulse' : 'bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600'}`}
        >
          {pendingPlace ? '← انقر على الخريطة لتحديد الموقع' : '📍 ضع على الخريطة'}
        </button>
      </div>

      {/* ── Nodes list ──────────────────────────────────────────────── */}
      {nodes.length > 0 && (
        <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5">
          <p className="text-xs text-slate-400 font-semibold mb-1.5">العقد ({nodes.length})</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {nodes.map(n => {
              const r = nodeRes(n.id);
              return (
                <div key={n.id} className="flex items-center gap-1.5 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${NODE_TYPE_STYLE[n.type]}`}>{n.id}</span>
                  <span className="flex-1 text-slate-300 truncate">{n.label}</span>
                  {n.population && <span className="text-slate-500">{n.population.toLocaleString()} ن</span>}
                  {r && (
                    <span className={`font-bold ${STATUS_COLOR[r.status] ?? 'text-slate-400'}`}>
                      {networkType === 'water'
                        ? `${r.pressure_m}م / ${r.pressure_bar}bar`
                        : `${r.depth_m}م عمق`}
                    </span>
                  )}
                  <button onClick={() => handleRemoveNode(n.id)}
                    className="text-slate-600 hover:text-rose-400 shrink-0">
                    <Trash2 size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Add pipe ────────────────────────────────────────────────── */}
      {nodes.length >= 2 && (
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-2">
          <p className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
            <Link2 size={10} /> إضافة أنبوب
          </p>
          <div className="grid grid-cols-2 gap-1">
            <select value={pipeFrom} onChange={e => setPipeFrom(e.target.value)}
              className="rounded border border-slate-600 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
              <option value="">من (عقدة)</option>
              {nodes.map(n => <option key={n.id} value={n.id}>{n.id}: {n.label}</option>)}
            </select>
            <select value={pipeTo} onChange={e => setPipeTo(e.target.value)}
              className="rounded border border-slate-600 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
              <option value="">إلى (عقدة)</option>
              {nodes.filter(n => n.id !== pipeFrom).map(n => <option key={n.id} value={n.id}>{n.id}: {n.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <select value={pipeDiam} onChange={e => setPipeDiam(e.target.value)}
              className="rounded border border-slate-600 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
              <option value="0">قطر آلي</option>
              {(networkType === 'water'
                ? [50,75,100,150,200,250,300,400,500]
                : [150,200,250,300,375,450,525,600]
              ).map(d => <option key={d} value={d}>{d} مم</option>)}
            </select>
            <select value={pipeMat} onChange={e => setPipeMat(e.target.value as Material)}
              className="rounded border border-slate-600 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500">
              <option value="pvc">PVC (C=150)</option>
              <option value="hdpe">HDPE (C=140)</option>
              <option value="steel">فولاذ (C=120)</option>
              <option value="ac">إسمنت مضغوط (C=110)</option>
            </select>
          </div>
          <button onClick={handleAddPipe}
            className="w-full py-1.5 rounded text-xs font-semibold bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 transition-colors flex items-center justify-center gap-1">
            <Plus size={10} /> إضافة الأنبوب
          </button>
        </div>
      )}

      {/* ── Pipes list ──────────────────────────────────────────────── */}
      {pipes.length > 0 && (
        <div className="rounded-lg border border-slate-700/40 bg-slate-900/30 p-2.5">
          <p className="text-xs text-slate-400 font-semibold mb-1.5">الأنابيب ({pipes.length})</p>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {pipes.map(p => {
              const r = pipeRes(p.id);
              return (
                <div key={p.id} className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-slate-500 font-mono w-6 shrink-0">{p.id}</span>
                  <span className="text-slate-400">{p.from_node}→{p.to_node}</span>
                  <span className="text-slate-500">{p.diameter_mm > 0 ? `${p.diameter_mm}مم` : 'آلي'}</span>
                  {r && (
                    <span className={`flex-1 text-right font-bold ${STATUS_COLOR[r.status] ?? 'text-slate-400'}`}>
                      {r.diameter_mm}مم · {r.velocity_ms}م/ث · {r.flow_lps}ل/ث
                    </span>
                  )}
                  <button onClick={() => handleRemovePipe(p.id)}
                    className="text-slate-600 hover:text-rose-400 shrink-0">
                    <Trash2 size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 px-3 py-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-300">{error}</p>
        </div>
      )}

      {/* ── Run button ───────────────────────────────────────────────── */}
      <button onClick={handleRun}
        disabled={loading || nodes.length < 2 || !pipes.length}
        className="w-full py-2 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors">
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        {loading ? 'جارٍ الحل الهيدروليكي...' : 'تشغيل الحساب الهيدروليكي'}
      </button>

      {/* ── Results ─────────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-3">
          {/* Summary KPIs */}
          <div className="rounded-lg border border-blue-700/30 bg-blue-950/15 p-2.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-blue-300">
                {networkType === 'water' ? '💧 نتائج شبكة المياه' : '🔩 نتائج شبكة الصرف'}
              </p>
              <div className="flex gap-1.5">
                <button onClick={() => setShowResults(r => !r)}
                  className="text-slate-500 hover:text-slate-300">
                  {showResults ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
                <button onClick={handleExport}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-800/50">
                  <Download size={9} /> GeoJSON
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
              {networkType === 'water' ? (
                <>
                  <div className="rounded bg-slate-800/50 p-1.5">
                    <div className="text-slate-500">إجمالي الطلب</div>
                    <div className="font-bold text-blue-300">{result.summary.total_demand_lps} ل/ث</div>
                    <div className="text-slate-600">{result.summary.total_demand_m3h} م³/س</div>
                  </div>
                  <div className="rounded bg-slate-800/50 p-1.5">
                    <div className="text-slate-500">نطاق الضغط</div>
                    <div className="font-bold text-slate-200">{result.summary.min_pressure_m}م – {result.summary.max_pressure_m}م</div>
                    <div className="text-slate-600">المعيار: 10–60م</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded bg-slate-800/50 p-1.5">
                    <div className="text-slate-500">إجمالي التدفق</div>
                    <div className="font-bold text-green-300">{result.summary.total_flow_lps} ل/ث</div>
                    <div className="text-slate-600">{result.summary.total_flow_m3h} م³/س</div>
                  </div>
                  <div className="rounded bg-slate-800/50 p-1.5">
                    <div className="text-slate-500">أقصى سرعة</div>
                    <div className="font-bold text-slate-200">{result.summary.max_velocity_ms} م/ث</div>
                    <div className="text-slate-600">المعيار: 0.6–3.0 م/ث</div>
                  </div>
                </>
              )}
              <div className="rounded bg-slate-800/50 p-1.5">
                <div className="text-slate-500">عقد / أنابيب</div>
                <div className="font-bold text-slate-200">{result.summary.node_count} / {result.summary.pipe_count}</div>
              </div>
              <div className="rounded bg-slate-800/50 p-1.5">
                <div className="text-slate-500">الحالة</div>
                <div className={`font-bold ${result.summary.warnings.length === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {result.summary.warnings.length === 0 ? '✓ مطابق' : `${result.summary.warnings.length} تحذير`}
                </div>
              </div>
            </div>

            {/* Warnings */}
            {result.summary.warnings.length > 0 && (
              <div className="space-y-1 mb-2">
                {result.summary.warnings.map((w, i) => (
                  <p key={i} className="text-[10px] text-amber-300 leading-snug">{w}</p>
                ))}
              </div>
            )}
          </div>

          {showResults && (
            <>
              {/* Node results table */}
              <div className="rounded-lg border border-slate-700/30 bg-slate-900/30 p-2.5">
                <p className="text-[10px] font-bold text-slate-400 mb-1.5">نتائج العقد</p>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-[9px]">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="text-slate-500 border-b border-slate-700/50">
                        <th className="py-1 text-right pr-1">العقدة</th>
                        <th className="py-1 text-center">ارتفاع (م)</th>
                        {networkType === 'water' ? (
                          <>
                            <th className="py-1 text-center">HGL (م)</th>
                            <th className="py-1 text-center">ضغط (م)</th>
                            <th className="py-1 text-center">bar</th>
                          </>
                        ) : (
                          <>
                            <th className="py-1 text-center">قاع (م)</th>
                            <th className="py-1 text-center">عمق (م)</th>
                          </>
                        )}
                        <th className="py-1 text-center">حالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.nodes.map(n => {
                        const node = nodes.find(nn => nn.id === n.id);
                        return (
                          <tr key={n.id} className="border-b border-slate-800/30">
                            <td className="py-0.5 pr-1 text-slate-300">{node?.label ?? n.id}</td>
                            <td className="py-0.5 text-center text-slate-400">{n.elev_m}</td>
                            {networkType === 'water' ? (
                              <>
                                <td className="py-0.5 text-center text-blue-300">{n.head_m}</td>
                                <td className={`py-0.5 text-center font-bold ${STATUS_COLOR[n.status]}`}>{n.pressure_m}</td>
                                <td className="py-0.5 text-center text-slate-400">{n.pressure_bar}</td>
                              </>
                            ) : (
                              <>
                                <td className="py-0.5 text-center text-green-300">{n.invert_m}</td>
                                <td className={`py-0.5 text-center font-bold ${STATUS_COLOR[n.status]}`}>{n.depth_m}</td>
                              </>
                            )}
                            <td className={`py-0.5 text-center font-bold ${STATUS_COLOR[n.status]}`}>
                              {n.status === 'ok' ? '✓' : '⚠'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pipe results table */}
              <div className="rounded-lg border border-slate-700/30 bg-slate-900/30 p-2.5">
                <p className="text-[10px] font-bold text-slate-400 mb-1.5">نتائج الأنابيب</p>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-[9px]">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="text-slate-500 border-b border-slate-700/50">
                        <th className="py-1 text-right pr-1">الأنبوب</th>
                        <th className="py-1 text-center">قطر مم</th>
                        <th className="py-1 text-center">تدفق ل/ث</th>
                        <th className="py-1 text-center">سرعة م/ث</th>
                        {networkType === 'water'
                          ? <th className="py-1 text-center">فقد م/كم</th>
                          : <th className="py-1 text-center">انحدار %</th>}
                        <th className="py-1 text-center">حالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.results.pipes.map(p => {
                        const pipe = pipes.find(pp => pp.id === p.id);
                        return (
                          <tr key={p.id} className="border-b border-slate-800/30">
                            <td className="py-0.5 pr-1 text-slate-400">{pipe ? `${pipe.from_node}→${pipe.to_node}` : p.id}</td>
                            <td className="py-0.5 text-center text-violet-300">{p.diameter_mm}</td>
                            <td className="py-0.5 text-center text-blue-300">{p.flow_lps}</td>
                            <td className={`py-0.5 text-center font-bold ${STATUS_COLOR[p.status]}`}>{p.velocity_ms}</td>
                            {networkType === 'water'
                              ? <td className="py-0.5 text-center text-slate-400">{p.headloss_per_km}</td>
                              : <td className={`py-0.5 text-center ${(p.slope_pct ?? 0) < 0.5 ? 'text-rose-400' : 'text-slate-400'}`}>{p.slope_pct}%</td>}
                            <td className={`py-0.5 text-center font-bold ${STATUS_COLOR[p.status]}`}>
                              {p.status === 'ok' ? '✓' : '⚠'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Standards note */}
              <p className="text-[9px] text-slate-600 text-center">
                {networkType === 'water'
                  ? 'معادلة Hazen-Williams · 150 ل/فرد/يوم · معامل ذروة 2.5 · Hardy-Cross'
                  : "Manning n=0.013 · ملء 75% · حد أدنى 0.5% انحدار · حد أدنى 0.6م/ث"}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

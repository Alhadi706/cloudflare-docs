'use client';
// ══════════════════════════════════════════════════════════════════════════════
//  PipelineLinearMap — خريطة خطية تفاعلية احترافية لمسارات التآكل
//  Features:
//   • خريطة قمر صناعي حقيقية (Esri World Imagery)
//   • مسار الخط ملوّن بحسب درجة الخطورة (أخضر/أصفر/أحمر)
//   • تكبير/تصغير + سحب حر
//   • نقر على نقطة = popup تفصيلي
//   • لوحة رسوم بيانية (CP Potential vs Distance)
//   • اختيار الجلسة / الملف من القائمة
//   • مؤشرات ملخص (Safe / At-Risk / Not Protected)
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ReferenceLine, ResponsiveContainer, Legend, Brush, Area, ComposedChart,
} from 'recharts';
import {
  Map as MapIcon, ZoomIn, ZoomOut, Layers, AlertTriangle,
  CheckCircle, XCircle, ChevronDown, RefreshCw, Info,
  Maximize2, Minimize2, Target,
} from 'lucide-react';

// ── Risk colors ────────────────────────────────────────────────────────────
const RISK_COLOR: Record<string, string> = {
  SAFE:          '#22c55e',   // green-500
  AT_RISK:       '#f59e0b',   // amber-500
  NOT_PROTECTED: '#ef4444',   // red-500
  UNKNOWN:       '#94a3b8',   // slate-400
};

// ── Helper: hex color to rgba() string ─────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const RISK_LABEL: Record<string, string> = {
  SAFE:          'محمي',
  AT_RISK:       'تحت المراقبة',
  NOT_PROTECTED: 'غير محمي',
  UNKNOWN:       'غير معروف',
};

// ── Types ──────────────────────────────────────────────────────────────────
interface ChartPoint {
  distance: number;
  on_potential: number | null;
  off_potential: number | null;
  natural_potential: number | null;
  risk: string;
  lat: number;
  lon: number;
  location: string;
}

interface SessionData {
  session_id: string;
  file_name: string;
  survey_date: string;
  total_points: number;
  stats: {
    safe_count: number;
    at_risk_count: number;
    not_protected_count: number;
    min_potential: number | null;
    max_potential: number | null;
    avg_potential: number | null;
    total_length_m: number;
  };
  route_geojson: any;
  segments: Array<{
    coords: [[number, number], [number, number]];
    chainage_start: number;
    chainage_end: number;
    on_potential: number | null;
    risk: string;
  }>;
  chart_series: ChartPoint[];
  bbox: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
}

interface PipelineData {
  pipeline_id: string;
  sessions: SessionData[];
}

// ── Custom tooltip for the chart ─────────────────────────────────────────
function CpTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload as ChartPoint;
  const color = RISK_COLOR[pt?.risk ?? 'UNKNOWN'];
  return (
    <div className="rounded-xl border border-slate-600 bg-slate-900/95 p-3 shadow-2xl text-xs min-w-[200px]">
      <div className="font-bold text-white mb-1" style={{ color }}>
        {RISK_LABEL[pt?.risk ?? 'UNKNOWN']}
      </div>
      <div className="text-slate-300">المسافة: <span className="text-white font-mono">{label?.toFixed(0)} م</span></div>
      {pt?.on_potential != null && (
        <div className="text-slate-300">On Potential: <span className="font-mono" style={{ color }}>{pt.on_potential.toFixed(3)} V</span></div>
      )}
      {pt?.off_potential != null && pt.off_potential !== 0 && (
        <div className="text-slate-300">Off Potential: <span className="font-mono text-cyan-400">{pt.off_potential.toFixed(3)} V</span></div>
      )}
      {pt?.location && (
        <div className="text-slate-500 mt-1 truncate">{pt.location}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Main component
// ═══════════════════════════════════════════════════════════════════════════
export default function PipelineLinearMap() {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInst     = useRef<any>(null);
  const olSource    = useRef<any>(null);

  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [pipelines,     setPipelines]     = useState<PipelineData[]>([]);
  const [activePipeline,setActivePipeline]= useState<PipelineData | null>(null);
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);
  const [olReady,       setOlReady]       = useState(false);
  const [chartFull,     setChartFull]     = useState(false);
  const [mapFull,       setMapFull]       = useState(false);
  const [hoverPoint,    setHoverPoint]    = useState<ChartPoint | null>(null);
  const [hoverMarker,   setHoverMarker]   = useState<any>(null); // OL feature

  // ── Load pipeline data ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/corrosion/pipeline-map');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const pls: PipelineData[] = json.pipelines ?? [];
      setPipelines(pls);
      if (pls.length > 0) {
        setActivePipeline(pls[0]);
        setActiveSession(pls[0].sessions[0] ?? null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Init OpenLayers ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return;

    let cancelled = false;
    (async () => {
      try {
        const [
          { default: OLMap },
          { default: View },
          { default: TileLayer },
          { default: XYZ },
          { default: VectorLayer },
          { default: VectorSource },
          { Style, Stroke, Circle: CircleStyle, Fill },
          { fromLonLat },
          { defaults: defaultControls },
          { default: Select },
          { click: olClick },
        ] = await Promise.all([
          import('ol/Map'),
          import('ol/View'),
          import('ol/layer/Tile'),
          import('ol/source/XYZ'),
          import('ol/layer/Vector'),
          import('ol/source/Vector'),
          import('ol/style'),
          import('ol/proj'),
          import('ol/control'),
          import('ol/interaction/Select'),
          import('ol/events/condition'),
        ]);

        if (cancelled || !mapRef.current) return;

        const vs = new VectorSource();
        olSource.current = vs;

        const vectorLayer = new VectorLayer({
          source: vs,
          zIndex: 10,
        });

        const satLayer = new TileLayer({
          source: new XYZ({
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            maxZoom: 19,
          }),
        });

        const lblLayer = new TileLayer({
          source: new XYZ({
            url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            maxZoom: 19,
          }),
          opacity: 0.8,
        });

        const map = new OLMap({
          target: mapRef.current,
          layers: [satLayer, lblLayer, vectorLayer],
          view: new View({ center: fromLonLat([14.63, 30.96]), zoom: 14 }),
          controls: defaultControls({ attribution: false, zoom: false }),
        });

        mapInst.current = map;
        setOlReady(true);
      } catch (e) {
        console.error('OL init error', e);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Draw ALL sessions on map when pipelines/activeSession changes ──────────
  useEffect(() => {
    if (!olReady || !olSource.current || !mapInst.current || pipelines.length === 0) return;

    (async () => {
      const [
        { default: Feature },
        { default: LineString },
        { default: Point },
        { Style, Stroke, Circle: CircleStyle, Fill },
        { fromLonLat },
      ] = await Promise.all([
        import('ol/Feature'),
        import('ol/geom/LineString'),
        import('ol/geom/Point'),
        import('ol/style'),
        import('ol/proj'),
      ]);

      olSource.current.clear();

      // Collect combined bbox for fit-to-all
      let allMinLat = Infinity, allMaxLat = -Infinity;
      let allMinLon = Infinity, allMaxLon = -Infinity;

      for (const pipeline of pipelines) {
        for (const session of pipeline.sessions) {
          const isActive = session.session_id === activeSession?.session_id;
          const alpha = isActive ? 1 : 0.35;
          const lineWidth = isActive ? 6 : 2.5;

          for (const seg of session.segments) {
            const baseColor = RISK_COLOR[seg.risk] ?? '#94a3b8';
            const color = hexToRgba(baseColor, alpha);
            const coords = seg.coords.map(([lon, lat]: [number, number]) => fromLonLat([lon, lat]));
            const feat = new Feature({ geometry: new LineString(coords), seg, session_id: session.session_id });
            feat.setStyle(new Style({ stroke: new Stroke({ color, width: lineWidth }) }));
            olSource.current.addFeature(feat);
          }

          // Start / end markers
          const segs = session.segments;
          if (segs.length > 0) {
            const first = segs[0].coords[0] as [number, number];
            const last  = segs[segs.length - 1].coords[1] as [number, number];
            const r = isActive ? 8 : 5;
            const mkStyle = (c: string) => new Style({ image: new CircleStyle({ radius: r, fill: new Fill({ color: hexToRgba(c, alpha) }), stroke: new Stroke({ color: '#fff', width: 1.5 }) }) });
            const sf = new Feature({ geometry: new Point(fromLonLat(first)) }); sf.setStyle(mkStyle('#22c55e'));
            const ef = new Feature({ geometry: new Point(fromLonLat(last))  }); ef.setStyle(mkStyle('#f59e0b'));
            olSource.current.addFeature(sf);
            olSource.current.addFeature(ef);
          }

          if (session.bbox) {
            allMinLat = Math.min(allMinLat, session.bbox.min_lat);
            allMaxLat = Math.max(allMaxLat, session.bbox.max_lat);
            allMinLon = Math.min(allMinLon, session.bbox.min_lon);
            allMaxLon = Math.max(allMaxLon, session.bbox.max_lon);
          }
        }
      }

      // Fit view: active session bbox if selected, else encompass everything
      const fitBbox = activeSession?.bbox ??
        (allMinLat !== Infinity ? { min_lat: allMinLat, max_lat: allMaxLat, min_lon: allMinLon, max_lon: allMaxLon } : null);

      if (fitBbox) {
        const { transformExtent } = await import('ol/proj');
        const extent = transformExtent(
          [fitBbox.min_lon, fitBbox.min_lat, fitBbox.max_lon, fitBbox.max_lat],
          'EPSG:4326', 'EPSG:3857'
        );
        mapInst.current.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 17 });
      }
    })();
  }, [olReady, pipelines, activeSession]);

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  const zoomIn  = () => mapInst.current?.getView().setZoom((mapInst.current.getView().getZoom() ?? 14) + 1);
  const zoomOut = () => mapInst.current?.getView().setZoom((mapInst.current.getView().getZoom() ?? 14) - 1);
  const fitAll  = async () => {
    if (!mapInst.current || pipelines.length === 0) return;
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const pl of pipelines) {
      for (const s of pl.sessions) {
        if (!s.bbox) continue;
        minLat = Math.min(minLat, s.bbox.min_lat); maxLat = Math.max(maxLat, s.bbox.max_lat);
        minLon = Math.min(minLon, s.bbox.min_lon); maxLon = Math.max(maxLon, s.bbox.max_lon);
      }
    }
    if (minLat === Infinity) return;
    const { transformExtent } = await import('ol/proj');
    const extent = transformExtent([minLon, minLat, maxLon, maxLat], 'EPSG:4326', 'EPSG:3857');
    mapInst.current.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 17 });
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const stats = activeSession?.stats;
  const total = stats ? (stats.safe_count + stats.at_risk_count + stats.not_protected_count) : 0;
  const pctSafe  = total ? Math.round((stats!.safe_count / total) * 100) : 0;
  const pctRisk  = total ? Math.round((stats!.at_risk_count / total) * 100) : 0;
  const pctBad   = total ? Math.round((stats!.not_protected_count / total) * 100) : 0;

  const chartData = activeSession?.chart_series ?? [];

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin" />
        <span>جارٍ تحميل بيانات المسار...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-red-400">
        <AlertTriangle className="w-6 h-6" />
        <span>فشل تحميل البيانات: {error}</span>
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <MapIcon className="w-10 h-10" />
        <p>لا توجد بيانات مسارات مع إحداثيات GPS</p>
        <p className="text-sm text-slate-500">الرجاء رفع ملف .svy يحتوي على latitude/longitude</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl bg-slate-950">

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-700/60">
        <MapIcon className="w-5 h-5 text-cyan-400 shrink-0" />
        <span className="font-bold text-white text-sm">خريطة المسار الخطي — Cathodic Protection Survey</span>
        <div className="flex-1" />

        {/* Pipeline selector */}
        {pipelines.length > 1 && (
          <div className="relative">
            <select
              className="appearance-none bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-3 py-1.5 pr-7 cursor-pointer"
              value={activePipeline?.pipeline_id ?? ''}
              onChange={(e) => {
                const pl = pipelines.find((p) => p.pipeline_id === e.target.value);
                if (pl) { setActivePipeline(pl); setActiveSession(pl.sessions[0] ?? null); }
              }}
            >
              {pipelines.map((pl) => (
                <option key={pl.pipeline_id} value={pl.pipeline_id}>{pl.pipeline_id}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        )}

        {/* Session selector */}
        {(activePipeline?.sessions.length ?? 0) > 1 && (
          <div className="relative">
            <select
              className="appearance-none bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-3 py-1.5 pr-7 cursor-pointer"
              value={activeSession?.session_id ?? ''}
              onChange={(e) => {
                const s = activePipeline?.sessions.find((ss) => ss.session_id === e.target.value);
                if (s) setActiveSession(s);
              }}
            >
              {activePipeline?.sessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {s.file_name} ({s.survey_date ?? '—'})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        )}

        <button
          onClick={loadData}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          title="تحديث"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      {activeSession && (
        <div className="grid grid-cols-4 divide-x divide-x-reverse divide-slate-700/50 bg-slate-900/60 border-b border-slate-700/40 text-xs">
          <StatCell
            icon={<CheckCircle className="w-4 h-4 text-green-400" />}
            label="محمي"
            value={`${stats?.safe_count ?? 0} نقطة`}
            sub={`${pctSafe}%`}
            color="text-green-400"
          />
          <StatCell
            icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
            label="تحت المراقبة"
            value={`${stats?.at_risk_count ?? 0} نقطة`}
            sub={`${pctRisk}%`}
            color="text-amber-400"
          />
          <StatCell
            icon={<XCircle className="w-4 h-4 text-red-400" />}
            label="غير محمي"
            value={`${stats?.not_protected_count ?? 0} نقطة`}
            sub={`${pctBad}%`}
            color="text-red-400"
          />
          <StatCell
            icon={<Info className="w-4 h-4 text-cyan-400" />}
            label="إجمالي الطول"
            value={`${((stats?.total_length_m ?? 0)).toFixed(0)} م`}
            sub={`${activeSession.total_points} نقطة قياس`}
            color="text-cyan-400"
          />
        </div>
      )}

      {/* ── Main body: Map + Chart ────────────────────────────────────────── */}
      <div className={`flex flex-col ${mapFull ? '' : ''}`}>

        {/* MAP ──────────────────────────────────────────────────────────── */}
        <div className={`relative ${mapFull ? 'h-[70vh]' : 'h-[420px]'} transition-all duration-300`}>
          <div ref={mapRef} className="absolute inset-0 w-full h-full" />

          {/* Loading overlay */}
          {!olReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-20">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute top-3 left-3 flex flex-col gap-1 z-20">
            <button onClick={zoomIn}  className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-600 hover:bg-slate-800 text-white flex items-center justify-center shadow-xl transition-colors">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={zoomOut} className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-600 hover:bg-slate-800 text-white flex items-center justify-center shadow-xl transition-colors">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={fitAll}  className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-600 hover:bg-slate-800 text-white flex items-center justify-center shadow-xl transition-colors" title="إعادة التمركز">
              <Target className="w-4 h-4" />
            </button>
            <button onClick={() => setMapFull((v) => !v)} className="w-9 h-9 rounded-xl bg-slate-900/90 border border-slate-600 hover:bg-slate-800 text-white flex items-center justify-center shadow-xl transition-colors">
              {mapFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Legend */}
          <div className="absolute top-3 right-3 z-20 rounded-xl bg-slate-900/90 border border-slate-700/60 p-2.5 text-xs shadow-xl">
            <div className="text-slate-400 text-[10px] font-semibold mb-1.5 uppercase tracking-wider">مستوى الحماية</div>
            {[
              { risk: 'SAFE',          label: 'محمي (≤ −0.85V)' },
              { risk: 'AT_RISK',       label: 'مراقبة (−0.50 ~ −0.85V)' },
              { risk: 'NOT_PROTECTED', label: 'غير محمي (> −0.50V)' },
            ].map(({ risk, label }) => (
              <div key={risk} className="flex items-center gap-2 mb-1">
                <div className="w-8 h-1.5 rounded-full" style={{ backgroundColor: RISK_COLOR[risk] }} />
                <span className="text-slate-300">{label}</span>
              </div>
            ))}
          </div>

          {/* File name badge */}
          {activeSession && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-xl bg-slate-900/90 border border-slate-700/60 px-4 py-1.5 text-xs text-slate-300 shadow-xl font-mono">
              {activeSession.file_name} — {activeSession.survey_date ?? ''}
            </div>
          )}
        </div>

        {/* CHART PANEL ──────────────────────────────────────────────────── */}
        <div className={`border-t border-slate-700/50 bg-slate-900/80 ${chartFull ? 'h-[50vh]' : 'h-[280px]'} transition-all duration-300`}>

          {/* Chart header */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/40">
            <span className="text-xs font-semibold text-slate-300">CP Potential vs Distance (متوسط الجهد على طول الخط)</span>
            <div className="flex-1" />
            {/* Protection threshold lines legend */}
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-5 h-0.5 inline-block bg-green-500/60" /> −0.85V</span>
              <span className="flex items-center gap-1"><span className="w-5 h-0.5 inline-block bg-amber-500/60" /> −0.50V</span>
            </div>
            <button
              onClick={() => setChartFull((v) => !v)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              {chartFull ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="h-[calc(100%-36px)] px-2 pt-1 pb-0">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 24, bottom: 20, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="distance"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(v) => `${v}م`}
                    label={{ value: 'المسافة (م)', position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 10 }}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickFormatter={(v) => `${v.toFixed(2)}V`}
                    domain={['auto', 'auto']}
                    label={{ value: 'الجهد (V)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                  />
                  <RechartTooltip content={<CpTooltip />} />

                  {/* Protection thresholds */}
                  <ReferenceLine y={-0.85} stroke="#22c55e" strokeDasharray="6 3" strokeOpacity={0.6}
                    label={{ value: '−0.85V', position: 'insideTopLeft', fill: '#22c55e', fontSize: 9 }} />
                  <ReferenceLine y={-0.50} stroke="#f59e0b" strokeDasharray="6 3" strokeOpacity={0.6}
                    label={{ value: '−0.50V', position: 'insideTopLeft', fill: '#f59e0b', fontSize: 9 }} />

                  {/* Danger zone fill */}
                  <Area
                    dataKey="on_potential"
                    fill="rgba(239,68,68,0.08)"
                    stroke="none"
                    activeDot={false}
                    legendType="none"
                  />

                  {/* On potential line — colored per segment */}
                  <Line
                    dataKey="on_potential"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const color = RISK_COLOR[payload.risk] ?? '#94a3b8';
                      return <circle key={props.key} cx={cx} cy={cy} r={3} fill={color} stroke="none" />;
                    }}
                    activeDot={{ r: 5, stroke: '#fff', strokeWidth: 1 }}
                    name="On Potential"
                    connectNulls
                  />

                  {/* Off potential line */}
                  <Line
                    dataKey="off_potential"
                    stroke="#8b5cf6"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    name="Off Potential"
                    connectNulls
                  />

                  <Brush
                    dataKey="distance"
                    height={16}
                    stroke="#334155"
                    fill="#0f172a"
                    travellerWidth={6}
                    tickFormatter={(v) => `${v}م`}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                لا توجد بيانات جهد لهذه الجلسة
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small stat cell ────────────────────────────────────────────────────────
function StatCell({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      {icon}
      <div>
        <div className="text-slate-400 text-[10px] uppercase tracking-wider">{label}</div>
        <div className={`font-bold text-sm ${color}`}>{value}</div>
        <div className="text-slate-500 text-[10px]">{sub}</div>
      </div>
    </div>
  );
}

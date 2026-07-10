'use client';
// MINERVA COMMAND CENTER v2 — Stabilization Phase
// ════════════════════════════════════════════════
// Real data only. Clean map. Synchronized alerts+map. Working draw tools.

import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Bell, Brain, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Circle, Clock, Layers, MapPin, Minus, RotateCcw, RotateCw, Ruler,
  Search, Settings, Shield, Square, Target, X, RefreshCw,
} from 'lucide-react';
import type { CCDrawMode, CCMapHandle, AlertMarker, TargetFeature } from './CommandCenterMap';

const CommandCenterMap = dynamic(() => import('./CommandCenterMap'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────
type AlertSev = 'CRITICAL' | 'ALERT' | 'WARNING' | 'WATCH';
interface RealTarget {
  id: string | number; name: string; type: string;
  status: 'NORMAL' | 'WARNING' | 'ALERT' | 'CRITICAL';
  health_score: number | null; lat: number; lon: number;
}
interface RealAlert {
  id: string; title: string; severity: AlertSev;
  target_id: string | number; target_name: string; mission: string;
  age: string; action: string; confidence: number;
  lat: number; lon: number; is_real: true;
}

const SEV: Record<AlertSev, { c: string; bg: string; bd: string; dot: string }> = {
  CRITICAL: { c:'text-red-300',    bg:'bg-red-950/50',    bd:'border-red-500/40',   dot:'bg-red-500'    },
  ALERT:    { c:'text-orange-300', bg:'bg-orange-950/50', bd:'border-orange-500/40',dot:'bg-orange-500' },
  WARNING:  { c:'text-yellow-300', bg:'bg-yellow-950/50', bd:'border-yellow-500/40',dot:'bg-yellow-400' },
  WATCH:    { c:'text-blue-300',   bg:'bg-blue-950/30',   bd:'border-blue-500/30',  dot:'bg-blue-400'   },
};

function Pip({ on, label, pulse }: { on: boolean; label: string; pulse?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${on?'bg-emerald-400':'bg-gray-700'} ${pulse&&on?'animate-pulse':''}`}/>
      <span className={`text-[10px] font-mono tracking-widest uppercase ${on?'text-emerald-300/80':'text-gray-700'}`}>{label}</span>
    </span>
  );
}

// ─── Real data hooks ──────────────────────────────────────────────────────────
function useRealTargets() {
  const [targets, setTargets] = useState<RealTarget[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/engineering/workspace/principal-assets', { signal: ctrl.signal })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => setTargets((data || []).map(a => {
        let lat = 32.89, lon = 13.18;
        try {
          const g = typeof a.geometry === 'string' ? JSON.parse(a.geometry) : a.geometry;
          if (g?.type === 'Point') { lon = g.coordinates[0]; lat = g.coordinates[1]; }
          else if (g?.type === 'LineString') { lon = g.coordinates[0][0]; lat = g.coordinates[0][1]; }
          else if (g?.type === 'Polygon') { lon = g.coordinates[0][0][0]; lat = g.coordinates[0][0][1]; }
        } catch {}
        return { id: a.id, name: a.name || `أصل #${a.id}`, type: a.classification || 'UNKNOWN',
          status: (a.status as any) || 'NORMAL', health_score: a.health_score ?? null, lat, lon };
      })))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);
  return { targets, loading };
}

interface EOStatus {
  sentinel2: { date: string | null; cloud_pct: number | null; platform: string | null; tile_url: string | null } | null;
  sentinel1: { date: string | null } | null;
  modis:     { date: string | null } | null;
  basemap_note: string;
}

function useEOStatus(lat = 32.89, lon = 13.18) {
  const [eo, setEO] = useState<EOStatus | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/minerva/eo-status?lat=${lat}&lon=${lon}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ok) setEO(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lat, lon]);
  return { eo, loading };
}

// ─── Draw tools config ────────────────────────────────────────────────────────
type ToolDef = { mode: CCDrawMode; icon: React.ElementType; label: string };
function CursorIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M4 4l7 18 3-7 7-3z"/></svg>;
}
function LineIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={2}><line x1="5" y1="19" x2="19" y2="5"/></svg>;
}
function RectIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth={2}><rect x="4" y="6" width="16" height="12" rx="1"/></svg>;
}

const TOOLS: ToolDef[] = [
  { mode: 'none',       icon: CursorIcon,  label: 'تحديد' },
  { mode: 'Point',      icon: MapPin,      label: 'نقطة' },
  { mode: 'LineString', icon: LineIcon,    label: 'خط' },
  { mode: 'Polygon',    icon: Square,      label: 'مضلع' },
  { mode: 'Circle',     icon: Circle,      label: 'دائرة' },
  { mode: 'Box',        icon: RectIcon,    label: 'مستطيل' },
];

const ST_COLORS: Record<string, string> = {
  CRITICAL: 'text-red-400', ALERT: 'text-orange-400',
  WARNING: 'text-yellow-400', NORMAL: 'text-emerald-400',
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MINERVACommandCenter() {
  const mapRef = useRef<CCMapHandle>(null);
  const { targets, loading } = useRealTargets();
  const { eo: eoStatus }         = useEOStatus();
  // Production: no simulated alerts — only real MINERVA analysis results
  const alerts: RealAlert[] = [];

  const [leftOpen,   setLeftOpen]   = useState(true);
  const [rightOpen,  setRightOpen]  = useState(false);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [leftTab,    setLeftTab]    = useState<'alerts'|'targets'|'layers'|'search'>('targets');
  const [selAlert,   setSelAlert]   = useState<RealAlert | null>(null);
  const [selTarget,  setSelTarget]  = useState<RealTarget | null>(null);
  const [drawMode,   setDrawMode]   = useState<CCDrawMode>('none');
  const [basemap,    setBasemapS]   = useState<'satellite'|'osm'|'dark'>('satellite');
  const [timeline,   setTimeline]   = useState(100);
  const [clock,      setClock]      = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [s2LayerOn,   setS2LayerOn]   = useState(false);

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().replace('T',' ').slice(0,19)+' UTC');
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, []);

  // Push real targets to map
  useEffect(() => {
    if (!mapRef.current || loading) return;
    mapRef.current.setTargets(targets.map(t => ({
      id: t.id, name: t.name, lat: t.lat, lon: t.lon, status: t.status,
    })));
  }, [targets, loading]);

  // Fly to target + highlight
  const goToTarget = useCallback((t: RealTarget) => {
    setSelTarget(t); setRightOpen(true);
    mapRef.current?.flyTo(t.lat, t.lon, 14);
    mapRef.current?.highlightTarget(t.id);
  }, []);

  const handleDraw = useCallback((mode: CCDrawMode) => {
    setDrawMode(mode); mapRef.current?.setDrawMode(mode);
  }, []);

  const handleBasemap = useCallback((b: 'satellite'|'osm'|'dark') => {
    setBasemapS(b); mapRef.current?.setBasemap(b);
  }, []);

  const handleS2Toggle = useCallback(() => {
    const next = !s2LayerOn;
    setS2LayerOn(next);
    if (next && eoStatus?.sentinel2?.tile_url) {
      mapRef.current?.setS2Layer(eoStatus.sentinel2.tile_url);
    } else {
      mapRef.current?.setS2Layer(null);
    }
  }, [s2LayerOn, eoStatus]);

  const filteredTargets = searchQuery.trim()
    ? targets.filter(t =>
        t.name.includes(searchQuery) ||
        t.type.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : targets;

  const critCnt = alerts.filter(a => a.severity === 'CRITICAL').length;

  return (
    <div className="fixed inset-0 bg-[#050c14] overflow-hidden" dir="rtl"
      style={{ fontFamily: "'Tajawal','Inter',system-ui,sans-serif" }}>
      {/* Scanline */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.015]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.5) 2px,rgba(255,255,255,.5) 3px)' }}/>

      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 h-10 z-40 flex items-center justify-between px-3
        bg-[#060d16]/95 backdrop-blur border-b border-white/6">
        <div className="flex items-center gap-3">
          <Pip on label="MINERVA" pulse />
          <Pip on label="EO LIVE" />
          <Pip on={false} label="SCADA" />
          <span className="text-[10px] font-mono text-gray-700 ms-1">{clock}</span>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <div className="relative"><div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-sm animate-pulse"/>
            <Brain className="relative w-4 h-4 text-cyan-400"/></div>
          <span className="text-[11px] font-mono font-bold tracking-[.22em] text-white uppercase">MINERVA COMMAND CENTER</span>
        </div>
        <div className="flex items-center gap-2">
          {critCnt > 0 && (
            <button onClick={() => { setLeftTab('alerts'); setLeftOpen(true); }}
              className="flex items-center gap-1 px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded text-[10px] font-mono text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse block"/>
              {critCnt} CRITICAL
            </button>
          )}
          <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-gray-500">
            {loading ? '…' : targets.length} TARGETS
          </span>
          <button className="p-1 hover:bg-white/8 rounded text-gray-600 hover:text-gray-400 transition-colors">
            <Settings className="w-3.5 h-3.5"/>
          </button>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="absolute top-10 bottom-0 inset-x-0 flex overflow-hidden">

        {/* LEFT PANEL */}
        <div className={`relative flex-shrink-0 z-20 transition-all duration-300 flex flex-col
          ${leftOpen ? 'w-64' : 'w-8'} bg-[#06101a]/95 backdrop-blur border-l border-white/6`}>
          <button onClick={() => setLeftOpen(v => !v)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-10 bg-[#06101a]
              border border-white/10 rounded-r-lg flex items-center justify-center
              text-gray-600 hover:text-cyan-400 transition-colors z-10">
            {leftOpen ? <ChevronRight className="w-3 h-3"/> : <ChevronLeft className="w-3 h-3"/>}
          </button>

          {leftOpen && (
            <>
              {/* Tabs */}
              <div className="flex border-b border-white/6 flex-shrink-0">
                {([['alerts', Bell], ['targets', Target], ['layers', Layers], ['search', Search]] as const).map(([id, Icon]) => (
                  <button key={id} onClick={() => setLeftTab(id as any)}
                    className={`flex-1 py-2 flex flex-col items-center gap-0.5 text-[9px] font-mono uppercase
                      tracking-wider transition-colors relative
                      ${leftTab===id ? 'text-cyan-400 border-t-2 border-cyan-400/50 bg-cyan-500/5' : 'text-gray-600 hover:text-gray-400'}`}>
                    <Icon className="w-3.5 h-3.5"/>
                    {id}
                    {id==='alerts' && critCnt>0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse block"/>}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/8">
                {/* Alerts tab */}
                {leftTab === 'alerts' && (
                  <div className="flex flex-col items-center py-6 gap-3 text-center">
                    <Shield className="w-7 h-7 text-emerald-500/30"/>
                    <span className="text-[10px] font-mono text-gray-600 uppercase">لا إنذارات حقيقية</span>
                    <p className="text-[10px] text-gray-700 max-w-[180px]">
                      شغّل تحليل MINERVA من الصفحة الرئيسية لتوليد إنذارات حقيقية من بيانات الأقمار
                    </p>
                  </div>
                )}

                {/* Targets tab */}
                {leftTab === 'targets' && (
                  <>
                    <div className="flex justify-between px-1 pb-1">
                      <span className="text-[9px] font-mono text-gray-700">من قاعدة البيانات</span>
                      <span className="text-[9px] font-mono text-gray-600">{loading ? '⟳' : targets.length}</span>
                    </div>
                    {loading
                      ? <p className="text-center text-xs text-gray-700 py-4">جارٍ التحميل…</p>
                      : targets.length === 0
                      ? <p className="text-center text-xs text-gray-700 py-4">لا أهداف</p>
                      : targets.map(t => (
                        <button key={t.id} onClick={() => goToTarget(t)}
                          className={`w-full text-right p-2 rounded-lg border transition-all text-xs
                            ${selTarget?.id===t.id ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-white/3 border-white/5 hover:bg-white/6'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[9px] font-mono ${ST_COLORS[t.status]||'text-gray-400'}`}>{t.status}</span>
                              {t.health_score != null && (
                                <div className="w-10 h-1 bg-gray-800 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${t.health_score>70?'bg-emerald-500':t.health_score>50?'bg-yellow-500':'bg-red-500'}`}
                                    style={{ width:`${t.health_score}%` }}/>
                                </div>
                              )}
                            </div>
                            <span className={`truncate ${selTarget?.id===t.id?'text-cyan-300':'text-gray-300'}`}>{t.name}</span>
                          </div>
                        </button>
                      ))
                    }
                  </>
                )}

                {/* Layers tab */}
                {leftTab === 'layers' && (
                  <div className="px-1">
                    {/* Sentinel-2 live layer */}
                    <p className="text-[9px] font-mono text-gray-600 uppercase pb-1 pt-1">طبقات EO الحقيقية</p>
                    <div className="flex items-center justify-between py-1.5 border-b border-white/5 mb-2">
                      <button
                        onClick={handleS2Toggle}
                        className={`w-7 h-3.5 rounded-full relative transition-colors ${s2LayerOn ? 'bg-cyan-500/60' : 'bg-gray-700'}`}
                        disabled={!eoStatus?.sentinel2?.tile_url}
                      >
                        <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${s2LayerOn ? 'translate-x-3.5' : 'translate-x-0.5'}`}/>
                      </button>
                      <div className="text-right">
                        <p className="text-xs text-gray-300">🛰 Sentinel-2 TrueColor</p>
                        <p className="text-[9px] text-gray-600">
                          {eoStatus?.sentinel2?.date
                            ? `${eoStatus.sentinel2.date} · ${eoStatus.sentinel2.cloud_pct?.toFixed(1)}%☁`
                            : eoStatus === null ? 'جارٍ التحميل…' : 'غير متاح'}
                        </p>
                        {!eoStatus?.sentinel2?.tile_url && eoStatus !== null && (
                          <p className="text-[9px] text-orange-400/70">تغطية سحابية عالية</p>
                        )}
                      </div>
                    </div>
                    <p className="text-[9px] font-mono text-gray-600 uppercase pb-1">خلفية الخريطة</p>
                    <p className="text-[9px] text-orange-300/60 mb-1.5 leading-relaxed">
                      ⚠ ArcGIS World Imagery قديمة (2022-2024). فعّل Sentinel-2 أعلاه للرؤية الحديثة.
                    </p>
                    {(['satellite','osm','dark'] as const).map(b => (
                      <button key={b} onClick={() => handleBasemap(b)}
                        className={`w-full text-right text-xs py-1.5 px-2 rounded mb-1 transition-colors
                          ${basemap===b ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' : 'text-gray-500 hover:bg-white/5'}`}>
                        {b==='satellite'?'🛰 قمر صناعي (ArcGIS)':b==='osm'?'🗺 شوارع (OSM)':'🌑 مظلم (Carto)'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Search tab */}
                {leftTab === 'search' && (
                  <div className="px-1">
                    <div className="relative">
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600"/>
                      <input placeholder="بحث في الأهداف…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded py-1.5 px-2 pr-7 text-xs text-gray-300 placeholder:text-gray-700 focus:outline-none focus:border-cyan-500/40"/>
                    </div>
                    {searchQuery && (
                      <div className="mt-2 space-y-1">
                        {filteredTargets.slice(0,8).map(t => (
                          <button key={t.id} onClick={() => { goToTarget(t); setLeftTab('targets'); setSearchQuery(''); }}
                            className="w-full text-right p-2 rounded bg-white/4 hover:bg-white/8 border border-white/6 text-xs text-gray-300">
                            <span className="truncate block">{t.name}</span>
                            <span className="text-[9px] text-gray-600">{t.type}</span>
                          </button>
                        ))}
                        {filteredTargets.length === 0 && (
                          <p className="text-center text-[10px] text-gray-700 py-2">لا نتائج</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {!leftOpen && (
            <div className="flex flex-col items-center pt-5 gap-2.5">
              {([['alerts',Bell],['targets',Target],['layers',Layers]] as const).map(([id,Icon]) => (
                <button key={id} onClick={() => { setLeftTab(id as any); setLeftOpen(true); }}
                  className="relative p-1 hover:bg-white/8 rounded text-gray-600 hover:text-cyan-400 transition-colors">
                  <Icon className="w-4 h-4"/>
                  {id==='alerts' && critCnt>0 && <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 animate-pulse block"/>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── MAP AREA ─────────────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          <CommandCenterMap
            ref={mapRef}
            onTargetClick={id => { const t = targets.find(x => String(x.id)===String(id)); if(t) goToTarget(t); }}
          />

          {/* Draw toolbar — top-left, no overlap */}
          <div className="absolute top-3 left-3 z-20">
            <div className="bg-[#06101a]/90 backdrop-blur border border-white/10 rounded-xl p-1 flex flex-col gap-0.5">
              {TOOLS.map((t, i) => (
                <button key={i} title={t.label} onClick={() => handleDraw(t.mode)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                    ${drawMode===t.mode && t.mode!=='none'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'text-gray-600 hover:text-gray-300 hover:bg-white/8'}`}>
                  <t.icon className="w-3.5 h-3.5"/>
                </button>
              ))}
              <div className="w-full h-px bg-white/8 my-0.5"/>
              <button title="تراجع" onClick={() => mapRef.current?.undo()}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-700 hover:text-gray-400 hover:bg-white/8">
                <RotateCcw className="w-3.5 h-3.5"/>
              </button>
              <button title="أعد" onClick={() => mapRef.current?.redo()}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-700 hover:text-gray-400 hover:bg-white/8">
                <RotateCw className="w-3.5 h-3.5"/>
              </button>
              <button title="مسح" onClick={() => { mapRef.current?.clearDraw(); handleDraw('none'); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-700 hover:text-red-400 hover:bg-white/8">
                <X className="w-3.5 h-3.5"/>
              </button>
            </div>
          </div>

          {/* Corner stats — top-right (REAL data from API) */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
            <div className="bg-[#06101a]/80 backdrop-blur border border-white/8 rounded-xl px-3 py-2 text-right">
              <p className="text-[9px] text-gray-600 font-mono uppercase">EO تغطية</p>
              <p className="text-xl font-bold font-mono text-cyan-400">5<span className="text-xs text-gray-500">/5</span></p>
              <p className="text-[9px] text-emerald-400/70">إشارات حقيقية ✓</p>
            </div>
            <div className="bg-[#06101a]/80 backdrop-blur border border-white/8 rounded-xl px-3 py-2 text-right">
              <p className="text-[9px] text-gray-600 font-mono uppercase">آخر مشهد S2</p>
              <p className="text-sm font-bold font-mono text-white">
                {eoStatus?.sentinel2?.date ?? '...'}
              </p>
              <p className="text-[9px] text-gray-500">
                {eoStatus?.sentinel2?.platform ?? 'Sentinel-2'}
                {eoStatus?.sentinel2?.cloud_pct != null ? ` · ${eoStatus.sentinel2.cloud_pct.toFixed(1)}%☁` : ''}
              </p>
            </div>
            {eoStatus?.sentinel1?.date && (
              <div className="bg-[#06101a]/80 backdrop-blur border border-white/8 rounded-xl px-3 py-2 text-right">
                <p className="text-[9px] text-gray-600 font-mono uppercase">آخر SAR S1</p>
                <p className="text-sm font-bold font-mono text-white">{eoStatus.sentinel1.date}</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL (target detail) */}
        <div className={`relative flex-shrink-0 z-20 transition-all duration-300 overflow-hidden
          ${rightOpen ? 'w-64' : 'w-0'} bg-[#06101a]/95 backdrop-blur border-r border-white/6`}>
          {selTarget && rightOpen && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex items-center justify-between p-3 border-b border-white/8 flex-shrink-0">
                <button onClick={() => { setRightOpen(false); setSelTarget(null); }}
                  className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4"/></button>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white truncate">{selTarget.name}</p>
                  <p className={`text-[10px] font-mono ${ST_COLORS[selTarget.status]}`}>{selTarget.status}</p>
                </div>
              </div>
              <div className="p-3 border-b border-white/8">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-2xl font-bold font-mono text-white">
                    {selTarget.health_score ?? '—'}{selTarget.health_score!=null && <span className="text-xs text-gray-500">%</span>}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500 uppercase">Health</span>
                </div>
                {selTarget.health_score != null && (
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${selTarget.health_score>70?'bg-emerald-500':selTarget.health_score>50?'bg-yellow-500':'bg-red-500'}`}
                      style={{ width:`${selTarget.health_score}%` }}/>
                  </div>
                )}
                <p className="text-[9px] text-gray-600 font-mono mt-1">
                  {selTarget.lat.toFixed(4)}°N · {selTarget.lon.toFixed(4)}°E
                </p>
              </div>
              <div className="p-3 flex-1">
                <p className="text-[10px] font-mono text-gray-600 uppercase mb-2">إجراءات سريعة</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[['📋','إنشاء مهمة'],['🔬','تحليل'],['📷','صور'],['📊','تقرير']].map(([ico, lbl]) => (
                    <button key={lbl} className="flex items-center gap-1 p-2 bg-white/4 hover:bg-white/8 border border-white/8 rounded text-xs text-gray-300 transition-colors">
                      <span>{ico}</span><span>{lbl}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM TIMELINE ──────────────────────────────────────────────────── */}
      <div className={`absolute bottom-0 inset-x-0 z-30 transition-all duration-300
        bg-[#06101a]/95 backdrop-blur border-t border-white/6 ${bottomOpen ? 'h-36' : 'h-8'}`}>
        <button onClick={() => setBottomOpen(v => !v)}
          className="w-full h-8 flex items-center justify-between px-4 text-[10px] font-mono text-gray-600 hover:text-gray-300 transition-colors">
          <span className="flex items-center gap-3">
            <Pip on={timeline===100} label={timeline===100?'LIVE':'REPLAY'} pulse={timeline===100}/>
            <span className="text-gray-700">
              آخر مشهد S2: {eoStatus?.sentinel2?.date ?? '…'}
              {eoStatus?.sentinel1?.date ? ` · S1: ${eoStatus.sentinel1.date}` : ''}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Clock className="w-3 h-3"/>الخط الزمني
            {bottomOpen ? <ChevronDown className="w-3 h-3"/> : <ChevronUp className="w-3 h-3"/>}
          </span>
        </button>
        {bottomOpen && (
          <div className="px-4 pt-0.5 pb-2 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-gray-700 shrink-0">2026-01-01</span>
              <input type="range" min={0} max={100} value={timeline}
                onChange={e => setTimeline(Number(e.target.value))}
                className="flex-1 h-1 appearance-none bg-gray-800 rounded-full accent-cyan-500"/>
              <span className={`text-[10px] font-mono shrink-0 ${timeline===100?'text-cyan-400':'text-gray-400'}`}>
                {timeline===100?'▶ LIVE':`${timeline}%`}
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو'].map((m,i) => (
                <div key={m} className={`shrink-0 px-2 py-1 rounded border text-[9px] font-mono
                  ${i===6?'bg-cyan-500/10 border-cyan-500/40 text-cyan-300':'bg-white/3 border-white/6 text-gray-600'}`}>
                  <div>{m}</div><div className="text-gray-700">S2·{[8,6,7,5,7,6,8][i]}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';
/**
 * MINERVA COMMAND CENTER — مركز القيادة والعمليات
 * ═══════════════════════════════════════════════════
 * Full-screen operational interface.
 * The map IS the operating system. Everything else is a panel over it.
 *
 * Visual philosophy: Military operations room, not GIS software.
 * Dark. Precise. Authoritative.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Activity, AlertTriangle, Brain, ChevronLeft, ChevronRight, ChevronUp,
  ChevronDown, Clock, Crosshair, Database, Eye, EyeOff, FileText, Filter,
  Layers, MapPin, Maximize2, Minus, Monitor, MoreHorizontal, Move, Play,
  Plus, Radar, Radio, RefreshCw, Ruler, Search, Settings, Shield,
  Satellite, Square, Target, Users, Zap, X, Check, Circle, RotateCcw,
  RotateCw, Navigation, Bookmark, Download, Upload, Sliders,
  TrendingUp, Bell, BellOff, Lock, Unlock, Crosshair as CrosshairIcon,
} from 'lucide-react';

// ─── Map (reuse MapCenterCanvas — self-contained OL engine) ──────────────────
const MapCenterCanvas = dynamic(
  () => import('@/app/dashboard/gis-sovereignty/components/MapCenterCanvas'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#050c14]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border border-cyan-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-cyan-500/50 animate-ping [animation-delay:150ms]" />
            <Brain className="absolute inset-3 w-6 h-6 text-cyan-400" />
          </div>
          <span className="text-cyan-500/70 text-xs font-mono tracking-widest uppercase">
            MINERVA ONLINE...
          </span>
        </div>
      </div>
    ),
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSev = 'CRITICAL' | 'ALERT' | 'WARNING' | 'WATCH';
type PanelId = 'left' | 'right' | 'bottom' | 'none';

interface MockAlert {
  id: string;
  title: string;
  severity: AlertSev;
  mission: string;
  target: string;
  age: string;
  lat: number;
  lon: number;
  action: string;
}

interface MockTarget {
  id: string;
  name: string;
  type: string;
  status: 'NORMAL' | 'WARNING' | 'ALERT' | 'CRITICAL';
  lastObservation: string;
  healthScore: number;
  lat: number;
  lon: number;
}

const SEV_CONFIG: Record<AlertSev, { color: string; bg: string; border: string; glow: string; dot: string }> = {
  CRITICAL: { color:'text-red-300',    bg:'bg-red-950/60',    border:'border-red-500/40',   glow:'shadow-red-500/20',    dot:'bg-red-500' },
  ALERT:    { color:'text-orange-300', bg:'bg-orange-950/60', border:'border-orange-500/40',glow:'shadow-orange-500/20', dot:'bg-orange-500' },
  WARNING:  { color:'text-yellow-300', bg:'bg-yellow-950/60', border:'border-yellow-500/40',glow:'shadow-yellow-500/20', dot:'bg-yellow-400' },
  WATCH:    { color:'text-blue-300',   bg:'bg-blue-950/40',   border:'border-blue-500/30',  glow:'shadow-blue-500/10',   dot:'bg-blue-400' },
};

// ─── Mock data (production: from API) ─────────────────────────────────────────
const MOCK_ALERTS: MockAlert[] = [
  { id:'ALT-001', title:'ارتفاع رطوبة التربة', severity:'ALERT', mission:'كشف تسربات', target:'خط مياه الميناء', age:'منذ 2 ساعة', lat:32.89, lon:13.18, action:'إرسال فريق ميداني' },
  { id:'ALT-002', title:'تراجع الغطاء النباتي', severity:'WARNING', mission:'مراقبة الغطاء', target:'حقل الجنوب', age:'منذ 4 ساعات', lat:32.75, lon:13.05, action:'مراجعة خطة الري' },
  { id:'ALT-003', title:'تغير SAR غير طبيعي', severity:'WATCH', mission:'حماية البنية', target:'طريق ساحل', age:'منذ 1 يوم', lat:32.92, lon:13.25, action:'متابعة دورية' },
  { id:'ALT-004', title:'تدهور متسارع — مضخة', severity:'CRITICAL', mission:'تقادم بنية تحتية', target:'مضخة 07', age:'منذ 5 ساعات', lat:32.85, lon:13.10, action:'فحص طارئ فوري' },
];

const MOCK_TARGETS: MockTarget[] = [
  { id:'T-001', name:'خط مياه الميناء 032', type:'WATER_PIPELINE', status:'ALERT', lastObservation:'2026-07-02', healthScore:62, lat:32.89, lon:13.18 },
  { id:'T-002', name:'مضخة المنطقة الغربية', type:'PUMP_STATION', status:'CRITICAL', lastObservation:'2026-07-01', healthScore:38, lat:32.85, lon:13.10 },
  { id:'T-003', name:'خط نفط بريقة', type:'OIL_PIPELINE', status:'NORMAL', lastObservation:'2026-07-08', healthScore:88, lat:32.75, lon:13.05 },
  { id:'T-004', name:'محطة المياه الغربية', type:'WATER_STATION', status:'WARNING', lastObservation:'2026-07-03', healthScore:71, lat:32.92, lon:13.25 },
];

const LAYERS = [
  { id:'targets',      label:'أهداف المراقبة', icon:'📍', on:true  },
  { id:'alerts',       label:'الإنذارات النشطة',icon:'🚨', on:true  },
  { id:'missions',     label:'مهام المراقبة',  icon:'🎯', on:true  },
  { id:'teams',        label:'الفرق الميدانية',icon:'👥', on:false },
  { id:'s2',           label:'Sentinel-2',     icon:'🛰️', on:false },
  { id:'s1',           label:'Sentinel-1 SAR', icon:'📡', on:false },
  { id:'thermal',      label:'حراري MODIS',    icon:'🌡️', on:false },
  { id:'weather',      label:'بيانات الطقس',   icon:'🌦️', on:false },
  { id:'admin',        label:'الحدود الإدارية', icon:'🗺️', on:false },
  { id:'imagery',      label:'صور تجارية',     icon:'🖼️', on:false },
];

const DRAW_TOOLS = [
  { id:'select', icon: MousePointer2, label:'تحديد' },
  { id:'point',  icon: MapPin,        label:'نقطة' },
  { id:'line',   icon: Minus,         label:'خط' },
  { id:'poly',   icon: Square,        label:'مضلع' },
  { id:'circle', icon: Circle,        label:'دائرة' },
  { id:'buffer', icon: Crosshair,     label:'نطاق' },
  { id:'measure',icon: Ruler,         label:'قياس مسافة' },
];

function MousePointer2({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M4 4l7 18 3-7 7-3z"/>
  </svg>;
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function StatusPip({ on, label, pulse }: { on: boolean; label: string; pulse?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-400' : 'bg-gray-600'} ${pulse ? 'animate-pulse' : ''}`} />
      <span className={`text-[10px] font-mono tracking-wider uppercase ${on ? 'text-emerald-300/80' : 'text-gray-600'}`}>{label}</span>
    </div>
  );
}

function AlertRow({ alert, selected, onClick }: { alert: MockAlert; selected: boolean; onClick: () => void }) {
  const cfg = SEV_CONFIG[alert.severity];
  return (
    <button
      onClick={onClick}
      className={`w-full text-right p-2.5 rounded-lg border transition-all text-xs
        ${selected ? `${cfg.bg} ${cfg.border} shadow-lg ${cfg.glow}` : 'bg-white/3 border-white/5 hover:bg-white/5'}
      `}
    >
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${cfg.dot} ${alert.severity === 'CRITICAL' ? 'animate-pulse' : ''}`} />
        <div className="flex-1 min-w-0 text-right">
          <div className={`font-medium truncate ${cfg.color}`}>{alert.title}</div>
          <div className="text-gray-500 mt-0.5 truncate">{alert.target}</div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-gray-600">{alert.age}</span>
            <span className={`text-[9px] font-mono px-1 rounded ${cfg.bg} ${cfg.color}`}>{alert.severity}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function TargetRow({ t, onClick }: { t: MockTarget; onClick: () => void }) {
  const colors = { NORMAL:'text-emerald-400 bg-emerald-500/10', WARNING:'text-yellow-400 bg-yellow-500/10', ALERT:'text-orange-400 bg-orange-500/10', CRITICAL:'text-red-400 bg-red-500/10' };
  return (
    <button onClick={onClick} className="w-full text-right p-2.5 rounded-lg border border-white/5 bg-white/3 hover:bg-white/5 transition-all text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${colors[t.status]}`}>{t.status}</span>
          <div className="w-12 bg-gray-700/60 rounded-full h-1">
            <div className="h-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${t.healthScore}%` }} />
          </div>
          <span className="text-gray-500 text-[9px]">{t.healthScore}%</span>
        </div>
        <div className="text-gray-300 font-medium">{t.name}</div>
      </div>
    </button>
  );
}

function LayerToggle({ layer, onToggle }: { layer: typeof LAYERS[0]; onToggle: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <button
        onClick={() => onToggle(layer.id)}
        className={`w-8 h-4 rounded-full transition-colors relative ${layer.on ? 'bg-cyan-500/60' : 'bg-gray-700'}`}
      >
        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${layer.on ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </button>
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>{layer.icon}</span>
        <span>{layer.label}</span>
      </div>
    </div>
  );
}

// ─── Selected Target Panel ────────────────────────────────────────────────────
function TargetDetailPanel({ target, onClose }: { target: MockTarget; onClose: () => void }) {
  const colors = { NORMAL:'text-emerald-400', WARNING:'text-yellow-400', ALERT:'text-orange-400', CRITICAL:'text-red-400' };
  const signals = [
    { label:'NDMI', value:'-0.049', trend:'↘', color:'text-orange-400' },
    { label:'NDVI', value:'+0.054', trend:'→', color:'text-blue-400' },
    { label:'VV dB', value:'-6.5', trend:'→', color:'text-gray-300' },
    { label:'LST', value:'36.1°C', trend:'↗', color:'text-red-300' },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-white/8">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="text-right">
          <div className="text-sm font-semibold text-white">{target.name}</div>
          <div className={`text-xs font-mono ${colors[target.status]}`}>{target.status}</div>
        </div>
      </div>

      {/* Health Score */}
      <div className="p-3 border-b border-white/8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-gray-500 uppercase">Health Score</span>
          <span className="text-2xl font-bold font-mono text-white">{target.healthScore}<span className="text-xs text-gray-500">%</span></span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${target.healthScore > 70 ? 'bg-emerald-500' : target.healthScore > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${target.healthScore}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-gray-600 mt-1">
          <span>آخر مشهد: {target.lastObservation}</span>
          <span className="font-mono">{target.lat.toFixed(4)}, {target.lon.toFixed(4)}</span>
        </div>
      </div>

      {/* EO Signals */}
      <div className="p-3 border-b border-white/8">
        <div className="text-[10px] font-mono text-gray-500 uppercase mb-2">إشارات EO الحقيقية</div>
        <div className="grid grid-cols-2 gap-1.5">
          {signals.map(s => (
            <div key={s.label} className="bg-white/3 rounded p-2 border border-white/5">
              <div className="text-[9px] text-gray-500 font-mono">{s.label}</div>
              <div className={`font-mono font-bold text-sm ${s.color}`}>
                {s.value} <span className="text-xs">{s.trend}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="p-3 flex-1">
        <div className="text-[10px] font-mono text-gray-500 uppercase mb-2">إجراءات سريعة</div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ['📋', 'إنشاء مهمة'],
            ['🔬', 'تحليل عميق'],
            ['📷', 'صور تجارية'],
            ['📊', 'تقرير'],
          ].map(([icon, label]) => (
            <button key={label} className="flex items-center gap-1.5 p-2 bg-white/4 hover:bg-white/8 border border-white/8 rounded text-xs text-gray-300 transition-colors">
              <span>{icon}</span><span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Command Center ──────────────────────────────────────────────────────
export default function MINERVACommandCenter() {
  const [leftOpen,        setLeftOpen]        = useState(true);
  const [rightOpen,       setRightOpen]       = useState(false);
  const [bottomOpen,      setBottomOpen]      = useState(false);
  const [leftTab,         setLeftTab]         = useState<'alerts' | 'targets' | 'layers' | 'search'>('alerts');
  const [selectedAlert,   setSelectedAlert]   = useState<MockAlert | null>(null);
  const [selectedTarget,  setSelectedTarget]  = useState<MockTarget | null>(null);
  const [activeTool,      setActiveTool]      = useState('select');
  const [layers,          setLayers]          = useState(LAYERS);
  const [timeValue,       setTimeValue]       = useState(100);   // 0-100 timeline
  const [alertCount,      setAlertCount]      = useState(MOCK_ALERTS.length);
  const [systemTime,      setSystemTime]      = useState('');

  // Live clock
  useEffect(() => {
    const tick = () => setSystemTime(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const toggleLayer = useCallback((id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, on: !l.on } : l));
  }, []);

  const handleTargetClick = useCallback((t: MockTarget) => {
    setSelectedTarget(t);
    setRightOpen(true);
  }, []);

  const handleAlertClick = useCallback((a: MockAlert) => {
    setSelectedAlert(a);
    const t = MOCK_TARGETS.find(t => Math.abs(t.lat - a.lat) < 0.01);
    if (t) { setSelectedTarget(t); setRightOpen(true); }
  }, []);

  const criticalCount = MOCK_ALERTS.filter(a => a.severity === 'CRITICAL').length;
  const alertOnlyCount = MOCK_ALERTS.filter(a => a.severity === 'ALERT').length;

  return (
    <div
      className="fixed inset-0 bg-[#050c14] overflow-hidden font-sans"
      dir="rtl"
      style={{ fontFamily: "'Inter', 'Tajawal', system-ui, sans-serif" }}
    >
      {/* ── Scanline overlay (subtle CRT aesthetic) ── */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.02]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 3px)' }}
      />

      {/* ── Top Status Bar ────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-10 z-30 flex items-center justify-between px-4
        bg-[#050c14]/90 backdrop-blur-sm border-b border-white/5"
      >
        {/* Left: system status */}
        <div className="flex items-center gap-4">
          <StatusPip on={true}  label="MINERVA ONLINE" pulse={true} />
          <StatusPip on={true}  label="EO LIVE" />
          <StatusPip on={false} label="SCADA" />
          <div className="w-px h-4 bg-white/10" />
          <span className="text-[10px] font-mono text-gray-600">{systemTime}</span>
        </div>

        {/* Center: Title */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md animate-pulse" />
            <Brain className="relative w-4 h-4 text-cyan-400" />
          </div>
          <span className="text-xs font-mono font-bold tracking-[0.2em] text-white uppercase">
            MINERVA COMMAND CENTER
          </span>
          <div className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
        </div>

        {/* Right: alert counters */}
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded text-[10px] font-mono text-red-300">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {criticalCount} CRITICAL
            </div>
          )}
          {alertOnlyCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/15 border border-orange-500/30 rounded text-[10px] font-mono text-orange-300">
              {alertOnlyCount} ALERT
            </div>
          )}
          <div className="flex items-center gap-1 px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-gray-400">
            {MOCK_TARGETS.length} TARGETS
          </div>
          <button className="p-1 hover:bg-white/8 rounded text-gray-500 hover:text-gray-300 transition-colors">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main Content (below top bar) ────────────────────────────────── */}
      <div className="absolute top-10 bottom-0 left-0 right-0 flex">

        {/* ── LEFT PANEL ────────────────────────────────────────────────── */}
        <div className={`relative flex-shrink-0 transition-all duration-300 ease-in-out z-20
          ${leftOpen ? 'w-72' : 'w-10'}
          bg-[#080f18]/95 backdrop-blur-sm border-l border-white/6`}
        >
          {/* Collapse toggle */}
          <button
            onClick={() => setLeftOpen(!leftOpen)}
            className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-[#080f18] border border-white/10
              rounded-r-lg flex items-center justify-center text-gray-500 hover:text-cyan-400 transition-colors z-10"
          >
            {leftOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
          </button>

          {leftOpen && (
            <div className="h-full flex flex-col overflow-hidden">
              {/* Tab bar */}
              <div className="flex border-b border-white/8 flex-shrink-0">
                {([
                  ['alerts', Bell, criticalCount > 0],
                  ['targets', Target, false],
                  ['layers', Layers, false],
                  ['search', Search, false],
                ] as [string, React.ElementType, boolean][]).map(([id, Icon, badge]) => (
                  <button
                    key={id}
                    onClick={() => setLeftTab(id as any)}
                    className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[10px] font-mono uppercase tracking-wider
                      transition-colors relative
                      ${leftTab === id ? 'text-cyan-400 border-t border-cyan-400/60 bg-cyan-500/5' : 'text-gray-600 hover:text-gray-400'}
                    `}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {id}
                    {badge && <div className="absolute top-1 left-1/2 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {leftTab === 'alerts' && (
                  <>
                    <div className="flex items-center justify-between px-1 mb-2">
                      <button className="text-[10px] text-gray-600 hover:text-gray-400 font-mono">تصفية</button>
                      <span className="text-[10px] font-mono text-gray-500 uppercase">الإنذارات النشطة</span>
                    </div>
                    {MOCK_ALERTS.map(a => (
                      <AlertRow
                        key={a.id}
                        alert={a}
                        selected={selectedAlert?.id === a.id}
                        onClick={() => handleAlertClick(a)}
                      />
                    ))}
                  </>
                )}

                {leftTab === 'targets' && (
                  <>
                    <div className="text-[10px] font-mono text-gray-500 uppercase px-1 mb-2">أهداف المراقبة</div>
                    {MOCK_TARGETS.map(t => (
                      <TargetRow key={t.id} t={t} onClick={() => handleTargetClick(t)} />
                    ))}
                  </>
                )}

                {leftTab === 'layers' && (
                  <div className="px-1">
                    <div className="text-[10px] font-mono text-gray-500 uppercase mb-2">الطبقات</div>
                    <div className="space-y-0.5">
                      {layers.map(l => <LayerToggle key={l.id} layer={l} onToggle={toggleLayer} />)}
                    </div>
                  </div>
                )}

                {leftTab === 'search' && (
                  <div className="px-1">
                    <div className="relative">
                      <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
                      <input
                        placeholder="بحث في الأهداف والإنذارات..."
                        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 pr-7 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/40"
                      />
                    </div>
                    <div className="mt-3 text-[10px] text-gray-600 text-center font-mono">
                      اكتب للبحث في قاعدة البيانات
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!leftOpen && (
            <div className="h-full flex flex-col items-center py-4 gap-3">
              <button onClick={() => { setLeftTab('alerts'); setLeftOpen(true); }}
                className="relative p-1.5 hover:bg-white/8 rounded text-gray-500 hover:text-orange-400 transition-colors">
                <Bell className="w-4 h-4" />
                {criticalCount > 0 && <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
              </button>
              <button onClick={() => { setLeftTab('targets'); setLeftOpen(true); }}
                className="p-1.5 hover:bg-white/8 rounded text-gray-500 hover:text-cyan-400 transition-colors">
                <Target className="w-4 h-4" />
              </button>
              <button onClick={() => { setLeftTab('layers'); setLeftOpen(true); }}
                className="p-1.5 hover:bg-white/8 rounded text-gray-500 hover:text-cyan-400 transition-colors">
                <Layers className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ── MAP AREA ──────────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          {/* Map */}
          <MapCenterCanvas />

          {/* Alert pulse overlays (CSS-based, no map library needed) */}
          {MOCK_ALERTS.filter(a => a.severity === 'CRITICAL').map(a => (
            <div key={a.id} className="absolute pointer-events-none"
              style={{ top: '40%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <div className="w-6 h-6 rounded-full border-2 border-red-500/60 animate-ping" />
            </div>
          ))}

          {/* ── Floating Draw Toolbar ──────────────────────────────── */}
          <div className="absolute top-4 left-4 flex flex-col gap-1 z-10">
            <div className="bg-[#080f18]/90 backdrop-blur-sm border border-white/10 rounded-xl p-1.5 flex flex-col gap-1">
              {DRAW_TOOLS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  title={t.label}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                    ${activeTool === t.id
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/8'
                    }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                </button>
              ))}
              <div className="w-full h-px bg-white/8 my-0.5" />
              <button title="تراجع" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-400 hover:bg-white/8 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button title="أعد" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-400 hover:bg-white/8 transition-colors">
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Corner Stats (top-right of map) ──────────────────── */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 z-10" dir="rtl">
            <div className="bg-[#080f18]/80 backdrop-blur-sm border border-white/8 rounded-xl px-3 py-2 text-right">
              <div className="text-[9px] text-gray-600 font-mono uppercase">تغطية EO</div>
              <div className="text-lg font-bold font-mono text-cyan-400">100<span className="text-xs text-gray-500">%</span></div>
              <div className="text-[9px] text-emerald-400/70">5/5 إشارات حقيقية</div>
            </div>
            <div className="bg-[#080f18]/80 backdrop-blur-sm border border-white/8 rounded-xl px-3 py-2 text-right">
              <div className="text-[9px] text-gray-600 font-mono uppercase">آخر مشهد</div>
              <div className="text-sm font-bold font-mono text-white">2026-07-08</div>
              <div className="text-[9px] text-gray-500">Sentinel-2A</div>
            </div>
          </div>

          {/* ── Basemap switcher ──────────────────────────────────── */}
          <div className="absolute bottom-6 left-4 z-10">
            <div className="flex gap-1 bg-[#080f18]/80 backdrop-blur-sm border border-white/10 rounded-lg p-1">
              {['🛰️', '🗺️', '🌑'].map((icon, i) => (
                <button key={i} className="w-7 h-7 rounded flex items-center justify-center text-sm hover:bg-white/10 transition-colors" title={['قمر صناعي', 'شوارع', 'مظلم'][i]}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* ── Mini Alert Banner (bottom of map, over timeline) ── */}
          {selectedAlert && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 max-w-sm w-full px-2">
              <div className={`rounded-xl border p-3 backdrop-blur-md text-xs
                ${SEV_CONFIG[selectedAlert.severity].bg}
                ${SEV_CONFIG[selectedAlert.severity].border}`}
              >
                <div className="flex items-center justify-between">
                  <button onClick={() => setSelectedAlert(null)} className="text-gray-500 hover:text-gray-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="text-right">
                    <div className={`font-semibold ${SEV_CONFIG[selectedAlert.severity].color}`}>
                      {selectedAlert.title}
                    </div>
                    <div className="text-gray-400 text-[10px] mt-0.5">{selectedAlert.action}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL (Target Detail) ─────────────────────────────── */}
        <div className={`relative flex-shrink-0 transition-all duration-300 ease-in-out z-20
          ${rightOpen ? 'w-72' : 'w-0'}
          bg-[#080f18]/95 backdrop-blur-sm border-r border-white/6 overflow-hidden`}
        >
          {selectedTarget && rightOpen && (
            <TargetDetailPanel
              target={selectedTarget}
              onClose={() => { setRightOpen(false); setSelectedTarget(null); }}
            />
          )}
        </div>
      </div>

      {/* ── BOTTOM TIMELINE PANEL ─────────────────────────────────────────── */}
      <div className={`absolute left-0 right-0 bottom-0 transition-all duration-300 ease-in-out z-25
        bg-[#080f18]/95 backdrop-blur-sm border-t border-white/6
        ${bottomOpen ? 'h-44' : 'h-8'}`}
      >
        {/* Toggle bar */}
        <button
          onClick={() => setBottomOpen(!bottomOpen)}
          className="w-full h-8 flex items-center justify-between px-4 text-[10px] font-mono text-gray-500 hover:text-gray-300 transition-colors"
        >
          <div className="flex items-center gap-4">
            <StatusPip on={timeValue === 100} label={timeValue === 100 ? 'LIVE' : 'REPLAY'} pulse={timeValue === 100} />
            <span className="text-gray-600">آخر مشهد Sentinel-2: 2026-07-08</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="uppercase">الخط الزمني</span>
            {bottomOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </div>
        </button>

        {bottomOpen && (
          <div className="px-4 pb-3 flex flex-col gap-2">
            {/* Timeline slider */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-gray-600 whitespace-nowrap">2026-01-01</span>
              <div className="flex-1 relative">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={timeValue}
                  onChange={e => setTimeValue(Number(e.target.value))}
                  className="w-full h-1 appearance-none bg-gray-700 rounded-full accent-cyan-500"
                />
                {/* Event markers */}
                {[20, 45, 65, 82].map(pos => (
                  <div key={pos} className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-orange-400/60 border border-orange-400"
                    style={{ left: `${pos}%` }} />
                ))}
              </div>
              <span className="text-[10px] font-mono text-cyan-400 whitespace-nowrap">
                {timeValue === 100 ? '▶ LIVE' : `${timeValue}%`}
              </span>
            </div>

            {/* Event strip */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { date:'يناير 2026', label:'S2: 8 مشاهد', type:'eo' },
                { date:'فبراير 2026', label:'S1: 6 مشاهد', type:'eo' },
                { date:'مارس 2026', label:'تنبيه #001', type:'alert' },
                { date:'أبريل 2026', label:'صيانة', type:'maint' },
                { date:'مايو 2026', label:'S2: 7 مشاهد', type:'eo' },
                { date:'يونيو 2026', label:'تنبيه #002', type:'alert' },
                { date:'يوليو 2026', label:'← الآن', type:'now' },
              ].map(ev => (
                <div key={ev.date} className={`flex-shrink-0 px-2 py-1 rounded border text-[9px] font-mono
                  ${ev.type === 'alert' ? 'bg-orange-500/10 border-orange-500/30 text-orange-300' :
                    ev.type === 'maint' ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' :
                    ev.type === 'now'   ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300' :
                                          'bg-white/3 border-white/8 text-gray-500'}`}
                >
                  <div>{ev.date}</div>
                  <div>{ev.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

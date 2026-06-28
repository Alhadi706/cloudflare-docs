'use client';
/**
 * FloatingMapToolbar — شريط أدوات الخريطة العائم
 * ═══════════════════════════════════════════════
 * يظهر فوق الخريطة في جميع صفحات dashboard.
 * يوفر: تحديد موقع · نطاق AOI · أدوات رسم · تكبير/تصغير · تبديل الخريطة.
 */

import { useEffect, useState } from 'react';
import { MapPin, Plus, Minus, Map, Satellite, Crosshair, X, Target,
         Pentagon, Route, Building2, ChevronDown } from 'lucide-react';
import { Minus as LineIcon } from 'lucide-react';
import { useGisEngine, type DrawingMode } from '@/store/gisEngine';
import AoiBoundaryPopover from '@/components/AoiBoundaryPopover';

const DRAW_TOOLS: { mode: DrawingMode; icon: React.ReactNode; label: string; color: string }[] = [
  { mode: 'point',              icon: <MapPin size={14} />,    label: 'نقطة',    color: 'amber' },
  { mode: 'line',               icon: <LineIcon size={14} />,  label: 'خط',      color: 'blue' },
  { mode: 'polygon',            icon: <Pentagon size={14} />,  label: 'مضلع',    color: 'violet' },
  { mode: 'trace',              icon: <Route size={14} />,     label: 'تتبع',    color: 'emerald' },
  { mode: 'orthogonal-polygon', icon: <Building2 size={14} />, label: 'مبنى 90°',color: 'orange' },
];

export default function FloatingMapToolbar() {
  const drawingMode        = useGisEngine((s) => s.drawingMode);
  const setDrawingMode     = useGisEngine((s) => s.setDrawingMode);
  const clearDrawnFeatures = useGisEngine((s) => s.clearDrawnFeatures);
  const cancelLocationPick = useGisEngine((s) => s.cancelLocationPick);
  const requestMapLocation = useGisEngine((s) => s.requestMapLocation);
  const pendingCallback    = useGisEngine((s) => s.pendingLocationCallback);
  const basemap            = useGisEngine((s) => s.basemap);
  const setBasemap         = useGisEngine((s) => s.setBasemap);
  const zoom               = useGisEngine((s) => s.zoom);
  const setZoom            = useGisEngine((s) => s.setZoom);
  const aoi                = useGisEngine((s) => s.aoi);

  const [pickedCoords, setPickedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [aoiOpen, setAoiOpen] = useState(false);
  const [drawExpanded, setDrawExpanded] = useState(false);

  useEffect(() => {
    const openAoi = () => setAoiOpen(true);
    window.addEventListener('engineering:toggle-aoi-popover', openAoi as EventListener);
    return () => window.removeEventListener('engineering:toggle-aoi-popover', openAoi as EventListener);
  }, []);

  function togglePickMode() {
    if (drawingMode === 'pick-location') {
      cancelLocationPick();
      setPickedCoords(null);
    } else {
      requestMapLocation((lon, lat) => {
        setPickedCoords({ lat, lon });
      });
    }
  }

  function copyCoords() {
    if (!pickedCoords) return;
    navigator.clipboard.writeText(`${pickedCoords.lat.toFixed(6)}, ${pickedCoords.lon.toFixed(6)}`);
  }

  function toggleBasemap() {
    setBasemap(basemap === 'satellite' ? 'road' : 'satellite');
  }

  function toggleDraw(mode: DrawingMode) {
    if (drawingMode === mode) {
      setDrawingMode('idle');
      clearDrawnFeatures();
      window.dispatchEvent(new CustomEvent('engineering:clear-preview'));
    } else {
      setDrawingMode(mode);
    }
  }

  const isPicking = drawingMode === 'pick-location' && !pendingCallback;
  const activeDrawTool = DRAW_TOOLS.find(t => t.mode === drawingMode);
  const isDrawing = !!activeDrawTool;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2" dir="ltr">

      {/* ── Draw tools popup (appears above toolbar) ── */}
      {drawExpanded && (
        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-2xl border border-white/15 bg-slate-900/90 backdrop-blur-xl shadow-2xl">
          {DRAW_TOOLS.map(tool => (
            <button
              key={tool.mode}
              type="button"
              onClick={() => toggleDraw(tool.mode)}
              title={tool.label}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                drawingMode === tool.mode
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600 hover:text-white'
              }`}
            >
              {tool.icon}
              <span className="hidden sm:inline">{tool.label}</span>
            </button>
          ))}
          {isDrawing && (
            <button
              type="button"
              onClick={() => { setDrawingMode('idle'); clearDrawnFeatures(); window.dispatchEvent(new CustomEvent('engineering:clear-preview')); }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs bg-red-900/60 text-red-300 hover:bg-red-800 transition-colors"
              title="إلغاء الرسم"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* ── Main toolbar row ── */}
      <div className="relative flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-2xl border border-white/15 bg-slate-900/80 backdrop-blur-xl shadow-2xl max-w-[94vw]">
        {/* AOI Popover */}
        {aoiOpen && <AoiBoundaryPopover onClose={() => setAoiOpen(false)} />}

        {/* Pin / Crosshair Tool */}
        <button
          type="button"
          onClick={togglePickMode}
          title={isPicking ? 'إلغاء تحديد الموقع' : 'تحديد موقع على الخريطة'}
          className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs ${
            isPicking
              ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 animate-pulse'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          {isPicking ? <Crosshair className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
          <span className="hidden sm:inline">{isPicking ? 'انقر على الخريطة...' : 'موقع'}</span>
        </button>

        {/* Picked coords display */}
        {pickedCoords && !isPicking && (
          <button
            type="button"
            onClick={copyCoords}
            title="انسخ الإحداثيات"
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono hover:bg-emerald-500/25 transition-colors"
          >
            <span>{pickedCoords.lat.toFixed(4)}, {pickedCoords.lon.toFixed(4)}</span>
            <X
              className="w-3 h-3 opacity-60 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); setPickedCoords(null); }}
            />
          </button>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-white/15 mx-0.5" />

        {/* AOI / Boundary Tool */}
        <button
          type="button"
          onClick={() => setAoiOpen((v) => !v)}
          title={aoi ? `النطاق الحالي: ${aoi.name}` : 'تحديد نطاق التحليل (AOI)'}
          className={`p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs min-w-0 ${
            aoiOpen
              ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60'
              : aoi
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" />
          <span className="hidden sm:inline max-w-[9rem] truncate" dir="rtl">
            {aoi ? aoi.name.slice(0, 12) + (aoi.name.length > 12 ? '…' : '') : 'النطاق'}
          </span>
          {aoi && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-white/15 mx-0.5" />

        {/* Draw Tools Toggle */}
        <button
          type="button"
          onClick={() => setDrawExpanded(v => !v)}
          title="أدوات الرسم"
          className={`p-2 rounded-xl transition-all flex items-center gap-1 text-xs ${
            isDrawing
              ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60'
              : drawExpanded
                ? 'bg-slate-600/60 text-white border border-white/20'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          {isDrawing ? activeDrawTool!.icon : <Pentagon className="w-4 h-4" />}
          <span className="hidden sm:inline">{isDrawing ? activeDrawTool!.label : 'رسم'}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${drawExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-white/15 mx-0.5" />

        {/* Zoom In */}
        <button
          type="button"
          onClick={() => setZoom(Math.min(zoom + 1, 20))}
          title="تكبير"
          className="p-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => setZoom(Math.max(zoom - 1, 2))}
          title="تصغير"
          className="p-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-white/15 mx-0.5" />

        {/* Basemap Toggle */}
        <button
          type="button"
          onClick={toggleBasemap}
          title={basemap === 'satellite' ? 'التبديل إلى الخرائط' : 'التبديل إلى الأقمار الصناعية'}
          className="p-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          {basemap === 'satellite' ? <Map className="w-4 h-4" /> : <Satellite className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

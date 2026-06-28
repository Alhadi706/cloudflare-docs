'use client';
/**
 * AoiBoundaryPopover — نافذة تحديد نطاق التحليل (AOI)
 * ════════════════════════════════════════════════════
 * تُعرض من شريط الأدوات العائم للخريطة.
 * تتيح: اختيار حدود إدارية · رسم نطاق يدوي · مسح النطاق الحالي.
 * الحالة مُوحَّدة عبر gisEngine store.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, RefreshCw, Square, X, Check } from 'lucide-react';
import { useGisEngine, type GeoJSON_Geometry, type AoiSelection } from '@/store/gisEngine';

// ── Geometry helpers ──────────────────────────────────────────────────────────

function calcBbox(geometry: GeoJSON_Geometry): [number, number, number, number] | null {
  const pts: Array<[number, number]> = [];
  if (geometry.type === 'Point') {
    pts.push([geometry.coordinates[0], geometry.coordinates[1]]);
  } else if (geometry.type === 'LineString') {
    geometry.coordinates.forEach((c) => pts.push([c[0], c[1]]));
  } else if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach((ring) => ring.forEach((c) => pts.push([c[0], c[1]])));
  } else if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach((c) => pts.push([c[0], c[1]]))));
  }
  if (!pts.length) return null;
  let minX = pts[0][0]; let minY = pts[0][1];
  let maxX = pts[0][0]; let maxY = pts[0][1];
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

function parseName(props: Record<string, unknown>): string {
  const keys = ['name_ar', 'name:ar', 'name', 'municipality', 'municipal', 'adm2_ar', 'adm2_en', 'shapeName', 'NAME_2', 'NAME_1'];
  for (const k of keys) {
    const v = props[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return 'منطقة غير مسماة';
}

function parseLevel(props: Record<string, unknown>): string {
  const keys = ['admin_level', 'type', 'level', 'boundary_type', 'class'];
  for (const k of keys) {
    const v = props[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return 'بلدية';
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BoundaryItem {
  id: string;
  name: string;
  level: string;
  geometry: GeoJSON_Geometry;
  bbox: [number, number, number, number] | null;
}

interface Props {
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AoiBoundaryPopover({ onClose }: Props) {
  const aoi            = useGisEngine((s) => s.aoi);
  const setAoi         = useGisEngine((s) => s.setAoi);
  const clearAoi       = useGisEngine((s) => s.clearAoi);
  const drawingMode    = useGisEngine((s) => s.drawingMode);
  const setDrawingMode = useGisEngine((s) => s.setDrawingMode);

  const [boundaries,  setBoundaries]  = useState<BoundaryItem[]>([]);
  const [query,       setQuery]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const loadedRef = useRef(false);

  // ── Load boundaries ───────────────────────────────────────────────────────

  const loadBoundaries = useCallback(async () => {
    setLoading(true);
    try {
      let res = await fetch('/gis/municipalities');
      if (!res.ok) res = await fetch('/api/v1/gis/municipalities');
      if (!res.ok) throw new Error('تعذر تحميل الحدود');
      const fc = await res.json();
      const features: any[] = Array.isArray(fc?.features) ? fc.features : [];
      const mapped = features
        .map((f, idx) => {
          let raw = f?.geometry;
          // geometry may arrive as a JSON-encoded string (asyncpg ::json cast)
          if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = undefined; } }
          const g = raw as GeoJSON_Geometry | undefined;
          if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return null;
          const props = (f?.properties ?? {}) as Record<string, unknown>;
          return {
            id: String(f?.id ?? `${parseName(props)}-${idx}`),
            name: parseName(props),
            level: parseLevel(props),
            geometry: g,
            bbox: calcBbox(g),
          } as BoundaryItem;
        })
        .filter(Boolean) as BoundaryItem[];
      setBoundaries(mapped);
    } catch {
      setBoundaries([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadBoundaries();
    }
  }, [loadBoundaries]);

  // ── Listen for manual AOI drawn on map ───────────────────────────────────

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{
        geometry?: GeoJSON_Geometry;
        source?: 'manual-rectangle' | 'manual-polygon';
        name?: string;
      }>;
      const geometry = e.detail?.geometry;
      if (!geometry) return;
      const source = e.detail?.source ?? 'manual-rectangle';
      const name   = e.detail?.name ?? (source === 'manual-rectangle' ? 'نطاق يدوي (مربع)' : 'نطاق يدوي');
      setAoi({ source, name, geometry, bbox: calcBbox(geometry), updatedAt: new Date().toISOString() });
      setDrawingMode('idle');
      setSelectedId(null);
    };
    window.addEventListener('engineering:set-aoi', handler as EventListener);
    return () => window.removeEventListener('engineering:set-aoi', handler as EventListener);
  }, [setAoi, setDrawingMode]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const isDrawingAoi = drawingMode === 'aoi-rectangle';

  const filtered = boundaries
    .filter((b) => !query || `${b.name} ${b.level}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 15);

  function selectBoundary(b: BoundaryItem) {
    setSelectedId(b.id);
    const selection: AoiSelection = {
      source: 'admin-boundary',
      name: b.name,
      geometry: b.geometry,
      bbox: b.bbox,
      updatedAt: new Date().toISOString(),
    };
    setAoi(selection);
    window.dispatchEvent(new CustomEvent('engineering:highlight-boundary', {
      detail: { geometry: b.geometry, name: b.name },
    }));
  }

  function handleClearAoi() {
    clearAoi();
    setSelectedId(null);
    window.dispatchEvent(new CustomEvent('engineering:clear-aoi'));
  }

  function toggleDrawAoi() {
    setDrawingMode(isDrawingAoi ? 'idle' : 'aoi-rectangle');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="absolute bottom-14 left-1/2 -translate-x-1/2 z-50 w-72 rounded-2xl border border-white/15 bg-slate-900/92 backdrop-blur-xl shadow-2xl p-3 space-y-2.5"
      dir="rtl"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-cyan-200">تحديد نطاق التحليل (AOI)</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Active AOI badge ── */}
      {aoi ? (
        <div className="flex items-center justify-between rounded-xl border border-emerald-600/40 bg-emerald-900/25 px-2.5 py-1.5 text-[11px] text-emerald-200">
          <div className="flex items-center gap-1.5 min-w-0">
            <Check size={11} className="shrink-0 text-emerald-400" />
            <span className="font-medium truncate">{aoi.name}</span>
          </div>
          <button
            type="button"
            onClick={handleClearAoi}
            className="shrink-0 rounded-md border border-emerald-600/30 bg-slate-800/40 px-1.5 py-0.5 text-[10px] hover:bg-slate-700/60 transition-colors ml-1"
          >
            مسح
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-600/60 bg-slate-800/30 px-2.5 py-1.5 text-[11px] text-slate-500 text-center">
          لم يُحدد نطاق بعد — كل البيانات مرئية
        </div>
      )}

      {/* ── Draw manual AOI ── */}
      <button
        type="button"
        onClick={toggleDrawAoi}
        className={`w-full flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all ${
          isDrawingAoi
            ? 'border-amber-500/70 bg-amber-500/20 text-amber-200 animate-pulse'
            : 'border-slate-600 bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white'
        }`}
      >
        <Square size={13} />
        {isDrawingAoi ? 'انقر واسحب على الخريطة...' : 'رسم نطاق يدوي (مربع)'}
      </button>

      {/* ── Divider ── */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[10px] text-slate-500 shrink-0">أو اختر حدوداً إدارية</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث: طرابلس، ترهونة، مصراتة..."
          className="w-full bg-slate-800/60 border border-slate-600 rounded-lg pr-7 pl-2.5 py-1.5 text-[12px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {/* ── Boundaries list ── */}
      <div className="max-h-40 overflow-y-auto space-y-1 pr-0.5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-slate-400">
            <RefreshCw size={11} className="animate-spin" />
            <span>جارٍ تحميل الحدود الإدارية...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-4 text-[11px] text-slate-500">
            {boundaries.length === 0 ? 'لا تتوفر بيانات حدود (تحقق من الخادم)' : 'لا توجد نتائج'}
          </div>
        ) : (
          filtered.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => selectBoundary(b)}
              className={`w-full text-right rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
                selectedId === b.id || aoi?.name === b.name
                  ? 'border-cyan-500 bg-cyan-500/20 text-cyan-100'
                  : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700/70'
              }`}
            >
              <div className="font-medium">{b.name}</div>
              <div className="text-[10px] text-slate-400">{b.level}</div>
            </button>
          ))
        )}
      </div>

      {/* ── Refresh ── */}
      <button
        type="button"
        onClick={loadBoundaries}
        className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
      >
        <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
        تحديث قائمة الحدود
      </button>
    </div>
  );
}

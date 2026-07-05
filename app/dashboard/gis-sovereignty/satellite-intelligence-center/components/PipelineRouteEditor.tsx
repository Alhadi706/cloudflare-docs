'use client';
/**
 * PipelineRouteEditor — محرر مسارات خطوط الأنابيب
 *
 * يتيح:
 * - عرض مسارات GMMR الحالية على الخريطة
 * - رسم مسار جديد دقيق بالنقر على الخريطة
 * - حفظ المسار وربطه بمحرك كشف التسريبات
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Route, Pencil, Save, Trash2, RefreshCw, CheckCircle2,
  MapPin, Ruler, ChevronDown, ChevronRight, AlertTriangle, Eye, EyeOff,
  Download, Upload, Plus,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface RouteWaypoint { lon: number; lat: number; }

interface PipelineRoute {
  id:              string;
  name:            string;
  type:            'gmmr_west' | 'gmmr_east' | 'oil_pipeline' | 'custom';
  color:           string;
  waypoints:       [number, number][];
  waypoints_count: number;
  buffer_m:        number;
  total_km?:       number;
  source:          'manual' | 'overpass' | 'import';
  is_default?:     boolean;
  description?:    string;
  updated_at:      string;
}

interface Props {
  /** Called when route drawing mode should start — passes 'line' to SceneMapPanel */
  onStartDraw: () => void;
  /** Called when drawing is cancelled */
  onCancelDraw: () => void;
  /** Whether drawing is currently active */
  isDrawing: boolean;
  /** New waypoints collected from map draw (from onAreaDrawn callback) */
  drawnWaypoints: [number, number][] | null;
  /** Called when user accepts drawn waypoints — clears drawnWaypoints */
  onDrawAccepted: () => void;
  /** Routes to show on map — parent passes these to SceneMapPanel as satelliteRouteLines */
  onRoutesChange: (routes: { coords: [number,number][]; color: string; label: string; layerKey: string }[]) => void;
}

const ROUTE_LABELS: Record<string, string> = {
  gmmr_west:    'النهر الصناعي — الغربي',
  gmmr_east:    'النهر الصناعي — الشرقي',
  oil_pipeline: 'خط أنابيب نفطي',
  custom:       'مسار مخصص',
};
const ROUTE_COLORS: Record<string, string> = {
  gmmr_west:    '#38bdf8',
  gmmr_east:    '#34d399',
  oil_pipeline: '#f97316',
  custom:       '#a78bfa',
};

export default function PipelineRouteEditor({
  onStartDraw, onCancelDraw, isDrawing,
  drawnWaypoints, onDrawAccepted, onRoutesChange,
}: Props) {
  const [routes,         setRoutes]         = useState<PipelineRoute[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [saveResult,     setSaveResult]     = useState<string | null>(null);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [visibleIds,     setVisibleIds]     = useState<Set<string>>(new Set());
  // New route form
  const [newRouteName,   setNewRouteName]   = useState('');
  const [newRouteType,   setNewRouteType]   = useState<PipelineRoute['type']>('gmmr_west');
  const [newBufferM,     setNewBufferM]     = useState(500);
  const [showNewForm,    setShowNewForm]    = useState(false);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/satellite/pipeline-routes');
      if (res.ok) {
        const d = await res.json();
        setRoutes(d.routes || []);
        // Auto-show all routes
        const ids = new Set((d.routes || []).map((r: PipelineRoute) => r.id) as string[]);
        setVisibleIds(ids);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  // Sync visible routes to map
  useEffect(() => {
    const lines = routes
      .filter(r => visibleIds.has(r.id))
      .map(r => ({
        coords:   r.waypoints,
        color:    r.color,
        label:    r.name,
        layerKey: `pipeline_${r.id}`,
      }));
    onRoutesChange(lines);
  }, [routes, visibleIds, onRoutesChange]);

  const toggleVisible = (id: string) => {
    setVisibleIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveDrawn = async () => {
    if (!drawnWaypoints || drawnWaypoints.length < 2) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/v1/satellite/pipeline-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id:       newRouteType === 'gmmr_west' ? 'gmmr_west_manual' :
                    newRouteType === 'gmmr_east' ? 'gmmr_east_manual' :
                    `custom_${Date.now()}`,
          name:     newRouteName || ROUTE_LABELS[newRouteType] + ' (يدوي)',
          type:     newRouteType,
          waypoints: drawnWaypoints,
          buffer_m: newBufferM,
          color:    ROUTE_COLORS[newRouteType],
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setSaveResult(`✅ ${d.message}`);
        onDrawAccepted();
        await loadRoutes();
        setShowNewForm(false);
      } else {
        setSaveResult(`❌ ${d.error}`);
      }
    } catch (e: any) {
      setSaveResult(`❌ خطأ: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteRoute = async (id: string) => {
    if (!confirm('حذف هذا المسار؟ سيُستخدم المسار الافتراضي')) return;
    await fetch('/api/v1/satellite/pipeline-routes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadRoutes();
  };

  const exportRoute = (route: PipelineRoute) => {
    const geojson = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: route.waypoints },
        properties: { name: route.name, type: route.type, buffer_m: route.buffer_m, total_km: route.total_km },
      }],
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${route.id}.geojson`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 text-sm" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <Route className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-cyan-300">محرر مسارات خطوط الأنابيب</span>
        </div>
        <p className="text-xs text-slate-500">ارسم مسارات دقيقة لتحسين كشف التسريبات</p>
      </div>

      {/* ── Draw mode panel ─────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 space-y-2">
        {!isDrawing && !drawnWaypoints && (
          <button
            onClick={() => { setShowNewForm(true); onStartDraw(); }}
            className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm flex items-center justify-center gap-2 font-medium"
          >
            <Pencil className="w-4 h-4" />
            رسم مسار جديد على الخريطة
          </button>
        )}

        {isDrawing && !drawnWaypoints && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-xs text-cyan-300">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
              <span>انقر على الخريطة لإضافة نقاط المسار — انقر مرتين للإنهاء</span>
            </div>
            <button
              onClick={onCancelDraw}
              className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs"
            >
              إلغاء الرسم
            </button>
          </div>
        )}

        {drawnWaypoints && drawnWaypoints.length >= 2 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{drawnWaypoints.length} نقطة مرسومة جاهزة للحفظ</span>
            </div>

            {showNewForm && (
              <div className="space-y-2 bg-slate-800/50 rounded-lg p-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">نوع المسار</label>
                  <select value={newRouteType} onChange={e => setNewRouteType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500">
                    <option value="gmmr_west">النهر الصناعي — الفرع الغربي</option>
                    <option value="gmmr_east">النهر الصناعي — الفرع الشرقي</option>
                    <option value="oil_pipeline">خط أنابيب نفطي</option>
                    <option value="custom">مسار مخصص</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">اسم المسار (اختياري)</label>
                  <input value={newRouteName} onChange={e => setNewRouteName(e.target.value)}
                    placeholder={ROUTE_LABELS[newRouteType] + ' (يدوي)'}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-slate-400 shrink-0">Buffer:</label>
                  <input type="range" min={100} max={2000} step={100} value={newBufferM}
                    onChange={e => setNewBufferM(+e.target.value)}
                    className="flex-1 accent-cyan-500 h-1" />
                  <span className="text-xs text-cyan-300 w-16 text-left">{newBufferM} م</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={saveDrawn} disabled={saving}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs flex items-center justify-center gap-1.5 font-medium">
                <Save className="w-3.5 h-3.5" />
                {saving ? 'جاري الحفظ...' : 'حفظ المسار'}
              </button>
              <button onClick={() => { onDrawAccepted(); setShowNewForm(false); }}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs">
                تجاهل
              </button>
            </div>
          </div>
        )}

        {saveResult && (
          <div className={`px-3 py-2 rounded-lg text-xs ${saveResult.startsWith('✅') ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>
            {saveResult}
          </div>
        )}
      </div>

      {/* ── Routes list ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400">المسارات المحفوظة ({routes.length})</span>
          <button onClick={loadRoutes} disabled={loading} className="p-1 text-slate-500 hover:text-slate-300">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {routes.map(route => (
          <div key={route.id} className={`rounded-lg border ${visibleIds.has(route.id) ? 'border-slate-600 bg-slate-800/50' : 'border-slate-700/50 bg-slate-800/20 opacity-60'}`}>
            {/* Route header */}
            <div className="flex items-center gap-2 px-3 py-2">
              <button onClick={() => toggleVisible(route.id)} title={visibleIds.has(route.id) ? 'إخفاء' : 'إظهار'}>
                {visibleIds.has(route.id)
                  ? <Eye className="w-3.5 h-3.5 text-slate-300" />
                  : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
              </button>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: route.color }} />
              <span className="flex-1 text-xs font-medium text-slate-200 truncate">{route.name}</span>
              {route.is_default && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">افتراضي</span>
              )}
              <button onClick={() => setExpandedId(expandedId === route.id ? null : route.id)}
                className="text-slate-500 hover:text-slate-300">
                {expandedId === route.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-3 px-3 pb-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{route.waypoints_count} نقطة</span>
              {route.total_km && <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />{route.total_km} كم</span>}
              <span>buffer: {route.buffer_m} م</span>
            </div>

            {/* Expanded details */}
            {expandedId === route.id && (
              <div className="border-t border-slate-700/50 px-3 py-2 space-y-2">
                {route.description && (
                  <p className="text-[10px] text-slate-400">{route.description}</p>
                )}
                <div className="text-[10px] text-slate-500 space-y-0.5">
                  <p>النوع: {ROUTE_LABELS[route.type]}</p>
                  <p>المصدر: {route.source === 'manual' ? 'رسم يدوي' : route.source}</p>
                  <p>آخر تحديث: {new Date(route.updated_at).toLocaleDateString('ar-SA')}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => exportRoute(route)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 rounded">
                    <Download className="w-3 h-3" /> GeoJSON
                  </button>
                  {!route.is_default && (
                    <button onClick={() => deleteRoute(route.id)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded border border-red-500/20">
                      <Trash2 className="w-3 h-3" /> حذف
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Footer info ─────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-t border-slate-800">
        <div className="bg-slate-800/40 rounded-lg p-3 text-xs text-slate-500 space-y-1">
          <p className="text-slate-400 font-semibold">كيف يعمل؟</p>
          <p>1. اضغط "رسم مسار جديد" — الخريطة تدخل وضع الرسم</p>
          <p>2. انقر على الخريطة لإضافة نقاط المسار بالترتيب</p>
          <p>3. انقر مرتين على النقطة الأخيرة للإنهاء</p>
          <p>4. اختر النوع واحفظ — يُستخدم فوراً في كشف التسريبات</p>
          <p className="text-slate-600">الدقة: كل نقطة = ±50 م على الخريطة الفضائية</p>
        </div>
      </div>
    </div>
  );
}

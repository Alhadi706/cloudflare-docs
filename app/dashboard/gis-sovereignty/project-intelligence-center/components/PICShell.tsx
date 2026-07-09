'use client';
/**
 * PICShell — Project Intelligence Center
 * مركز استخبارات المشاريع — الواجهة الرئيسية
 *
 * Layout:
 *   [Header]
 *   [Ribbon: tools + filters]
 *   [Left: project list | Map | Right: project detail]
 *   [Bottom: activity timeline bar]
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  BarChart2, Map as MapIcon, PlusCircle, RefreshCw, Bell,
  Filter, Search, ChevronDown, X, CheckCircle2, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Activity, Layers,
  FileText, Settings, Satellite, Eye, Play, Pause,
  Building2, Route, Waves, Circle, ChevronLeft, ChevronRight,
  ZoomIn, Clock,
} from 'lucide-react';
import { SceneMapPanel, type BaseStyle, type DrawMode } from '@/app/dashboard/gis-sovereignty/satellite-intelligence-center/components/SceneMapPanel';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

type ProjectStatus = 'active' | 'slow' | 'stopped' | 'completed' | 'cancelled' | 'unknown' | 'delayed';
type ProjectType   = 'road' | 'bridge' | 'building' | 'earthwork' | 'utility' | 'airport' | 'port' | 'dam' | 'public_facility' | 'other';
type ActiveView    = 'map' | 'dashboard' | 'compare';

// Project types that are drawn as lines (roads, pipes, etc.)
const LINE_TYPES: ProjectType[] = ['road', 'bridge', 'utility', 'dam'];

interface Project {
  id:                        string;
  name:                      string;
  code?:                     string;
  type:                      ProjectType;
  status:                    ProjectStatus;
  geometry_json:             any;
  bbox:                      number[];
  start_date?:               string;
  expected_end_date?:        string;
  contractor_name?:          string;
  department?:               string;
  progress_pct:              number;
  health_score:              number;
  total_interruptions:       number;
  longest_interruption_days: number;
  last_scan_date?:           string;
  last_active_date?:         string;
}

interface TimelinePoint {
  date:      string;
  magnitude: number;
  score:     number;
  state:     'active' | 'slow' | 'stopped';
  thumb_url: string;
}

interface ArchiveScene {
  uid:           string;
  date:          string;
  cloud:         number;
  bbox:          number[];       // real scene footprint (used for map overlay extent)
  project_bbox?: number[];      // project overlap area
  thumbnail_url: string;
}

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<ProjectStatus, { color: string; bg: string; label: string; dot: string; hex: string }> = {
  active:    { color: 'text-green-300',  bg: 'bg-green-900/20 border-green-700/40',   label: 'نشط',       dot: 'bg-green-400',  hex: '#22c55e' },
  stopped:   { color: 'text-red-300',    bg: 'bg-red-900/20 border-red-700/40',       label: 'متوقف',     dot: 'bg-red-400',    hex: '#ef4444' },
  completed: { color: 'text-blue-300',   bg: 'bg-blue-900/20 border-blue-700/40',     label: 'مكتمل',     dot: 'bg-blue-400',   hex: '#3b82f6' },
  slow:      { color: 'text-yellow-300', bg: 'bg-yellow-900/20 border-yellow-700/40', label: 'بطيء',       dot: 'bg-yellow-400', hex: '#eab308' },
  delayed:   { color: 'text-orange-300', bg: 'bg-orange-900/20 border-orange-700/40', label: 'متأخر',     dot: 'bg-orange-400', hex: '#f97316' },
  cancelled: { color: 'text-slate-500',  bg: 'bg-slate-800/40 border-slate-700/40',   label: 'ملغى',       dot: 'bg-slate-600',  hex: '#6b7280' },
  unknown:   { color: 'text-slate-400',  bg: 'bg-slate-800/40 border-slate-700/40',   label: 'غير محدد', dot: 'bg-slate-500',  hex: '#94a3b8' },
};

const TYPE_ICONS: Record<ProjectType, React.ElementType> = {
  road: Route, bridge: Route, building: Building2, earthwork: Layers,
  utility: Waves, airport: Circle, port: Circle, dam: Waves,
  public_facility: Building2, other: MapIcon,
};

const TYPE_LABELS: Record<ProjectType, string> = {
  road: 'طريق', bridge: 'جسر', building: 'مبنى', earthwork: 'أعمال ترابية',
  utility: 'مرافق', airport: 'مطار', port: 'ميناء', dam: 'سد',
  public_facility: 'منشأة عامة', other: 'أخرى',
};

const TENANT_ID = typeof window !== 'undefined'
  ? (localStorage.getItem('tenant_id') || 'aaaaaaaa-0000-4000-a000-000000000001')
  : 'aaaaaaaa-0000-4000-a000-000000000001';

// ─────────────────────────────────────────────
//  Main Shell
// ─────────────────────────────────────────────

export default function PICShell() {
  // ── State ──────────────────────────────────────────────────────
  const [projects,       setProjects]       = useState<Project[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [projectDetail,  setProjectDetail]  = useState<{ project: Project; scans: any[]; timeline: any } | null>(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [activeView,     setActiveView]     = useState<ActiveView>('map');
  const [filterStatus,   setFilterStatus]   = useState<string>('all');
  const [filterType,     setFilterType]     = useState<string>('all');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [drawMode,       setDrawMode]       = useState<DrawMode>('off');
  const [drawnPolygon,   setDrawnPolygon]   = useState<[number,number][] | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [alerts,         setAlerts]         = useState<any[]>([]);
  const [showAlerts,     setShowAlerts]     = useState(false);
  const [analyzingId,    setAnalyzingId]    = useState<string | null>(null);
  const [baseStyle,      setBaseStyle]      = useState<BaseStyle>('satellite');
  const [flyToPin,       setFlyToPin]       = useState<{ lon: number; lat: number; zoom?: number } | null>(null);
  const [compareMode,    setCompareMode]    = useState(false);
  const [dashStats,      setDashStats]      = useState<any>(null);

  // ── Archive / time-slider state ───────────────────────────────────────
  const [archiveScenes,  setArchiveScenes]  = useState<ArchiveScene[]>([]);
  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [imageOverlay,   setImageOverlay]   = useState<{ url: string; extent: [number,number,number,number]; opacity?: number } | null>(null);
  const [lightboxUrl,    setLightboxUrl]    = useState<string | null>(null);
  const [scenesLoading,  setScenesLoading]  = useState(false);

  // ── New project form ─────────────────────────────────────────
  const [newProject, setNewProject] = useState({
    name: '', type: 'road' as ProjectType, contractor_name: '',
    department: '', start_date: '', expected_end_date: '', notes: '',
  });

  // ── Load projects ─────────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/pic/projects?limit=500`, {
        headers: { 'X-Tenant-ID': TENANT_ID },
      });
      if (res.ok) {
        const d = await res.json();
        setProjects(d.projects ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/pic/dashboard`, { headers: { 'X-Tenant-ID': TENANT_ID } });
      if (res.ok) { const d = await res.json(); setDashStats(d.stats); setAlerts(d.recent_alerts ?? []); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadProjects(); loadDashboard(); }, [loadProjects, loadDashboard]);

  // ── Load project detail ───────────────────────────────────────
  useEffect(() => {
    if (!selectedId) { setProjectDetail(null); setArchiveScenes([]); setImageOverlay(null); return; }
    setDetailLoading(true);
    fetch(`/api/v1/pic/projects/${selectedId}?include=scans,events,timeline`, {
      headers: { 'X-Tenant-ID': TENANT_ID },
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok) setProjectDetail({ project: d.project, scans: d.scans ?? [], timeline: d.timeline });
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  // ── Load archive scenes for time slider ──────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    setScenesLoading(true);
    fetch(`/api/v1/pic/projects/${selectedId}?include=archive`, {
      headers: { 'X-Tenant-ID': TENANT_ID },
    })
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.archive_scenes?.length) {
          const scenes: ArchiveScene[] = d.archive_scenes;
          setArchiveScenes(scenes);
          const lastIdx = scenes.length - 1;
          setActiveSceneIdx(lastIdx);
          // Auto-show the most recent scene on the map.
          // Use scene bbox (real footprint) as the overlay extent so the
          // thumbnail covers the correct geographic area on the map.
          const latest = scenes[lastIdx];
          setImageOverlay({
            url:    latest.thumbnail_url,
            extent: latest.bbox as [number,number,number,number],
            opacity: 0.75,
          });
        } else {
          setArchiveScenes([]);
        }
      })
      .catch(() => {})
      .finally(() => setScenesLoading(false));
  }, [selectedId]);

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    return projects.filter(p => {
      // Always hide cancelled projects — they are archived, not operational
      if (p.status === 'cancelled') return false;
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterType !== 'all' && p.type !== filterType) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(p.code ?? '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [projects, filterStatus, filterType, searchQuery]);

  // ── Map overlays: polygons + lines + labels ────────────────
  // Polygon-type projects rendered as extraction layers (filled polygons)
  const projectExtractionLayers = useMemo(() =>
    filtered
      .filter(p => !LINE_TYPES.includes(p.type) && p.geometry_json?.coordinates)
      .map(p => ({
        layerKey:  p.id,
        layerName: p.name,
        color:     STATUS_CONFIG[p.status]?.hex ?? '#6b7280',
        geojson:   {
          type: 'FeatureCollection' as const,
          features: [{ type: 'Feature', geometry: p.geometry_json, properties: { name: p.name } }],
        },
        visible: true,
      })),
  [filtered]);

  // Line-type projects rendered as route lines
  const projectRouteLines = useMemo(() =>
    filtered
      .filter(p => LINE_TYPES.includes(p.type) && p.geometry_json?.coordinates)
      .map(p => {
        // Extract coordinate array from geometry
        const geom  = p.geometry_json;
        const coords: [number,number][] =
          geom.type === 'LineString' ? geom.coordinates :
          geom.type === 'Polygon'    ? geom.coordinates[0] : [];
        return {
          coords,
          color:    STATUS_CONFIG[p.status]?.hex ?? '#6b7280',
          width:    p.status === 'stopped' ? 5 : 4,
          label:    p.name,
          layerKey: p.id,
        };
      })
      .filter(r => r.coords.length >= 2),
  [filtered]);

  // Markers: used only when geometry_json is null/empty (fallback)
  const mapMarkers = useMemo(() =>
    filtered
      .filter(p => !p.geometry_json?.coordinates && p.bbox?.length)
      .map(p => {
        const lon = (p.bbox[0] + p.bbox[2]) / 2;
        const lat = (p.bbox[1] + p.bbox[3]) / 2;
        const cfg = STATUS_CONFIG[p.status];
        return {
          lon, lat,
          color:    cfg?.hex ?? '#6b7280',
          radius:   10,
          label:    `${p.name} (${p.progress_pct}%)`,
          tooltip:  `${p.name}\n${cfg?.label} | ${p.progress_pct}%`,
          layerKey: 'pic_fallback',
        };
      }),
  [filtered]);

  // ── Create project ────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (!newProject.name || !drawnPolygon) return;
    // Build geometry based on project type
    const isLine = LINE_TYPES.includes(newProject.type);
    const geometry = isLine
      ? { type: 'LineString', coordinates: drawnPolygon.map(c => [c[0], c[1]]) }
      : { type: 'Polygon',    coordinates: [[...drawnPolygon.map(c => [c[0], c[1]]), [drawnPolygon[0][0], drawnPolygon[0][1]]]] };
    try {
      const res = await fetch('/api/v1/pic/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
        body: JSON.stringify({ ...newProject, geometry_json: geometry }),
      });
      if (res.ok) {
        await loadProjects();
        setShowCreateForm(false);
        setDrawnPolygon(null);
        setDrawMode('off');
        setNewProject({ name:'', type:'road', contractor_name:'', department:'', start_date:'', expected_end_date:'', notes:'' });
      }
    } catch { /* silent */ }
  }, [newProject, drawnPolygon, loadProjects]);

  // ── Analyze project ───────────────────────────────────────────
  const handleAnalyze = useCallback(async (projectId: string) => {
    setAnalyzingId(projectId);
    try {
      const res = await fetch(`/api/v1/pic/projects/${projectId}?action=analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
        body: JSON.stringify({ date_from: '2026-01-01' }),
      });
      if (res.ok) {
        await loadProjects();
        if (selectedId === projectId) {
          // Refresh detail
          const r2 = await fetch(`/api/v1/pic/projects/${projectId}?include=scans,events,timeline`, { headers: { 'X-Tenant-ID': TENANT_ID } });
          if (r2.ok) { const d = await r2.json(); setProjectDetail({ project: d.project, scans: d.scans ?? [], timeline: d.timeline }); }
        }
      }
    } catch { /* silent */ }
    finally { setAnalyzingId(null); }
  }, [selectedId, loadProjects]);

  const selected = projects.find(p => p.id === selectedId);

  // ─────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden" dir="rtl">

      {/* ══ Header ══════════════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Satellite size={18} className="text-indigo-400" />
            <span className="font-bold text-sm text-white">مركز استخبارات المشاريع</span>
            <span className="text-[10px] bg-indigo-900/40 text-indigo-400 border border-indigo-700/40 rounded px-1.5 py-0.5 font-mono">PIC</span>
          </div>
          {dashStats && (
            <div className="flex items-center gap-3 text-[11px] text-slate-400 border-r border-slate-700 pr-3 mr-1">
              <span><span className="text-white font-bold">{dashStats.total}</span> مشروع</span>
              <span><span className="text-green-400 font-bold">{dashStats.active}</span> نشط</span>
              <span><span className="text-red-400 font-bold">{dashStats.stopped}</span> متوقف</span>
              <span><span className="text-orange-400 font-bold">{dashStats.at_risk}</span> في خطر</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View tabs */}
          {([['map','خريطة',MapIcon],['dashboard','لوحة',BarChart2]] as [ActiveView, string, React.ElementType][]).map(([v,lbl,Ic]) => (
            <button key={v} onClick={() => setActiveView(v)}
              className={`flex items-center gap-1.5 px-3 h-7 rounded text-xs font-medium transition-colors ${
                activeView === v ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}>
              <Ic size={11} />{lbl}
            </button>
          ))}
          {/* Alerts */}
          <button
            onClick={() => setShowAlerts(s => !s)}
            className="relative flex items-center gap-1 px-2 h-7 rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Bell size={13} />
            {alerts.filter(a => !a.is_read).length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] flex items-center justify-center text-white font-bold">
                {alerts.filter(a => !a.is_read).length}
              </span>
            )}
          </button>
          <button onClick={loadProjects}
            className="flex items-center gap-1 px-2 h-7 rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ══ Ribbon ══════════════════════════════════════════════════ */}
      <div className="shrink-0 flex items-center gap-2 px-3 h-10 bg-slate-900/70 border-b border-slate-800 overflow-x-auto scrollbar-none">
        {/* Draw + Create */}
        {drawMode === 'off' && !showCreateForm ? (
          <button
            onClick={() => {
              // Default draw mode — will be updated when user picks type in form
              setDrawMode('polygon');
            }}
            className="flex items-center gap-1.5 px-3 h-7 rounded bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors shrink-0"
          >
            <PlusCircle size={12} />مشروع جديد
          </button>
        ) : drawMode !== 'off' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded text-xs text-indigo-300 animate-pulse">
              <span className="w-2 h-2 bg-indigo-400 rounded-full" />
              ارسم حدود المشروع على الخريطة
              {drawMode === 'line' ? ' (خط مسار — انقر لإضافة نقاط، انقر مرتين للإنهاء)' : ' (مضلع — ارسم الحدود، انقر مرتين للإنهاء)'}
            </div>
            {drawnPolygon && (
              <button onClick={() => setShowCreateForm(true)}
                className="px-3 h-7 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-semibold">
                ✓ التالي — بيانات المشروع
              </button>
            )}
            <button onClick={() => { setDrawMode('off'); setDrawnPolygon(null); }}
              className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600">
              <X size={12} />
            </button>
          </div>
        ) : null}

        <div className="w-px h-5 bg-slate-700 mx-1 shrink-0" />

        {/* Search */}
        <div className="relative shrink-0">
          <Search size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث..."
            className="h-7 pr-7 pl-2 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 w-36"
          />
        </div>

        {/* Status filter */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="h-7 px-2 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200 appearance-none">
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_CONFIG)
            .filter(([v]) => v !== 'cancelled')
            .map(([v,c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>

        {/* Type filter */}
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="h-7 px-2 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200 appearance-none">
          <option value="all">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <div className="mr-auto text-[10px] text-slate-600 shrink-0">
          {filtered.length} مشروع معروض
        </div>

        {/* Basemap */}
        <select value={baseStyle} onChange={e => setBaseStyle(e.target.value as BaseStyle)}
          className="h-7 px-2 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200 appearance-none shrink-0">
          <option value="satellite">صور فضائية</option>
          <option value="voyager">الطرق</option>
          <option value="dark">داكن</option>
        </select>
      </div>

      {/* ══ Main content ════════════════════════════════════════════ */}
      {activeView === 'map' ? (
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left: Project List ─────────────────────────────────── */}
          <div className="w-72 shrink-0 border-l border-slate-800 bg-slate-900/60 flex flex-col overflow-hidden">
            <div className="shrink-0 px-3 py-2 bg-slate-800/40 border-b border-slate-800">
              <p className="text-xs font-bold text-slate-300">قائمة المشاريع</p>
              <p className="text-[10px] text-slate-500">{filtered.length} من {projects.length}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-500 text-xs gap-2">
                  <RefreshCw size={14} className="animate-spin" />جاري التحميل...
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-600 text-xs text-center px-4">
                  <MapIcon size={24} className="mb-2 opacity-40" />
                  {projects.length === 0 ? (
                    <>
                      <p className="font-medium text-slate-500">لا توجد مشاريع بعد</p>
                      <p className="mt-1 opacity-70">اضغط "+ مشروع جديد" وارسم على الخريطة</p>
                    </>
                  ) : <p>لا نتائج تطابق الفلتر</p>}
                </div>
              ) : (
                filtered.map(p => {
                  const cfg    = STATUS_CONFIG[p.status];
                  const TypeIc = TYPE_ICONS[p.type] ?? MapIcon;
                  const isSelected = selectedId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => { setSelectedId(p.id); if (p.bbox?.length) setFlyToPin({ lon: (p.bbox[0]+p.bbox[2])/2, lat: (p.bbox[1]+p.bbox[3])/2, zoom: 14 }); }}
                      className={`border-b border-slate-800/40 cursor-pointer transition-colors ${isSelected ? 'bg-indigo-900/25 border-r-2 border-r-indigo-500' : 'hover:bg-slate-800/30'}`}
                    >
                      <div className="flex items-start gap-2.5 px-3 py-2.5">
                        <div className="shrink-0 mt-0.5">
                          <TypeIc size={13} className="text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>{p.name}</p>
                          {p.code && <p className="text-[10px] text-slate-500 font-mono">{p.code}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-medium ${cfg.color}`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot} ml-1`} />{cfg.label}
                            </span>
                            <span className="text-[10px] text-slate-500">{TYPE_LABELS[p.type]}</span>
                          </div>

                          {/* Progress bar */}
                          <div className="mt-1.5">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[9px] text-slate-500">الإنجاز</span>
                              <span className="text-[9px] font-bold text-slate-300">{p.progress_pct}%</span>
                            </div>
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  p.status === 'completed' ? 'bg-blue-500' :
                                  p.status === 'stopped'   ? 'bg-red-500' :
                                  p.status === 'slow'      ? 'bg-yellow-500' : 'bg-indigo-500'
                                }`}
                                style={{ width: `${p.progress_pct}%` }}
                              />
                            </div>
                          </div>

                          {/* Health */}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] text-slate-600">
                              صحة: <span className={p.health_score >= 70 ? 'text-green-400' : p.health_score >= 40 ? 'text-yellow-400' : 'text-red-400'}>
                                {p.health_score}
                              </span>
                            </span>
                            {p.total_interruptions > 0 && (
                              <span className="text-[9px] text-orange-400">{p.total_interruptions} توقف</span>
                            )}
                          </div>
                        </div>

                        {/* Analyze button */}
                        <button
                          onClick={e => { e.stopPropagation(); handleAnalyze(p.id); }}
                          disabled={analyzingId === p.id}
                          className="shrink-0 p-1 rounded text-slate-600 hover:text-indigo-400 hover:bg-indigo-900/20 transition-colors"
                          title="تحليل المشروع"
                        >
                          {analyzingId === p.id
                            ? <RefreshCw size={11} className="animate-spin text-indigo-400" />
                            : <Activity size={11} />}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Center: Map ────────────────────────────────────────── */}
          <div className="flex-1 relative min-w-0">
            <SceneMapPanel
              scenes={[]}
              activeScene={archiveScenes[activeSceneIdx]?.uid ?? null}
              drawMode={drawMode}
              baseStyle={baseStyle}
              onBaseStyleChange={setBaseStyle}
              onAreaDrawn={coords => { setDrawnPolygon(coords); setDrawMode('off'); }}
              onDrawEnd={() => setDrawMode('off')}
              flyToPin={flyToPin}
              extractionLayers={projectExtractionLayers.length > 0 ? projectExtractionLayers : undefined}
              satelliteRouteLines={projectRouteLines.length > 0 ? projectRouteLines : undefined}
              satelliteOverlayMarkers={mapMarkers.length > 0 ? mapMarkers : undefined}
              staticImageOverlay={imageOverlay}
              onOverlayMarkerClick={m => {
                const proj = projects.find(p => p.id === m.layerKey);
                if (proj) setSelectedId(proj.id);
              }}
            />

            {/* Map legend */}
            <div className="absolute bottom-8 right-3 bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-[10px] space-y-1">
              <p className="text-slate-400 font-semibold mb-1">الحالة</p>
              {Object.entries(STATUS_CONFIG).map(([k,v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                  <span className="text-slate-400">{v.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Project Detail ──────────────────────────────── */}
          {selectedId && (
            <div className="w-80 shrink-0 border-r border-slate-800 bg-slate-900/60 flex flex-col overflow-hidden">
              {detailLoading ? (
                <div className="flex items-center justify-center flex-1 text-slate-500 gap-2 text-xs">
                  <RefreshCw size={14} className="animate-spin" />جاري التحميل...
                </div>
              ) : projectDetail ? (
                <ProjectDetailPanel
                  project={projectDetail.project}
                  scans={projectDetail.scans}
                  timeline={projectDetail.timeline}
                  onAnalyze={() => handleAnalyze(selectedId)}
                  analyzing={analyzingId === selectedId}
                  onClose={() => { setSelectedId(null); setImageOverlay(null); }}
                  onFlyTo={(lon, lat) => setFlyToPin({ lon, lat, zoom: 15 })}
                  archiveScenes={archiveScenes}
                  activeSceneIdx={activeSceneIdx}
                  scenesLoading={scenesLoading}
                    onSceneChange={idx => {
                    setActiveSceneIdx(idx);
                    const sc = archiveScenes[idx];
                    if (sc) setImageOverlay({
                      url:    sc.thumbnail_url,
                      extent: sc.bbox as [number,number,number,number],
                      opacity: 0.75,
                    });
                  }}
                  onHideOverlay={() => setImageOverlay(null)}
                  onOpenLightbox={setLightboxUrl}
                />
              ) : null}
            </div>
          )}
        </div>
      ) : (
        /* Dashboard view */
        <DashboardView stats={dashStats} projects={projects} alerts={alerts} onSelectProject={id => { setSelectedId(id); setActiveView('map'); }} />
      )}

      {/* ══ Create Project Modal ════════════════════════════════════ */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" dir="rtl">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-[480px] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-800 border-b border-slate-700">
              <h3 className="font-bold text-sm text-white">إضافة مشروع جديد</h3>
              <button onClick={() => setShowCreateForm(false)} className="text-slate-400 hover:text-slate-200"><X size={16} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">اسم المشروع *</label>
                  <input value={newProject.name} onChange={e => setNewProject(s => ({...s, name: e.target.value}))}
                    placeholder="مثال: طريق الساحل الغربي — المقطع 3"
                    className="w-full h-8 px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">النوع</label>
                  <select value={newProject.type} onChange={e => {
                    const t = e.target.value as ProjectType;
                    setNewProject(s => ({...s, type: t}));
                    // Switch draw mode based on type: lines for roads/utilities, polygon for areas
                    if (drawMode !== 'off') setDrawMode(LINE_TYPES.includes(t) ? 'line' : 'polygon');
                  }}
                    className="w-full h-8 px-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 appearance-none">
                    {Object.entries(TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <p className="text-[9px] text-slate-500 mt-1">
                    {LINE_TYPES.includes(newProject.type) ? '〰️ رسم كخط (طريق/مسار)' : '⬡ رسم كمضلع (منطقة/مبنى)'}
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">القسم / الجهة</label>
                  <input value={newProject.department} onChange={e => setNewProject(s => ({...s, department: e.target.value}))}
                    placeholder="الجهة المنفذة"
                    className="w-full h-8 px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">المقاول</label>
                  <input value={newProject.contractor_name} onChange={e => setNewProject(s => ({...s, contractor_name: e.target.value}))}
                    placeholder="اسم المقاول أو الشركة المنفذة"
                    className="w-full h-8 px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">تاريخ البدء</label>
                  <input type="date" value={newProject.start_date} onChange={e => setNewProject(s => ({...s, start_date: e.target.value}))}
                    className="w-full h-8 px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">تاريخ الإنجاز المتوقع</label>
                  <input type="date" value={newProject.expected_end_date} onChange={e => setNewProject(s => ({...s, expected_end_date: e.target.value}))}
                    className="w-full h-8 px-3 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500" />
                </div>
              </div>

              {drawnPolygon ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg text-xs text-green-300">
                  <CheckCircle2 size={13} />الحدود مرسومة ({drawnPolygon.length} نقطة)
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-300">
                  <AlertTriangle size={13} />ارسم حدود المشروع على الخريطة أولاً
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 pb-4">
              <button onClick={handleCreate} disabled={!newProject.name || !drawnPolygon}
                className="flex-1 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors">
                إنشاء المشروع
              </button>
              <button onClick={() => setShowCreateForm(false)}
                className="px-4 h-9 rounded-lg bg-slate-800 text-slate-400 text-sm border border-slate-700 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Image Lightbox ══════════════════════════════════════════ */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white bg-slate-800/60 rounded-full p-2 z-10"
            onClick={() => setLightboxUrl(null)}><X size={20} /></button>
          <img
            src={lightboxUrl}
            alt="صورة فضائية"
            className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl border border-slate-700 object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* ══ Alerts Panel ════════════════════════════════════════════ */}
      {showAlerts && (        <div className="fixed top-14 left-4 z-50 w-80 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden" dir="rtl">
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-yellow-400" />
              <span className="text-xs font-bold text-slate-200">التنبيهات</span>
            </div>
            <button onClick={() => setShowAlerts(false)} className="text-slate-500 hover:text-slate-300"><X size={12} /></button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-center text-slate-600 text-xs py-8">لا توجد تنبيهات</p>
            ) : alerts.map(a => (
              <div key={a.id} className={`px-4 py-2.5 border-b border-slate-800/40 ${a.is_read ? 'opacity-50' : ''}`}>
                <p className="text-xs text-slate-200">{a.message_ar}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{new Date(a.triggered_at).toLocaleDateString('ar-LY')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
//  Project Detail Panel
// ─────────────────────────────────────────────

function ProjectDetailPanel({
  project, scans, timeline, onAnalyze, analyzing, onClose, onFlyTo,
  archiveScenes, activeSceneIdx, scenesLoading, onSceneChange, onHideOverlay, onOpenLightbox,
}: {
  project: Project; scans: any[]; timeline: any;
  onAnalyze: () => void; analyzing: boolean;
  onClose: () => void; onFlyTo: (lon: number, lat: number) => void;
  archiveScenes: ArchiveScene[];
  activeSceneIdx: number;
  scenesLoading: boolean;
  onSceneChange: (idx: number) => void;
  onHideOverlay: () => void;
  onOpenLightbox: (url: string) => void;
}) {
  const cfg = STATUS_CONFIG[project.status as ProjectStatus];
  const TypeIc = TYPE_ICONS[project.type as ProjectType] ?? MapIcon;

  const TrendIcon = !timeline ? Minus
    : timeline.trend === 'improving' ? TrendingUp
    : timeline.trend === 'declining' ? TrendingDown : Minus;

  const trendColor = !timeline ? 'text-slate-400'
    : timeline.trend === 'improving' ? 'text-green-400'
    : timeline.trend === 'declining' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 bg-slate-800/50 border-b border-slate-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <TypeIc size={14} className="text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{project.name}</p>
              {project.code && <p className="text-[10px] text-slate-500 font-mono">{project.code}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 shrink-0 ml-1"><X size={13} /></button>
        </div>

        {/* Status + trend */}
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
          <TrendIcon size={13} className={trendColor} />
          {timeline && <span className={`text-[10px] ${trendColor}`}>
            {timeline.trend === 'improving' ? 'نشاط متزايد' : timeline.trend === 'declining' ? 'نشاط متراجع' : 'مستقر'}
          </span>}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">

        {/* Key Metrics */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'الإنجاز', value: `${project.progress_pct}%`, color: project.progress_pct >= 70 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'الصحة', value: `${project.health_score}/100`, color: project.health_score >= 70 ? 'text-green-400' : project.health_score >= 40 ? 'text-yellow-400' : 'text-red-400' },
              { label: 'التوقفات', value: String(project.total_interruptions), color: project.total_interruptions > 0 ? 'text-orange-400' : 'text-green-400' },
              { label: 'أطول توقف', value: `${project.longest_interruption_days} يوم`, color: project.longest_interruption_days > 30 ? 'text-red-400' : 'text-slate-300' },
            ].map(m => (
              <div key={m.label} className="bg-slate-800/40 rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-500">{m.label}</p>
                <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${project.status === 'completed' ? 'bg-blue-500' : project.status === 'stopped' ? 'bg-red-500' : 'bg-indigo-500'}`}
                style={{ width: `${project.progress_pct}%` }} />
            </div>
          </div>
        </div>

        {/* Project info */}
        <div className="px-4 py-3 border-b border-slate-800 space-y-1.5">
          {project.contractor_name && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">المقاول:</span>
              <span className="text-slate-300 truncate mr-2">{project.contractor_name}</span>
            </div>
          )}
          {project.department && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">الجهة:</span>
              <span className="text-slate-300">{project.department}</span>
            </div>
          )}
          {project.start_date && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">البدء:</span>
              <span className="text-slate-300">{project.start_date?.slice(0,10)}</span>
            </div>
          )}
          {project.expected_end_date && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">الإنجاز المتوقع:</span>
              <span className={`${new Date().toISOString().slice(0,10) > project.expected_end_date?.slice(0,10) ? 'text-red-400' : 'text-slate-300'}`}>
                {project.expected_end_date?.slice(0,10)}
              </span>
            </div>
          )}
          {project.last_active_date && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">آخر نشاط:</span>
              <span className="text-slate-300">{project.last_active_date?.slice(0,10)}</span>
            </div>
          )}
        </div>

        {/* Interruptions */}
        {timeline?.interruptions?.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 mb-2">⏸️ فترات التوقف ({timeline.interruptions.length})</p>
            <div className="space-y-1.5">
              {timeline.interruptions.map((int: any, i: number) => (
                <div key={i} className={`px-3 py-2 rounded-lg border text-[11px] ${
                  int.days > 30 ? 'bg-red-900/20 border-red-700/30' : 'bg-orange-900/20 border-orange-700/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={int.days > 30 ? 'text-red-300' : 'text-orange-300'}>
                      {int.days} يوم {int.end_date === 'ongoing' ? '(مستمر)' : ''}
                    </span>
                    <span className="text-slate-500">{int.start_date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        {timeline?.points?.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 mb-2">📈 مسار النشاط ({timeline.points.length} قراءة)</p>
            <div className="flex items-end gap-0.5 h-16 bg-slate-800/30 rounded-lg px-2 py-2">
              {timeline.points.slice(-30).map((pt: TimelinePoint, i: number) => (
                <div
                  key={i}
                  title={`${pt.date}: ${pt.state} (${Math.round(pt.score * 100)}%)`}
                  className={`flex-1 rounded-sm min-h-[2px] transition-all ${
                    pt.state === 'active'  ? 'bg-green-500' :
                    pt.state === 'slow'    ? 'bg-yellow-500' : 'bg-red-500/50'
                  }`}
                  style={{ height: `${Math.max(4, pt.score * 52)}px` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-slate-600 mt-1">
              <span>{timeline.points[Math.max(0, timeline.points.length-30)]?.date ?? ''}</span>
              <span>{timeline.points[timeline.points.length-1]?.date ?? ''}</span>
            </div>
          </div>
        )}

        {/* ── Historical Archive Time Slider ──────────────────── */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <Clock size={11} className="text-indigo-400" />
              المشاهد التاريخية
              {archiveScenes.length > 0 && (
                <span className="text-[10px] bg-indigo-900/40 text-indigo-400 border border-indigo-700/40 rounded px-1.5 py-0.5 font-mono">
                  {archiveScenes.length}
                </span>
              )}
            </p>
            {archiveScenes.length > 0 && (
              <button onClick={onHideOverlay}
                className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1">
                <X size={9} />إخفاء
              </button>
            )}
          </div>

          {scenesLoading ? (
            <div className="flex items-center gap-2 py-2 text-slate-500 text-[11px]">
              <RefreshCw size={11} className="animate-spin" />تحميل المشاهد...
            </div>
          ) : archiveScenes.length === 0 ? (
            <p className="text-[10px] text-slate-600 py-1">لا توجد مشاهد أرشيفية لهذه المنطقة</p>
          ) : (
            <>
              {/* Selected scene preview — full width for clarity */}
              {archiveScenes[activeSceneIdx] && (
                <div className="mb-3">
                  <div className="relative cursor-pointer group rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 transition-colors"
                    onClick={() => onOpenLightbox(archiveScenes[activeSceneIdx].thumbnail_url)}>
                    <img
                      src={archiveScenes[activeSceneIdx].thumbnail_url}
                      alt={archiveScenes[activeSceneIdx].date}
                      className="w-full aspect-square object-cover"
                      style={{ imageRendering: 'pixelated' }}
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                    />
                    {/* Overlay info */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-4">
                      <p className="text-xs font-bold text-white">{archiveScenes[activeSceneIdx].date}</p>
                      <p className="text-[10px] text-slate-300">
                        ☁ {archiveScenes[activeSceneIdx].cloud}% · {activeSceneIdx + 1}/{archiveScenes.length}
                      </p>
                    </div>
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded p-1">
                      <ZoomIn size={14} className="text-white" />
                    </div>
                  </div>
                  {/* Nav buttons */}
                  <div className="flex items-center justify-between mt-1.5">
                    <button onClick={() => onSceneChange(Math.max(0, activeSceneIdx - 1))}
                      disabled={activeSceneIdx === 0}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors text-[10px]">
                      <ChevronRight size={10} />السابق
                    </button>
                    <span className="text-[9px] text-slate-600 font-mono">
                      {archiveScenes[activeSceneIdx].date}
                    </span>
                    <button onClick={() => onSceneChange(Math.min(archiveScenes.length - 1, activeSceneIdx + 1))}
                      disabled={activeSceneIdx === archiveScenes.length - 1}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors text-[10px]">
                      التالي<ChevronLeft size={10} />
                    </button>
                  </div>
                </div>
              )}

              {/* Time slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={archiveScenes.length - 1}
                  value={activeSceneIdx}
                  onChange={e => onSceneChange(parseInt(e.target.value))}
                  className="w-full h-1.5 accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-600">
                  <span>{archiveScenes[0]?.date?.slice(0,7)}</span>
                  <span className="text-indigo-400 font-bold">{archiveScenes[activeSceneIdx]?.date}</span>
                  <span>{archiveScenes[archiveScenes.length-1]?.date?.slice(0,7)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Recent thumbnails from scans */}
        {scans.filter(s => s.thumbnail_url).length > 0 && (
          <div className="px-4 py-3">
            <p className="text-[11px] font-bold text-slate-400 mb-2">🛰️ آخر مشاهد التحليل</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {scans.filter(s => s.thumbnail_url).slice(0, 6).map((s, i) => (
                <div key={i} className="shrink-0 text-center cursor-pointer group"
                  onClick={() => onOpenLightbox(s.thumbnail_url)}>
                  <div className="relative">
                    <img
                      src={s.thumbnail_url}
                      alt={s.scan_date}
                      className="w-16 h-16 rounded-lg object-cover border border-slate-700 group-hover:border-indigo-500 transition-colors"
                      onError={e => { (e.target as any).style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-lg transition-opacity">
                      <ZoomIn size={14} className="text-white" />
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-0.5">{s.scan_date}</p>
                  <div className={`w-2 h-2 rounded-full mx-auto mt-0.5 ${
                    s.activity_state === 'active' ? 'bg-green-400' :
                    s.activity_state === 'slow'   ? 'bg-yellow-400' : 'bg-red-400'
                  }`} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 px-4 py-3 border-t border-slate-800 flex gap-2">
        <button
          onClick={onAnalyze} disabled={analyzing}
          className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 text-white text-xs font-semibold"
        >
          {analyzing
            ? <><RefreshCw size={11} className="animate-spin" />جاري التحليل...</>
            : <><Activity size={11} />تحليل بالأقمار</>}
        </button>
        {project.bbox?.length ? (
          <button
            onClick={() => onFlyTo((project.bbox[0]+project.bbox[2])/2, (project.bbox[1]+project.bbox[3])/2)}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
          >
            <Eye size={13} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Dashboard View
// ─────────────────────────────────────────────

function DashboardView({
  stats, projects, alerts, onSelectProject
}: {
  stats: any; projects: Project[]; alerts: any[]; onSelectProject: (id: string) => void;
}) {
  if (!stats) return (
    <div className="flex-1 flex items-center justify-center text-slate-500 gap-2">
      <RefreshCw size={14} className="animate-spin" />جاري التحميل...
    </div>
  );

  const kpis = [
    { label: 'إجمالي المشاريع', value: stats.total, color: 'text-white', icon: MapIcon },
    { label: 'نشطة', value: stats.active, color: 'text-green-400', icon: Activity },
    { label: 'متوقفة', value: stats.stopped, color: 'text-red-400', icon: Pause },
    { label: 'بطيئة', value: stats.slow, color: 'text-yellow-400', icon: AlertTriangle },
    { label: 'مكتملة', value: stats.completed, color: 'text-blue-400', icon: CheckCircle2 },
    { label: 'في خطر', value: stats.at_risk, color: 'text-red-300', icon: AlertTriangle },
    { label: 'متوسط الإنجاز', value: `${stats.avg_progress ?? 0}%`, color: 'text-indigo-400', icon: BarChart2 },
    { label: 'متوسط الصحة', value: `${stats.avg_health ?? 0}`, color: 'text-purple-400', icon: Activity },
  ];

  const atRisk = projects.filter(p => p.health_score < 50 && p.status !== 'completed')
    .sort((a,b) => a.health_score - b.health_score).slice(0, 8);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6" dir="rtl">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* At-risk projects */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-sm font-bold text-slate-300 mb-3">⚠️ مشاريع تحتاج متابعة</p>
          {atRisk.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-4">جميع المشاريع بوضع جيد</p>
          ) : (
            <div className="space-y-2">
              {atRisk.map(p => (
                <div key={p.id} onClick={() => onSelectProject(p.id)}
                  className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 cursor-pointer transition-colors">
                  <div className={`w-2 h-2 rounded-full ${STATUS_CONFIG[p.status]?.dot ?? 'bg-slate-500'}`} />
                  <span className="text-xs text-slate-200 flex-1 truncate">{p.name}</span>
                  <span className={`text-xs font-bold ${p.health_score < 30 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {p.health_score}/100
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-sm font-bold text-slate-300 mb-3">🔔 التنبيهات الأخيرة</p>
          {alerts.length === 0 ? (
            <p className="text-slate-600 text-xs text-center py-4">لا توجد تنبيهات جديدة</p>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 6).map((a, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-800/40">
                  <p className="text-xs text-slate-300">{a.message_ar}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{new Date(a.triggered_at).toLocaleDateString('ar-LY')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

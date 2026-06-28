'use client';
/**
 * DepartmentMapWorkspace
 * ─────────────────────────────────────────────────────────────────
 * Department-specific map view built on SharedMasterMap.
 * Each department gets its own focused layer set and editing toolbar.
 * All share the same base map and core infrastructure layers.
 */
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Globe, Layers, Pencil, Save, Trash2, Filter, Download,
  Activity, Building2, Users, Wrench, DollarSign, ShoppingCart,
  Hammer, BarChart3, AlertTriangle, MapPin, Info, ChevronDown,
} from 'lucide-react';
import {
  Department, UserRole, MASTER_LAYERS, getLayersForDepartment, DEMO_MARKERS,
} from '@/lib/masterMapConfig';

const SharedMasterMap = dynamic(() => import('./SharedMasterMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-slate-950">
      <Globe className="w-8 h-8 text-emerald-400 animate-pulse" />
    </div>
  ),
});

// ── Department metadata ───────────────────────────────────────────────────────

const DEPT_META: Record<Department, { label: string; labelAr: string; color: string; icon: React.ReactNode }> = {
  executive:    { label: 'Executive',    labelAr: 'الإدارة التنفيذية', color: '#3b82f6', icon: <Building2 className="w-4 h-4" /> },
  gis:          { label: 'GIS',          labelAr: 'نظم المعلومات الجغرافية', color: '#10b981', icon: <Globe className="w-4 h-4" /> },
  assets:       { label: 'Assets',       labelAr: 'إدارة الأصول',     color: '#f97316', icon: <BarChart3 className="w-4 h-4" /> },
  projects:     { label: 'Projects',     labelAr: 'إدارة المشاريع',   color: '#22d3ee', icon: <Hammer className="w-4 h-4" /> },
  hr:           { label: 'HR',           labelAr: 'الموارد البشرية',  color: '#a78bfa', icon: <Users className="w-4 h-4" /> },
  finance:      { label: 'Finance',      labelAr: 'الشؤون المالية',   color: '#facc15', icon: <DollarSign className="w-4 h-4" /> },
  procurement:  { label: 'Procurement',  labelAr: 'المشتريات',        color: '#e879f9', icon: <ShoppingCart className="w-4 h-4" /> },
  maintenance:  { label: 'Maintenance',  labelAr: 'الصيانة',          color: '#84cc16', icon: <Wrench className="w-4 h-4" /> },
  admin:        { label: 'Admin',        labelAr: 'الإدارة العامة',   color: '#64748b', icon: <Activity className="w-4 h-4" /> },
};

// ── Editing toolbar (for permitted roles) ─────────────────────────────────────

function EditingToolbar({ canEdit }: { canEdit: boolean }) {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  if (!canEdit) return null;

  const tools = [
    { id: 'add',    label: 'إضافة نقطة', icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: 'edit',   label: 'تعديل',      icon: <Pencil className="w-3.5 h-3.5" /> },
    { id: 'delete', label: 'حذف',        icon: <Trash2 className="w-3.5 h-3.5" /> },
    { id: 'save',   label: 'حفظ',        icon: <Save className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-xl"
      style={{ background: 'rgba(4,12,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <span className="text-[10px] text-slate-500 pl-1">أدوات:</span>
      {tools.map(tool => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
          title={tool.label}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all ${
            activeTool === tool.id
              ? 'bg-blue-600 text-white'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          {tool.icon}
          <span className="hidden sm:inline">{tool.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Department stats mini-bar ─────────────────────────────────────────────────

function DeptStats({ department }: { department: Department }) {
  const layers   = MASTER_LAYERS.filter(l => l.departments.includes(department));
  const editable = layers.filter(l => l.editable).length;
  const markers  = DEMO_MARKERS.filter(m => layers.some(l => l.id === m.layer));
  const alerts   = markers.filter(m => m.status === 'alert' || m.status === 'warning');

  return (
    <div className="flex gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1">
        <Layers className="w-3 h-3" />{layers.length} طبقة
      </span>
      <span className="flex items-center gap-1">
        <Pencil className="w-3 h-3" />{editable} قابلة للتحرير
      </span>
      <span className="flex items-center gap-1 text-amber-400">
        <AlertTriangle className="w-3 h-3" />{alerts.length} تنبيه
      </span>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({ layers, activeLayers, onToggle }: {
  layers: ReturnType<typeof getLayersForDepartment>;
  activeLayers: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
        style={{ background: 'rgba(4,12,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Filter className="w-3.5 h-3.5" /> فلترة الطبقات ({activeLayers.length}/{layers.length})
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className="absolute top-9 right-0 z-30 rounded-xl p-3 min-w-[200px] grid grid-cols-2 gap-1.5"
          style={{ background: 'rgba(4,12,32,0.96)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {layers.map(l => (
            <label key={l.id} className="flex items-center gap-1.5 cursor-pointer text-xs py-0.5">
              <input
                type="checkbox"
                checked={activeLayers.includes(l.id)}
                onChange={() => onToggle(l.id)}
                className="w-3 h-3 accent-blue-500"
              />
              <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              <span className="text-slate-300">{l.labelAr}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DepartmentMapWorkspaceProps {
  department: Department;
  role: UserRole;
  compact?: boolean;
  className?: string;
}

export default function DepartmentMapWorkspace({
  department,
  role,
  compact = false,
  className = '',
}: DepartmentMapWorkspaceProps) {
  const meta    = DEPT_META[department];
  const layers  = getLayersForDepartment(department, role);
  const canEdit = role !== 'executive' && layers.some(l => l.editable);

  const [forcedLayers, setForcedLayers] = useState<string[]>(
    layers.filter(l => l.defaultVisible).map(l => l.id)
  );
  const [selectedMarker, setSelectedMarker] = useState<typeof DEMO_MARKERS[0] | null>(null);

  const toggleForcedLayer = (id: string) => {
    setForcedLayers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className={`flex flex-col bg-slate-950 ${className}`} style={{ minHeight: '100%' }} dir="rtl">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900/60 flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <span style={{ color: meta.color }}>{meta.icon}</span>
          <div>
            <div className="text-sm font-bold text-white">{meta.labelAr}</div>
            <DeptStats department={department} />
          </div>
        </div>

        <div className="flex items-center gap-2 mr-auto flex-wrap">
          <FilterBar
            layers={layers}
            activeLayers={forcedLayers}
            onToggle={toggleForcedLayer}
          />
          <EditingToolbar canEdit={canEdit} />
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
            style={{ background: 'rgba(4,12,32,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Download className="w-3.5 h-3.5" /> تصدير
          </button>
        </div>
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <SharedMasterMap
          viewMode="department"
          department={department}
          role={role}
          compact={compact}
          forceLayers={forcedLayers}
          onMarkerClick={m => setSelectedMarker(m)}
          className="w-full h-full"
        />

        {/* Selected marker info panel */}
        {selectedMarker && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-xl p-4 min-w-[260px]"
            style={{ background: 'rgba(4,12,32,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-white font-semibold text-sm">{selectedMarker.nameAr}</div>
                <div className="text-slate-400 text-xs mt-0.5">{selectedMarker.name}</div>
                {selectedMarker.value && (
                  <div className="text-blue-400 text-xs mt-1">{selectedMarker.value}</div>
                )}
                <div className="text-slate-500 text-[10px] mt-1 font-mono">
                  {selectedMarker.lon.toFixed(4)}, {selectedMarker.lat.toFixed(4)}
                </div>
              </div>
              <button onClick={() => setSelectedMarker(null)} className="text-slate-500 hover:text-white text-xs">✕</button>
            </div>
            {canEdit && (
              <div className="flex gap-2 mt-3">
                <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-600/20 border border-blue-600/30 text-blue-400 text-xs hover:bg-blue-600/30 transition-colors">
                  <Pencil className="w-3 h-3" /> تعديل
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-xs hover:bg-slate-700 transition-colors">
                  <Info className="w-3 h-3" /> تفاصيل
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

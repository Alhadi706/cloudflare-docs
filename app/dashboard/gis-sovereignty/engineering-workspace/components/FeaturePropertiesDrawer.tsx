'use client';
/**
 * FeaturePropertiesDrawer — لوحة خصائص المعلم المرسوم
 * ======================================================
 * تنزلق تلقائياً من اليمين بعد رسم أي معلم على الخريطة.
 * المهندس يملأ: الاسم + النوع + الحالة ثم يضغط "حفظ" — يُحفظ فوراً.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Save, MapPin, Layers, Activity, User,
  CheckCircle, AlertCircle, Clock, Loader2,
  PenTool, Route, Hexagon, Tag, FileText,
} from 'lucide-react';
import { useGisEngine } from '@/store/gisEngine';
import { useProjectStore } from '@/store/projectStore';
import { useLayerStore } from '@/store/layerStore';
import { useToast } from '@/components/ToastProvider';
import { resolveTenantContext } from '@/lib/gis/tenantContext';

// ── Types ────────────────────────────────────────────────────────────────────

interface DrawnFeatureEvent {
  geometry: object;
  geometryType: 'point' | 'line' | 'polygon';
  drawingMode: string;
}

const FEATURE_TYPES = [
  { value: 'road',           label: 'طريق',             icon: '🛣️' },
  { value: 'pipeline',       label: 'أنبوب',             icon: '🔧' },
  { value: 'power_line',     label: 'خط طاقة',          icon: '⚡' },
  { value: 'building',       label: 'مبنى / منشأة',     icon: '🏗️' },
  { value: 'water_channel',  label: 'قناة مياه',        icon: '💧' },
  { value: 'boundary',       label: 'حد إداري / نطاق',  icon: '📐' },
  { value: 'survey_point',   label: 'نقطة مساحية',      icon: '📍' },
  { value: 'access_point',   label: 'نقطة وصول',        icon: '🚪' },
  { value: 'other',          label: 'أخرى',              icon: '📌' },
] as const;

const STATUSES = [
  { value: 'planned',       label: 'مخطط',             color: 'text-blue-400',    bg: 'bg-blue-500/20 border-blue-500/40' },
  { value: 'in_progress',   label: 'قيد التنفيذ',      color: 'text-amber-400',   bg: 'bg-amber-500/20 border-amber-500/40' },
  { value: 'completed',     label: 'مكتمل',             color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/40' },
  { value: 'on_hold',       label: 'موقوف مؤقتاً',     color: 'text-orange-400',  bg: 'bg-orange-500/20 border-orange-500/40' },
  { value: 'needs_review',  label: 'يحتاج مراجعة',     color: 'text-violet-400',  bg: 'bg-violet-500/20 border-violet-500/40' },
] as const;

const GEOM_ICONS: Record<string, React.ReactNode> = {
  point:   <MapPin className="w-4 h-4" />,
  line:    <Route className="w-4 h-4" />,
  polygon: <Hexagon className="w-4 h-4" />,
};

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Called after successful save so parent can refresh layers */
  onSaved?: (featureId: string) => void;
}

export default function FeaturePropertiesDrawer({ onSaved }: Props) {
  const { showToast } = useToast();

  // Engine state
  const drawnFeatures  = useGisEngine(s => s.drawnFeatures);
  const drawingMode    = useGisEngine(s => s.drawingMode);
  const setDrawingMode = useGisEngine(s => s.setDrawingMode);

  // Project / layer context
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const activeLayerId   = useLayerStore(s => s.activeLayerId);
  const { layers, loadLayers } = useLayerStore();
  const activeLayer = layers.find(l => l.id === activeLayerId);

  // Local form state
  const [open, setOpen]               = useState(false);
  const [pendingFeature, setPending]  = useState<DrawnFeatureEvent | null>(null);
  const [name, setName]               = useState('');
  const [featureType, setFeatureType] = useState<string>('other');
  const [status, setStatus]           = useState<string>('planned');
  const [description, setDescription] = useState('');
  const [saving, setSaving]           = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Watch for newly drawn features → open drawer
  const prevDrawnCount = useRef(0);
  useEffect(() => {
    const count = drawnFeatures.length;
    if (count > prevDrawnCount.current && count > 0) {
      const latest = drawnFeatures[count - 1];
      const geom = (latest.geojson as any)?.geometry ?? latest.geojson;
      const type =
        latest.type === 'point'   ? 'point'   :
        latest.type === 'line'    ? 'line'     :
        latest.type === 'polygon' ? 'polygon'  : 'other';
      setPending({ geometry: geom, geometryType: type as any, drawingMode: latest.type });
      setOpen(true);
      // Reset form
      setName('');
      setFeatureType('other');
      setStatus('planned');
      setDescription('');
      // Focus name input after short delay
      setTimeout(() => nameInputRef.current?.focus(), 150);
    }
    prevDrawnCount.current = count;
  }, [drawnFeatures]);

  const handleClose = () => {
    setOpen(false);
    setPending(null);
    setDrawingMode('idle');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      nameInputRef.current?.focus();
      showToast('أدخل اسماً للمعلم قبل الحفظ', 'warning');
      return;
    }
    if (!activeProjectId) {
      showToast('لا يوجد مشروع نشط — اختر مشروعاً أولاً', 'error');
      return;
    }
    if (!activeLayerId) {
      showToast('اختر طبقة أو أنشئ طبقة جديدة أولاً', 'error');
      return;
    }
    if (!pendingFeature?.geometry) {
      showToast('لا توجد هندسة للحفظ', 'error');
      return;
    }

    setSaving(true);
    try {
      const { tenantId } = resolveTenantContext();
      const tenantHeader = tenantId ? { 'X-Tenant-ID': tenantId } : {};

      const res = await fetch('/api/v1/workspace/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...tenantHeader },
        body: JSON.stringify({
          project_id:   activeProjectId,
          layer_id:     activeLayerId,
          name:         name.trim(),
          feature_type: featureType,
          status,
          description:  description.trim() || null,
          geometry:     pendingFeature.geometry,
          properties: {
            geometry_type: pendingFeature.geometryType,
            saved_via: 'engineering_workspace_drawer',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`تم حفظ "${name.trim()}" بنجاح`, 'success');
        onSaved?.(data.id ?? data.feature_id ?? '');
        // Reload layer features
        if (activeProjectId) loadLayers(activeProjectId, null);
        handleClose();
      } else {
        const err = await res.text().catch(() => `HTTP ${res.status}`);
        showToast(`فشل الحفظ: ${err.slice(0, 80)}`, 'error');
      }
    } catch (e: any) {
      showToast(`خطأ في الاتصال: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard: Enter = save, Escape = close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, name, featureType, status, description]);

  if (!open) return null;

  const geomTypeLabel =
    pendingFeature?.geometryType === 'point'   ? 'نقطة مكانية' :
    pendingFeature?.geometryType === 'line'     ? 'مسار / خط'   :
    pendingFeature?.geometryType === 'polygon'  ? 'مساحة / مضلع' : 'معلم جغرافي';

  const currentStatus = STATUSES.find(s => s.value === status);

  return (
    /* Slide-in drawer from the right */
    <div
      className="absolute top-0 right-0 h-full w-80 bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col z-50"
      dir="rtl"
      style={{ animation: 'slideInRight 0.22s ease-out' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">{GEOM_ICONS[pendingFeature?.geometryType ?? 'point']}</span>
          <div>
            <p className="text-xs font-semibold text-cyan-300 leading-none">خصائص المعلم</p>
            <p className="text-xs text-slate-400 mt-0.5">{geomTypeLabel}</p>
          </div>
        </div>
        <button onClick={handleClose} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Context strip ── */}
      {(activeLayer || activeProjectId) && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border-b border-slate-700/60 text-xs text-slate-400">
          <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">{activeLayer?.name ?? 'طبقة غير محددة'}</span>
        </div>
      )}

      {/* ── Form ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            <Tag className="w-3.5 h-3.5 inline ml-1 text-cyan-400" />
            اسم المعلم <span className="text-red-400">*</span>
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: خط الصرف الرئيسي"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition"
          />
        </div>

        {/* Feature type */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            <PenTool className="w-3.5 h-3.5 inline ml-1 text-cyan-400" />
            نوع المعلم
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {FEATURE_TYPES.map(ft => (
              <button
                key={ft.value}
                type="button"
                onClick={() => setFeatureType(ft.value)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs transition-all ${
                  featureType === ft.value
                    ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                }`}
              >
                <span className="text-base leading-none">{ft.icon}</span>
                <span className="leading-tight text-center">{ft.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            <Activity className="w-3.5 h-3.5 inline ml-1 text-cyan-400" />
            حالة التنفيذ
          </label>
          <div className="flex flex-col gap-1.5">
            {STATUSES.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-right transition-all ${
                  status === s.value ? s.bg + ' ' + s.color : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {status === s.value ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <div className="w-3.5 h-3.5 rounded-full border border-current shrink-0 opacity-40" />}
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            <FileText className="w-3.5 h-3.5 inline ml-1 text-cyan-400" />
            ملاحظات (اختياري)
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="تفاصيل إضافية، ملاحظات فنية..."
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition resize-none"
          />
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/60 space-y-2">
        <p className="text-xs text-slate-500 text-center">Ctrl+Enter للحفظ السريع · Esc للإلغاء</p>
        <div className="flex gap-2">
          <button
            onClick={handleClose}
            className="flex-1 py-2 rounded-lg border border-slate-600 text-sm text-slate-400 hover:text-white hover:border-slate-400 transition"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'جاري الحفظ...' : 'حفظ المعلم'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
